-- Inventory history must survive catalogue edits (Brief §10, "audit-first").
-- Originally inventory_movements.variant_id cascaded, so deleting a variant (or the
-- product above it) silently erased its stock ledger. Restrict it instead: a variant
-- that has ever moved stock can no longer be deleted, only deactivated.

alter table public.inventory_movements
  drop constraint if exists inventory_movements_variant_id_fkey;

alter table public.inventory_movements
  add constraint inventory_movements_variant_id_fkey
  foreign key (variant_id) references public.product_variants (id) on delete restrict;

-- Same reasoning for the order ledger: keep history, block the delete.
alter table public.order_status_history
  drop constraint if exists order_status_history_order_id_fkey;

alter table public.order_status_history
  add constraint order_status_history_order_id_fkey
  foreign key (order_id) references public.orders (id) on delete restrict;

-- Variants can be retired without being deleted.
comment on column public.product_variants.is_active is
  'Retire a variant by setting this to false; deletion is blocked once it has stock history.';
