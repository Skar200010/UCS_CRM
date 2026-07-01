-- Fix CHECK constraint on attendance.status to include 'half-day'
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'late', 'absent', 'half-day', 'leave'));
