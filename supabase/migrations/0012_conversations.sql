-- ============================================================================
-- Inbox, phase 1: channels, conversations and messages.
--
-- How it works:
--   * A channel connection is one Facebook page / Instagram account / sandbox
--     that belongs to exactly one organization. Access tokens go to Vault, the
--     same asymmetric way courier credentials do (0004).
--   * A conversation is one person talking to one connection. It is keyed by the
--     provider's own thread id, so a replayed webhook never creates a duplicate.
--   * Messages are append-only. Body, direction and author can never be edited
--     after the fact; only delivery state moves forward.
--
-- Nothing here reads or writes orders. Turning a conversation into an order
-- arrives in a later phase; this migration only stores what was said.
-- ============================================================================

-- ---------------------------------------------------------------- connections

do $$ begin
  create type public.channel_provider as enum ('mock', 'facebook', 'instagram');
exception when duplicate_object then null;
end $$;

create table if not exists public.channel_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider public.channel_provider not null,
  -- The page or account id at the provider. A sandbox connection invents one.
  external_id text not null,
  label text not null default 'Default',
  -- Page access token etc. live in Vault; this is only the reference.
  vault_secret_id uuid,
  is_active boolean not null default true,
  -- Each connection gets its own webhook token, so one seller's webhook URL
  -- cannot be used to post messages into another seller's inbox.
  webhook_token text not null default encode(gen_random_bytes(24), 'hex'),
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A page belongs to one seller. Claiming it twice is a mistake worth blocking.
  unique (provider, external_id)
);

create index if not exists channel_connections_org_idx
  on public.channel_connections (organization_id);

create unique index if not exists channel_connections_webhook_token_key
  on public.channel_connections (webhook_token);

drop trigger if exists channel_connections_set_updated_at on public.channel_connections;
create trigger channel_connections_set_updated_at
  before update on public.channel_connections
  for each row execute function public.set_updated_at();

-- Members may write credentials; only the server may read them back (as in 0004).
create or replace function public.set_channel_credentials(p_connection_id uuid, p_credentials jsonb)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_row public.channel_connections;
  v_secret_id uuid;
begin
  select * into v_row from public.channel_connections where id = p_connection_id for update;
  if not found then
    raise exception 'Channel connection not found' using errcode = 'no_data_found';
  end if;

  if not public.is_org_member(v_row.organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  if v_row.vault_secret_id is null then
    v_secret_id := vault.create_secret(
      p_credentials::text,
      format('channel_%s', p_connection_id),
      'Chalao channel credentials'
    );
    update public.channel_connections set vault_secret_id = v_secret_id where id = p_connection_id;
  else
    perform vault.update_secret(v_row.vault_secret_id, p_credentials::text);
  end if;
end;
$$;

create or replace function public.get_channel_credentials(p_connection_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_value text;
begin
  select vault_secret_id into v_secret_id from public.channel_connections where id = p_connection_id;
  if v_secret_id is null then return null; end if;

  select decrypted_secret into v_value from vault.decrypted_secrets where id = v_secret_id;
  if v_value is null then return null; end if;

  return v_value::jsonb;
end;
$$;

grant execute on function public.set_channel_credentials(uuid, jsonb) to authenticated;

revoke all on function public.get_channel_credentials(uuid) from public;
revoke all on function public.get_channel_credentials(uuid) from anon;
revoke all on function public.get_channel_credentials(uuid) from authenticated;
grant execute on function public.get_channel_credentials(uuid) to service_role;

-- ---------------------------------------------------------------- conversations

do $$ begin
  create type public.conversation_status as enum ('open', 'pending', 'snoozed', 'closed');
exception when duplicate_object then null;
end $$;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  channel_connection_id uuid not null references public.channel_connections (id) on delete cascade,
  -- The person's id at the provider (PSID / IGSID).
  external_id text not null,
  -- Filled in once someone matches this person to a customer record.
  customer_id uuid references public.customers (id) on delete set null,
  contact_name text,
  contact_handle text,
  contact_avatar_url text,
  status public.conversation_status not null default 'open',
  assigned_to uuid references auth.users (id) on delete set null,
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_at timestamptz,
  last_message_preview text,
  last_inbound_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_connection_id, external_id)
);

create index if not exists conversations_org_recent_idx
  on public.conversations (organization_id, last_message_at desc nulls last);
create index if not exists conversations_org_status_idx
  on public.conversations (organization_id, status, last_message_at desc nulls last);
create index if not exists conversations_customer_idx
  on public.conversations (organization_id, customer_id);

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- messages

do $$ begin
  create type public.message_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null;
end $$;

do $$ begin
  -- Who produced the text. 'ai' exists so a later phase can be told apart from a
  -- human reply without changing this table.
  create type public.message_author as enum ('customer', 'agent', 'ai', 'system');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.message_delivery as enum ('received', 'queued', 'sent', 'delivered', 'read', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction public.message_direction not null,
  author public.message_author not null,
  author_user_id uuid references auth.users (id) on delete set null,
  body text,
  attachments jsonb not null default '[]'::jsonb,
  -- The provider's message id. Makes a replayed webhook a no-op.
  external_id text,
  delivery public.message_delivery not null default 'received',
  error text,
  payload jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  -- A message with neither text nor an attachment is not a message.
  check (nullif(btrim(coalesce(body, '')), '') is not null or attachments <> '[]'::jsonb)
);

create unique index if not exists messages_external_key
  on public.messages (conversation_id, external_id)
  where external_id is not null;

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

-- Append-only: delivery state may move forward, the message itself may not change.
create or replace function public.forbid_message_rewrite()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Messages cannot be deleted' using errcode = 'restrict_violation';
  end if;

  if new.body is distinct from old.body
    or new.direction is distinct from old.direction
    or new.author is distinct from old.author
    or new.conversation_id is distinct from old.conversation_id
    or new.attachments is distinct from old.attachments then
    raise exception 'A message cannot be edited after it is stored' using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_no_rewrite on public.messages;
create trigger messages_no_rewrite
  before update or delete on public.messages
  for each row execute function public.forbid_message_rewrite();

-- ---------------------------------------------------------------- writing

-- One inbound message: find or create the conversation, store the message, move
-- the conversation's counters. Called by the webhook (service_role) and by the
-- sandbox "simulate" button (a member).
create or replace function public.record_inbound_message(
  p_connection_id uuid,
  p_thread_id text,
  p_body text,
  p_external_id text default null,
  p_attachments jsonb default '[]'::jsonb,
  p_contact_name text default null,
  p_contact_handle text default null,
  p_sent_at timestamptz default null,
  p_payload jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conn public.channel_connections;
  v_conversation_id uuid;
  v_message_id uuid;
  v_sent_at timestamptz := coalesce(p_sent_at, now());
begin
  select * into v_conn from public.channel_connections where id = p_connection_id;
  if not found then
    raise exception 'Channel connection not found' using errcode = 'no_data_found';
  end if;

  if not (public.is_service_role() or public.is_org_member(v_conn.organization_id)) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  if nullif(btrim(p_thread_id), '') is null then
    raise exception 'A thread id is required' using errcode = 'invalid_parameter_value';
  end if;

  if nullif(btrim(coalesce(p_body, '')), '') is null and coalesce(p_attachments, '[]'::jsonb) = '[]'::jsonb then
    raise exception 'A message needs text or an attachment' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.conversations (
    organization_id, channel_connection_id, external_id, contact_name, contact_handle
  )
  values (
    v_conn.organization_id, v_conn.id, btrim(p_thread_id),
    nullif(btrim(coalesce(p_contact_name, '')), ''),
    nullif(btrim(coalesce(p_contact_handle, '')), '')
  )
  on conflict (channel_connection_id, external_id) do update
    set contact_name = coalesce(excluded.contact_name, conversations.contact_name),
        contact_handle = coalesce(excluded.contact_handle, conversations.contact_handle)
  returning id into v_conversation_id;

  insert into public.messages (
    organization_id, conversation_id, direction, author, body, attachments,
    external_id, delivery, sent_at, payload
  )
  values (
    v_conn.organization_id, v_conversation_id, 'inbound', 'customer',
    nullif(btrim(coalesce(p_body, '')), ''), coalesce(p_attachments, '[]'::jsonb),
    nullif(btrim(coalesce(p_external_id, '')), ''), 'received', v_sent_at, p_payload
  )
  -- The predicate repeats the partial index above, which is how Postgres is told
  -- which index to match on.
  on conflict (conversation_id, external_id) where external_id is not null do nothing
  returning id into v_message_id;

  -- The provider sent this one before; the conversation must not move again.
  if v_message_id is null then
    return jsonb_build_object(
      'conversation_id', v_conversation_id,
      'message_id', null,
      'duplicate', true
    );
  end if;

  update public.conversations
  set last_message_at = v_sent_at,
      last_inbound_at = v_sent_at,
      last_message_preview = left(coalesce(nullif(btrim(coalesce(p_body, '')), ''), 'Attachment'), 160),
      unread_count = unread_count + 1,
      -- A reply to a finished conversation opens it again.
      status = case when status in ('closed', 'snoozed') then 'open' else status end,
      snoozed_until = null
  where id = v_conversation_id;

  update public.channel_connections set last_event_at = v_sent_at where id = v_conn.id;

  return jsonb_build_object(
    'conversation_id', v_conversation_id,
    'message_id', v_message_id,
    'duplicate', false
  );
end;
$$;

-- A reply typed by a member (or, later, written by the assistant). Storing it is
-- separate from sending it: the caller stores first, sends through the adapter,
-- then reports back with update_message_delivery().
create or replace function public.record_outbound_message(
  p_conversation_id uuid,
  p_body text,
  p_author public.message_author default 'agent',
  p_attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.conversations;
  v_message_id uuid;
  v_now timestamptz := now();
begin
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if not found then
    raise exception 'Conversation not found' using errcode = 'no_data_found';
  end if;

  if not (public.is_service_role() or public.is_org_member(v_conversation.organization_id)) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  if p_author = 'customer' then
    raise exception 'An outbound message cannot come from the customer' using errcode = 'invalid_parameter_value';
  end if;

  insert into public.messages (
    organization_id, conversation_id, direction, author, author_user_id, body, attachments, delivery
  )
  values (
    v_conversation.organization_id, v_conversation.id, 'outbound', p_author, auth.uid(),
    nullif(btrim(coalesce(p_body, '')), ''), coalesce(p_attachments, '[]'::jsonb), 'queued'
  )
  returning id into v_message_id;

  update public.conversations
  set last_message_at = v_now,
      last_message_preview = left(coalesce(nullif(btrim(coalesce(p_body, '')), ''), 'Attachment'), 160),
      -- Whoever is replying has plainly read what came before.
      unread_count = 0
  where id = v_conversation.id;

  return v_message_id;
end;
$$;

-- Delivery state after the adapter has spoken to the provider.
create or replace function public.update_message_delivery(
  p_message_id uuid,
  p_delivery public.message_delivery,
  p_external_id text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.messages;
begin
  select * into v_message from public.messages where id = p_message_id;
  if not found then
    raise exception 'Message not found' using errcode = 'no_data_found';
  end if;

  if not (public.is_service_role() or public.is_org_member(v_message.organization_id)) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  update public.messages
  set delivery = p_delivery,
      external_id = coalesce(nullif(btrim(coalesce(p_external_id, '')), ''), external_id),
      error = p_error,
      sent_at = case when p_delivery in ('sent', 'delivered', 'read') then coalesce(sent_at, now()) else sent_at end
  where id = p_message_id;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
begin
  select organization_id into v_organization_id from public.conversations where id = p_conversation_id;
  if v_organization_id is null then return; end if;

  if not public.is_org_member(v_organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  update public.conversations set unread_count = 0 where id = p_conversation_id and unread_count > 0;
end;
$$;

grant execute on function public.record_inbound_message(uuid, text, text, text, jsonb, text, text, timestamptz, jsonb) to authenticated, service_role;
grant execute on function public.record_outbound_message(uuid, text, public.message_author, jsonb) to authenticated, service_role;
grant execute on function public.update_message_delivery(uuid, public.message_delivery, text, text) to authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ---------------------------------------------------------------- row level security

alter table public.channel_connections enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;

-- Connections: members manage their own organization's channels.
drop policy if exists "channel_connections_select_member" on public.channel_connections;
create policy "channel_connections_select_member" on public.channel_connections
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "channel_connections_insert_member" on public.channel_connections;
create policy "channel_connections_insert_member" on public.channel_connections
  for insert to authenticated with check (public.is_org_member(organization_id));
drop policy if exists "channel_connections_update_member" on public.channel_connections;
create policy "channel_connections_update_member" on public.channel_connections
  for update to authenticated using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
drop policy if exists "channel_connections_delete_member" on public.channel_connections;
create policy "channel_connections_delete_member" on public.channel_connections
  for delete to authenticated using (public.is_org_member(organization_id));

-- Conversations: members read and triage. Rows are created by
-- record_inbound_message() only, so there is no INSERT policy on purpose.
drop policy if exists "conversations_select_member" on public.conversations;
create policy "conversations_select_member" on public.conversations
  for select to authenticated using (public.is_org_member(organization_id));
drop policy if exists "conversations_update_member" on public.conversations;
create policy "conversations_update_member" on public.conversations
  for update to authenticated using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Messages: readable by members, written only by the functions above.
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member" on public.messages
  for select to authenticated using (public.is_org_member(organization_id));
