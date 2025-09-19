-- Add dispatched_by field to track who marked as dispatched
ALTER TABLE public.charger_dispatches 
ADD COLUMN dispatched_by uuid REFERENCES auth.users(id);