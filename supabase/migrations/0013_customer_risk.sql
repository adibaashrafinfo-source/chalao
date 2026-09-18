-- ============================================================================
-- Customer risk, and the link from a conversation to the order it produced.
--
-- Cash on delivery is the whole business here, and a refused parcel costs the
-- seller the courier fee both ways. So before confirming an order, the one thing
-- worth knowing is how this person's past parcels ended.
--
-- The score is deliberately plain arithmetic over the order history — no model,
-- no guesswork. It returns the counts it used, so a screen can say why, and a
-- seller can disagree with it.
-- ============================================================================

-- Which conversation an order came out of, when it came from the inbox.
alter table public.orders
  add column if not exists conversation_id uuid references public.conversations (id) on delete set null;

create index if not exists orders_conversation_idx
  on public.orders (conversation_id)
  where conversation_id is not null;

-- Security INVOKER on purpose: it reads the caller's own orders through RLS, so
-- it can never total up another organization's history.
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
  -- Hence the heavier weight on returns.
  v_score := round(v_return_rate * 70 + v_cancel_rate * 30);

  v_level := case
    when v_total = 0 then 'new'
    when v_score >= 50 then 'high'
    when v_score >= 20 then 'watch'
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
