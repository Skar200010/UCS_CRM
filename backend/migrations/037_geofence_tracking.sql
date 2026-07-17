-- Migration 037: Add geofence tracking columns to attendance
-- Run this in Supabase SQL Editor

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS geofence_exit_time TIMESTAMPTZ;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_out_of_geofence BOOLEAN DEFAULT false;
