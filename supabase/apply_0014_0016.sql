-- ============================================================================
-- Run this whole file in the Supabase SQL editor, in one go.
-- It contains migrations 0014 and 0016 together.
-- Both are safe to run more than once.
-- ============================================================================

-- ============================================================================
-- Customer risk, second pass: the level is decided by rules, not by a threshold
-- on the score.
--
-- Testing 0013 against real orders turned up two results a seller would not
-- accept:
--
--   * Someone who cancelled two of their four orders was labelled "Good record",
--     because cancellations could never push the score past 20 on their own.
--   * Someone whose single order was cancelled could be labelled on the strength
--     of that one order, which is not evidence of anything.
--
-- So the level now says plainly what it means: it follows the return rate, with
-- cancellations as a second signal, and it refuses to judge anyone on too little
-- history. The score stays as a number for display and sorting.
-- ============================================================================

create or replace function public.customer_risk(p_customer_id uuid)
returns jsonb
language plpgsql
stable
as $$
declare
  v_total integer;
  v_delivered integer;
  v_returned integer;
  v_cancelled integer;
  v_settled integer;
  v_return_rate numeric;
  v_cancel_rate numeric;
  v_score integer;
  v_level text;
begin
  select
    count(*),
    count(*) filter (where status = 'delivered'),
    count(*) filter (where status in ('returned', 'refunded')),
    count(*) filter (where status = 'cancelled')
  into v_total, v_delivered, v_returned, v_cancelled
  from public.orders
  where customer_id = p_customer_id;

  -- Parcels that reached a conclusion at the courier. An order still in flight
  -- says nothing yet, either way.
  v_settled := v_delivered + v_returned;

  v_return_rate := case when v_settled > 0 then v_returned::numeric / v_settled else 0 end;
  v_cancel_rate := case when v_total > 0 then v_cancelled::numeric / v_total else 0 end;

  -- A refused parcel costs real money; a cancellation before booking costs time.
  v_score := round(v_return_rate * 70 + v_cancel_rate * 30);

  v_level := case
    when v_total = 0 then 'new'
    -- One or two orders, none of them shipped yet: not enough to judge anyone on.
    when v_settled = 0 and v_total < 3 then 'new'
    -- Two parcels sent and nearly half came back. That is the expensive pattern.
    when v_settled >= 2 and v_return_rate >= 0.4 then 'high'
    when v_settled >= 1 and v_return_rate >= 0.2 then 'watch'
    -- Never shipped anything, but keeps calling orders off.
    when v_total >= 3 and v_cancel_rate >= 0.4 then 'watch'
    else 'good'
  end;

  return jsonb_build_object(
    'level', v_level,
    'score', v_score,
    'total_orders', v_total,
    'delivered', v_delivered,
    'returned', v_returned,
    'cancelled', v_cancelled,
    'settled', v_settled,
    'return_rate', round(v_return_rate * 100),
    'cancel_rate', round(v_cancel_rate * 100)
  );
end;
$$;

grant execute on function public.customer_risk(uuid) to authenticated;

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
