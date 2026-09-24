-- ============================================================================
-- The business's own phone and address.
--
-- Needed for the invoice that goes inside the parcel: a customer who wants to
-- call about an order should not have to find the Facebook page again. Until
-- now the only thing stored about a business was its name.
--
-- Both are optional. A seller who has not filled them in gets an invoice
-- without them rather than an empty line.
-- ============================================================================

alter table public.organizations
  add column if not exists phone text,
  add column if not exists address text;
