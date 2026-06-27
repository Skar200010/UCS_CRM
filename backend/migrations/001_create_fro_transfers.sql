-- Migration: Create fro_transfers table with TEXT columns for UUID compatibility
-- Run this in Supabase SQL Editor

DROP TABLE IF EXISTS fro_transfers CASCADE;

CREATE TABLE fro_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station TEXT NOT NULL,
  source_fro_worker_id TEXT,
  target_fro_worker_id TEXT,
  target_station TEXT NOT NULL,
  ngo_id TEXT,
  donor_count INTEGER DEFAULT 0,
  donor_ids JSONB DEFAULT '[]'::jsonb,
  returned BOOLEAN DEFAULT FALSE,
  auto_return_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);
