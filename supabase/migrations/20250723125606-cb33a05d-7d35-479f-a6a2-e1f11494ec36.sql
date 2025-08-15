-- Drop the foreign key constraint that references auth.users
-- This allows us to have clients without user accounts
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_user_id_fkey;