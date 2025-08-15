-- Fix security linter warnings by setting search_path for functions
ALTER FUNCTION public.generate_quote_number() SET search_path = 'public';
ALTER FUNCTION public.update_updated_at_column() SET search_path = 'public';
ALTER FUNCTION public.handle_new_user() SET search_path = 'public';