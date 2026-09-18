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
