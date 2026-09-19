-- ============================================================================
-- Fixes order_confirmation_decision() from 0015, which failed at runtime with
--   malformed array literal: "take_advance"
--
-- `v_advice || 'take_advance'` looks like appending a string, but with a text[]
-- on the left Postgres picks the array || array operator and tries to read the
-- literal as an array. array_append() says what was meant and leaves no room for
-- the parser to guess.
-- ============================================================================

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
    v_advice := array_append(v_advice, 'take_advance');
  elsif v_level = 'watch' then
    v_advice := array_append(v_advice, 'call_to_confirm');
  end if;

  if v_rules.advance_payment_above is not null
    and v_order.total > v_rules.advance_payment_above
    and not ('take_advance' = any (v_advice)) then
    v_advice := array_append(v_advice, 'large_order');
  end if;

  -- ---- whether the software may confirm it without being asked
  if v_rules.organization_id is null or not v_rules.auto_confirm_enabled then
    v_blockers := array_append(v_blockers, 'auto_off');
  else
    if v_level in ('high', 'watch') then
      v_blockers := array_append(v_blockers, 'risk_' || v_level);
    end if;

    if v_level = 'new' and not v_rules.auto_confirm_new_customers then
      v_blockers := array_append(v_blockers, 'new_customer');
    end if;

    if v_rules.auto_confirm_max_total is not null and v_order.total > v_rules.auto_confirm_max_total then
      v_blockers := array_append(v_blockers, 'over_cap');
    end if;

    if v_rules.advance_payment_above is not null and v_order.total > v_rules.advance_payment_above then
      v_blockers := array_append(v_blockers, 'needs_advance');
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
