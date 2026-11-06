-- =====================================================================
-- Chalao (F-Commerce OS) — MySQL / MariaDB schema for cPanel hosting
--
-- Import this file once in phpMyAdmin (select your database, then Import).
-- Safe to re-run: every statement uses IF NOT EXISTS / INSERT IGNORE.
-- Works on MySQL 5.7+, MySQL 8 and MariaDB 10.3+.
--
-- No triggers, stored procedures or functions are used, because most shared
-- hosts do not allow them. All business rules live in the application code.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(191) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_sign_in_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_email_key (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL,
  full_name VARCHAR(255) NULL,
  avatar_url TEXT NULL,
  language VARCHAR(8) NOT NULL DEFAULT 'en',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT profiles_user_fk FOREIGN KEY (id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS platform_admins (
  user_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT platform_admins_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
  id SMALLINT NOT NULL DEFAULT 1,
  facebook_url TEXT NULL,
  instagram_url TEXT NULL,
  youtube_url TEXT NULL,
  tiktok_url TEXT NULL,
  linkedin_url TEXT NULL,
  whatsapp_url TEXT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  business_type VARCHAR(32) NOT NULL DEFAULT 'other',
  order_seq BIGINT NOT NULL DEFAULT 1000,
  phone VARCHAR(64) NULL,
  address TEXT NULL,
  logo_url TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_members (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role VARCHAR(16) NOT NULL DEFAULT 'staff',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY organization_members_org_user_key (organization_id, user_id),
  KEY organization_members_user_idx (user_id),
  CONSTRAINT organization_members_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT organization_members_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stores (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  facebook_page_url TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY stores_org_idx (organization_id),
  CONSTRAINT stores_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(191) NULL,
  category VARCHAR(255) NULL,
  description TEXT NULL,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY products_org_sku_key (organization_id, sku),
  KEY products_org_active_idx (organization_id, is_active),
  CONSTRAINT products_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_variants (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT 'Default',
  sku VARCHAR(191) NULL,
  stock INT NOT NULL DEFAULT 0,
  cost_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY product_variants_org_sku_key (organization_id, sku),
  KEY product_variants_product_idx (product_id),
  KEY product_variants_org_idx (organization_id),
  CONSTRAINT product_variants_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT product_variants_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  alt_phone VARCHAR(64) NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  district VARCHAR(128) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY customers_org_phone_key (organization_id, phone),
  KEY customers_org_created_idx (organization_id, created_at),
  CONSTRAINT customers_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Inbox (channels, conversations, messages)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_connections (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  external_id VARCHAR(191) NOT NULL,
  label VARCHAR(191) NOT NULL DEFAULT 'Default',
  credentials_enc LONGTEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  webhook_token VARCHAR(64) NOT NULL,
  last_event_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY channel_connections_provider_external_key (provider, external_id),
  UNIQUE KEY channel_connections_webhook_token_key (webhook_token),
  KEY channel_connections_org_idx (organization_id),
  CONSTRAINT channel_connections_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversations (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  channel_connection_id CHAR(36) NOT NULL,
  external_id VARCHAR(191) NOT NULL,
  customer_id CHAR(36) NULL,
  contact_name VARCHAR(255) NULL,
  contact_handle VARCHAR(255) NULL,
  contact_avatar_url TEXT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  assigned_to CHAR(36) NULL,
  unread_count INT NOT NULL DEFAULT 0,
  last_message_at DATETIME(3) NULL,
  last_message_preview VARCHAR(255) NULL,
  last_inbound_at DATETIME(3) NULL,
  snoozed_until DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY conversations_channel_external_key (channel_connection_id, external_id),
  KEY conversations_org_recent_idx (organization_id, last_message_at),
  KEY conversations_org_status_idx (organization_id, status, last_message_at),
  KEY conversations_customer_idx (organization_id, customer_id),
  CONSTRAINT conversations_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT conversations_channel_fk FOREIGN KEY (channel_connection_id) REFERENCES channel_connections (id) ON DELETE CASCADE,
  CONSTRAINT conversations_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT conversations_assigned_fk FOREIGN KEY (assigned_to) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  conversation_id CHAR(36) NOT NULL,
  direction VARCHAR(16) NOT NULL,
  author VARCHAR(16) NOT NULL,
  author_user_id CHAR(36) NULL,
  body LONGTEXT NULL,
  attachments LONGTEXT NOT NULL COMMENT 'json',
  external_id VARCHAR(191) NULL,
  delivery VARCHAR(16) NOT NULL DEFAULT 'received',
  error TEXT NULL,
  payload LONGTEXT NULL COMMENT 'json',
  sent_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY messages_external_key (conversation_id, external_id),
  KEY messages_conversation_idx (conversation_id, created_at),
  CONSTRAINT messages_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT messages_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE,
  CONSTRAINT messages_author_fk FOREIGN KEY (author_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  store_id CHAR(36) NULL,
  customer_id CHAR(36) NOT NULL,
  conversation_id CHAR(36) NULL,
  order_number BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'new',
  source VARCHAR(16) NOT NULL DEFAULT 'manual',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_address TEXT NULL,
  district VARCHAR(128) NULL,
  notes TEXT NULL,
  created_by CHAR(36) NULL,
  confirmed_at DATETIME(3) NULL,
  shipped_at DATETIME(3) NULL,
  delivered_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY orders_org_number_key (organization_id, order_number),
  KEY orders_org_created_idx (organization_id, created_at),
  KEY orders_org_status_idx (organization_id, status),
  KEY orders_customer_idx (customer_id),
  KEY orders_conversation_idx (conversation_id),
  CONSTRAINT orders_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT orders_store_fk FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE SET NULL,
  CONSTRAINT orders_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT,
  CONSTRAINT orders_conversation_fk FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE SET NULL,
  CONSTRAINT orders_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NULL,
  variant_id CHAR(36) NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_name VARCHAR(255) NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY order_items_order_idx (order_id),
  KEY order_items_variant_idx (variant_id),
  CONSTRAINT order_items_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT order_items_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_fk FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL,
  CONSTRAINT order_items_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only ledger (the application never updates or deletes these rows).
CREATE TABLE IF NOT EXISTS order_status_history (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  from_status VARCHAR(16) NULL,
  to_status VARCHAR(16) NOT NULL,
  note TEXT NULL,
  changed_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY order_status_history_order_idx (order_id, created_at),
  CONSTRAINT order_status_history_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT order_status_history_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
  CONSTRAINT order_status_history_user_fk FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only ledger. product_variants.stock is derived from these rows.
CREATE TABLE IF NOT EXISTS inventory_movements (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  variant_id CHAR(36) NOT NULL,
  movement_type VARCHAR(24) NOT NULL,
  quantity_change INT NOT NULL,
  stock_after INT NOT NULL,
  order_id CHAR(36) NULL,
  note TEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY inventory_movements_org_idx (organization_id, created_at),
  KEY inventory_movements_variant_idx (variant_id, created_at),
  CONSTRAINT inventory_movements_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT inventory_movements_variant_fk FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE RESTRICT,
  CONSTRAINT inventory_movements_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
  CONSTRAINT inventory_movements_user_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Couriers & shipments
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courier_accounts (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  label VARCHAR(191) NOT NULL DEFAULT 'Default',
  credentials_enc LONGTEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_tested_at DATETIME(3) NULL,
  webhook_token VARCHAR(64) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY courier_accounts_org_provider_label_key (organization_id, provider, label),
  UNIQUE KEY courier_accounts_webhook_token_key (webhook_token),
  KEY courier_accounts_org_idx (organization_id),
  CONSTRAINT courier_accounts_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shipments (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  courier_account_id CHAR(36) NULL,
  provider VARCHAR(32) NOT NULL,
  consignment_id VARCHAR(191) NULL,
  tracking_code VARCHAR(191) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  cod_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  weight_grams INT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  recipient_phone VARCHAR(64) NOT NULL,
  recipient_address TEXT NOT NULL,
  district VARCHAR(128) NULL,
  booking_error TEXT NULL,
  last_event_at DATETIME(3) NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY shipments_provider_consignment_key (provider, consignment_id),
  KEY shipments_org_created_idx (organization_id, created_at),
  KEY shipments_order_idx (order_id),
  CONSTRAINT shipments_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT shipments_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT shipments_courier_fk FOREIGN KEY (courier_account_id) REFERENCES courier_accounts (id) ON DELETE SET NULL,
  CONSTRAINT shipments_user_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only ledger of courier webhook callbacks.
CREATE TABLE IF NOT EXISTS shipment_events (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  shipment_id CHAR(36) NOT NULL,
  provider_status VARCHAR(191) NULL,
  mapped_status VARCHAR(24) NOT NULL,
  payload LONGTEXT NULL COMMENT 'json',
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY shipment_events_shipment_idx (shipment_id, occurred_at),
  CONSTRAINT shipment_events_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT shipment_events_shipment_fk FOREIGN KEY (shipment_id) REFERENCES shipments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- COD reconciliation
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courier_payouts (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  courier_account_id CHAR(36) NULL,
  provider VARCHAR(32) NOT NULL,
  reference VARCHAR(191) NULL,
  paid_on DATE NOT NULL,
  amount_received DECIMAL(12,2) NOT NULL,
  method VARCHAR(16) NOT NULL DEFAULT 'bank',
  note TEXT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY courier_payouts_org_idx (organization_id, paid_on),
  CONSTRAINT courier_payouts_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT courier_payouts_courier_fk FOREIGN KEY (courier_account_id) REFERENCES courier_accounts (id) ON DELETE SET NULL,
  CONSTRAINT courier_payouts_user_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courier_payout_items (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  payout_id CHAR(36) NOT NULL,
  shipment_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  cod_amount DECIMAL(12,2) NOT NULL,
  delivery_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  cod_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
  adjustment DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY courier_payout_items_shipment_key (shipment_id),
  KEY courier_payout_items_payout_idx (payout_id),
  CONSTRAINT courier_payout_items_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT courier_payout_items_payout_fk FOREIGN KEY (payout_id) REFERENCES courier_payouts (id) ON DELETE CASCADE,
  CONSTRAINT courier_payout_items_shipment_fk FOREIGN KEY (shipment_id) REFERENCES shipments (id) ON DELETE RESTRICT,
  CONSTRAINT courier_payout_items_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Delivered parcels not yet covered by any payout.
CREATE OR REPLACE VIEW cod_unsettled_shipments AS
SELECT
  s.id AS shipment_id,
  s.organization_id,
  s.order_id,
  o.order_number,
  s.provider,
  s.courier_account_id,
  s.consignment_id,
  s.tracking_code,
  s.cod_amount,
  s.recipient_name,
  s.district,
  s.last_event_at,
  s.created_at
FROM shipments s
JOIN orders o ON o.id = s.order_id
WHERE s.status = 'delivered'
  AND NOT EXISTS (SELECT 1 FROM courier_payout_items i WHERE i.shipment_id = s.id);

-- ---------------------------------------------------------------------
-- Returns
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_returns (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  order_id CHAR(36) NOT NULL,
  shipment_id CHAR(36) NULL,
  reason VARCHAR(24) NOT NULL DEFAULT 'other',
  return_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  restocked TINYINT(1) NOT NULL DEFAULT 1,
  note TEXT NULL,
  recorded_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY order_returns_order_key (order_id),
  KEY order_returns_org_idx (organization_id, created_at),
  CONSTRAINT order_returns_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT order_returns_order_fk FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT order_returns_shipment_fk FOREIGN KEY (shipment_id) REFERENCES shipments (id) ON DELETE SET NULL,
  CONSTRAINT order_returns_user_fk FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Order confirmation rules, team invitations, audit log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_confirmation_rules (
  organization_id CHAR(36) NOT NULL,
  auto_confirm_enabled TINYINT(1) NOT NULL DEFAULT 0,
  auto_confirm_max_total DECIMAL(12,2) NULL,
  auto_confirm_new_customers TINYINT(1) NOT NULL DEFAULT 0,
  advance_payment_above DECIMAL(12,2) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (organization_id),
  CONSTRAINT order_confirmation_rules_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_invitations (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  email VARCHAR(191) NOT NULL,
  role VARCHAR(16) NOT NULL,
  token VARCHAR(96) NOT NULL,
  invited_by CHAR(36) NULL,
  expires_at DATETIME(3) NOT NULL,
  accepted_at DATETIME(3) NULL,
  accepted_by CHAR(36) NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY organization_invitations_token_key (token),
  KEY organization_invitations_org_idx (organization_id, created_at),
  CONSTRAINT organization_invitations_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT organization_invitations_invited_fk FOREIGN KEY (invited_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT organization_invitations_accepted_fk FOREIGN KEY (accepted_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_events (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  actor CHAR(36) NULL,
  action VARCHAR(191) NOT NULL,
  entity VARCHAR(191) NULL,
  entity_id CHAR(36) NULL,
  detail LONGTEXT NULL COMMENT 'json',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY audit_events_org_idx (organization_id, created_at),
  CONSTRAINT audit_events_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT audit_events_actor_fk FOREIGN KEY (actor) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Subscriptions
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  code VARCHAR(64) NOT NULL,
  name VARCHAR(191) NOT NULL,
  tagline VARCHAR(255) NULL,
  monthly_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  order_limit INT NULL,
  user_limit INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS organization_subscriptions (
  organization_id CHAR(36) NOT NULL,
  plan_code VARCHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  current_period_start DATE NULL,
  current_period_end DATE NULL,
  note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (organization_id),
  CONSTRAINT organization_subscriptions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT organization_subscriptions_plan_fk FOREIGN KEY (plan_code) REFERENCES subscription_plans (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_submissions (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  plan_code VARCHAR(64) NOT NULL,
  months SMALLINT NOT NULL DEFAULT 1,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(16) NOT NULL,
  sender_number VARCHAR(64) NULL,
  transaction_id VARCHAR(191) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  submitted_by CHAR(36) NULL,
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME(3) NULL,
  review_note TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY payment_submissions_org_idx (organization_id, created_at),
  KEY payment_submissions_pending_idx (status, created_at),
  KEY payment_submissions_txn_idx (transaction_id),
  CONSTRAINT payment_submissions_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT payment_submissions_plan_fk FOREIGN KEY (plan_code) REFERENCES subscription_plans (code),
  CONSTRAINT payment_submissions_submitted_fk FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT payment_submissions_reviewed_fk FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_payments (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  submission_id CHAR(36) NULL,
  plan_code VARCHAR(64) NOT NULL,
  months SMALLINT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(16) NOT NULL,
  transaction_id VARCHAR(191) NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  recorded_by CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY subscription_payments_org_idx (organization_id, created_at),
  CONSTRAINT subscription_payments_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT subscription_payments_submission_fk FOREIGN KEY (submission_id) REFERENCES payment_submissions (id) ON DELETE SET NULL,
  CONSTRAINT subscription_payments_plan_fk FOREIGN KEY (plan_code) REFERENCES subscription_plans (code),
  CONSTRAINT subscription_payments_user_fk FOREIGN KEY (recorded_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS subscription_events (
  id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  detail LONGTEXT NULL COMMENT 'json',
  note TEXT NULL,
  actor CHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY subscription_events_org_idx (organization_id, created_at),
  CONSTRAINT subscription_events_org_fk FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE,
  CONSTRAINT subscription_events_actor_fk FOREIGN KEY (actor) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------
INSERT IGNORE INTO subscription_plans
  (code, name, tagline, monthly_price, order_limit, user_limit, is_featured, sort_order)
VALUES
  ('free',     'Free',     'For sellers just getting started',   0,    50,   1,  0, 1),
  ('starter',  'Starter',  'For pages with regular orders',      990,  500,  2,  0, 2),
  ('growth',   'Growth',   'For fast-growing businesses',        2490, 2000, 5,  1, 3),
  ('business', 'Business', 'For bigger teams and higher volume', 4990, NULL, 15, 0, 4);

INSERT IGNORE INTO site_settings (id) VALUES (1);
