-- Migration: Create attendance_corrections table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(id) NOT NULL,
  attendance_id UUID REFERENCES attendance(id) NOT NULL,
  date DATE NOT NULL,
  field TEXT NOT NULL CHECK (field IN ('punch_in', 'punch_out')),
  requested_time TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'hr_verified', 'approved', 'rejected')),
  hr_remark TEXT,
  admin_remark TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_corrections_worker_id ON attendance_corrections(worker_id);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_status ON attendance_corrections(status);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_attendance_id ON attendance_corrections(attendance_id);
