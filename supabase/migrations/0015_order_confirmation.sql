-- ============================================================================
-- Order confirmation rules.
--
-- Confirming an order by hand is fine at ten orders a day and impossible at two
-- hundred. But confirming everything automatically is how a seller ends up
-- posting parcels to people who never take delivery.
--
-- So the software decides one of two things for every new order — confirm it, or
-- leave it for a person — and says why. The rules are the seller's, the reasons
-- are always shown, and nothing is confirmed automatically unless the seller
-- turned that on.
-- ============================================================================

create table if not exists public.order_confirmation_rules (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  -- Off until the seller decides otherwise. Nobody should discover this by
  -- finding orders already confirmed.
  auto_confirm_enabled boolean not null default false,
  -- Null means no ceiling. Above it, a person looks at the order.
  auto_confirm_max_total numeric(12, 2) check (auto_confirm_max_total is null or auto_confirm_max_total >= 0),
  -- Someone with no history is not a bad customer, but they are an unknown one.
  auto_confirm_new_customers boolean not null default false,
  -- Above this, suggest taking the money up front rather than on delivery.
  advance_payment_above numeric(12, 2) check (advance_payment_above is null or advance_payment_above >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists order_confirmation_rules_set_updated_at on public.order_confirmation_rules;
create trigger order_confirmation_rules_set_updated_at
  before update on public.order_confirmation_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- the decision

-- What should happen to this order, and why. Reasons are codes rather than
-- sentences, so the dashboard can say them in the seller's own language.
--
-- Security INVOKER: it reads orders and customers through RLS, like customer_risk().
create or replace function public.order_confirmation_decision(p_order_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_order public.orders;
  v_rules public.order_confirmation_rules;
  v_risk jsonb;
  v_level text;
  v_action text := 'manual';
  v_advice text[] := '{}';
  v_blockers text[] := '{}';
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return jsonb_build_object('action', 'manual', 'advice', '[]'::jsonb, 'blockers', '[]'::jsonb);
  end if;

  select * into v_rules
  from public.order_confirmation_rules
  where organization_id = v_order.organization_id;

  v_risk := public.customer_risk(v_order.customer_id);
  v_level := v_risk ->> 'level';

  -- ---- what a person should do about this customer
  if v_level = 'high' then
    v_advice := v_advice || 'take_advance';
  elsif v_level = 'watch' then
    v_advice := v_advice || 'call_to_confirm';
  end if;

  if v_rules.advance_payment_above is not null
    and v_order.total > v_rules.advance_payment_above
    and not ('take_advance' = any (v_advice)) then
    v_advice := v_advice || 'large_order';
  end if;

  -- ---- whether the software may confirm it without being asked
  if v_rules.organization_id is null or not v_rules.auto_confirm_enabled then
    v_blockers := v_blockers || 'auto_off';
  else
    if v_level in ('high', 'watch') then
      -- Bracketed: || is left-associative, so without them the array would gain
      -- 'risk_' and the level as two separate entries.
      v_blockers := v_blockers || ('risk_' || v_level);
    end if;

    if v_level = 'new' and not v_rules.auto_confirm_new_customers then
      v_blockers := v_blockers || 'new_customer';
    end if;

    if v_rules.auto_confirm_max_total is not null and v_order.total > v_rules.auto_confirm_max_total then
      v_blockers := v_blockers || 'over_cap';
    end if;

    if v_rules.advance_payment_above is not null and v_order.total > v_rules.advance_payment_above then
      v_blockers := v_blockers || 'needs_advance';
    end if;
  end if;

  if array_length(v_blockers, 1) is null then
    v_action := 'auto';
  end if;

  return jsonb_build_object(
    'action', v_action,
    'advice', to_jsonb(v_advice),
    'blockers', to_jsonb(v_blockers),
    'risk_level', v_level,
    'risk', v_risk,
    'total', v_order.total,
    'status', v_order.status
  );
end;
$$;

grant execute on function public.order_confirmation_decision(uuid) to authenticated;

-- ---------------------------------------------------------------- acting on it

-- Called right after an order is created. Returns true only if it really moved.
--
-- A failure here must never lose the order: if stock has run out, or the plan
-- limit trigger objects, the order simply stays new for a person to deal with.
create or replace function public.auto_confirm_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_decision jsonb;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return false; end if;

  if not public.is_org_member(v_order.organization_id) then
    raise exception 'Not a member of this organization' using errcode = 'insufficient_privilege';
  end if;

  if v_order.status <> 'new' then return false; end if;

  v_decision := public.order_confirmation_decision(p_order_id);
  if v_decision ->> 'action' <> 'auto' then return false; end if;

  begin
    perform public.transition_order_status(
      p_order_id, 'confirmed', 'Confirmed automatically by the confirmation rules'
    );
  exception when others then
    -- Not enough stock, or some other guard said no. Leave it for a person.
    return false;
  end;

  return true;
end;
$$;

grant execute on function public.auto_confirm_order(uuid) to authenticated;

-- ---------------------------------------------------------------- row level security

alter table public.order_confirmation_rules enable row level security;

-- Everyone in the organization can see the rules they work under; only the owner
-- changes them, the same way the organization itself is renamed.
drop policy if exists "order_confirmation_rules_select_member" on public.order_confirmation_rules;
create policy "order_confirmation_rules_select_member" on public.order_confirmation_rules
  for select to authenticated using (public.is_org_member(organization_id));

drop policy if exists "order_confirmation_rules_insert_owner" on public.order_confirmation_rules;
create policy "order_confirmation_rules_insert_owner" on public.order_confirmation_rules
  for insert to authenticated with check (public.is_org_owner(organization_id));

drop policy if exists "order_confirmation_rules_update_owner" on public.order_confirmation_rules;
create policy "order_confirmation_rules_update_owner" on public.order_confirmation_rules
  for update to authenticated using (public.is_org_owner(organization_id))
  with check (public.is_org_owner(organization_id));
