-- ============================================
-- ASSET REGISTER TABLE (Supabase SQL Editor mein run karo)
-- ============================================

create table if not exists assets (
  id                uuid primary key default gen_random_uuid(),
  code              text unique,                 -- AST-001
  name              text not null,               -- Laptop, Chair, SIM Card...
  category          text,                        -- Electronics, Furniture, Safety...
  brand             text,                        -- Dell, Samsung...
  model             text,
  serial_no         text,                        -- Serial number / IMEI
  department        text,                        -- FRO, Accounts, HR...
  condition         text default 'New',          -- New / Good / Average / Damaged
  status            text default 'available',    -- available / assigned / repair / not_working / lost / scrapped
  assigned_to       uuid,                        -- worker/user id (optional link)
  assigned_to_name  text,
  assigned_date     date,
  purchase_date     date,
  purchase_price    numeric default 0,
  vendor            text,
  warranty_expiry   date,
  sim_number        text,                        -- SIM ka mobile number
  sim_operator      text,                        -- Jio / Airtel / Vi / BSNL
  sim_plan          numeric,                     -- monthly plan ₹
  repair_shop       text,
  repair_cost       numeric,
  repair_date       date,
  total_repair_cost numeric default 0,
  remarks           text,
  history           jsonb default '[]'::jsonb,   -- [{ "date": "2026-07-06", "text": "Assigned to Ramesh" }]
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- search fast karne ke liye indexes
create index if not exists idx_assets_status on assets(status);
create index if not exists idx_assets_category on assets(category);
create index if not exists idx_assets_department on assets(department);

-- NOTE (RLS):
-- Agar aapka Express backend Supabase ka SERVICE ROLE key use karta hai
-- (jo ki backend ke liye normal hai), toh RLS ki tension nahi.
-- Agar anon key use ho raha hai toh ye policy add karo:
--
-- alter table assets enable row level security;
-- create policy "assets all access" on assets for all using (true) with check (true);
