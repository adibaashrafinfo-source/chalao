-- Courier API credentials live in Supabase Vault, never in a plain column (Brief §9).
--
-- Two deliberately asymmetric functions:
--   set_courier_credentials  — any member of the organization may WRITE credentials
--   get_courier_credentials  — only service_role may READ them back, so a signed-in
--                              user can never fetch the raw API key through PostgREST.

-- Each courier account gets its own webhook token, so one seller's webhook URL
-- cannot be used to post updates into another seller's shipments.
alter table public.courier_accounts
  add column if not exists webhook_token text not null default encode(gen_random_bytes(24), 'hex');

create unique index if not exists courier_accounts_webhook_token_key
  on public.courier_accounts (webhook_token);

create or replace function public.set_courier_credentials(p_account_id uuid, p_credentials jsonb)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_account public.courier_accounts;
  v_secret_id uuid;
begin
  select * into v_account from public.courier_accounts where id = p_account_id for update;
  if not found then
    raise exception 'Courier account not found' using errcode = 'no_data_found';
  end if;

  if not public.is_org_member(v_account.organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  if v_account.vault_secret_id is null then
    v_secret_id := vault.create_secret(
      p_credentials::text,
      format('courier_%s', p_account_id),
      'F-Commerce OS courier credentials'
    );
    update public.courier_accounts set vault_secret_id = v_secret_id where id = p_account_id;
  else
    perform vault.update_secret(v_account.vault_secret_id, p_credentials::text);
  end if;
end;
$$;

create or replace function public.get_courier_credentials(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
  v_value text;
begin
  select vault_secret_id into v_secret_id from public.courier_accounts where id = p_account_id;
  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret into v_value from vault.decrypted_secrets where id = v_secret_id;
  if v_value is null then
    return null;
  end if;

  return v_value::jsonb;
end;
$$;

-- Writing is for members; reading is for the server only.
grant execute on function public.set_courier_credentials(uuid, jsonb) to authenticated;

revoke all on function public.get_courier_credentials(uuid) from public;
revoke all on function public.get_courier_credentials(uuid) from anon;
revoke all on function public.get_courier_credentials(uuid) from authenticated;
grant execute on function public.get_courier_credentials(uuid) to service_role;

-- The webhook token stays readable by members: the seller has to paste the webhook URL
-- into the courier's portal. RLS keeps it inside their own organization, and the token
-- only ever lets someone post updates to that organization's shipments.
