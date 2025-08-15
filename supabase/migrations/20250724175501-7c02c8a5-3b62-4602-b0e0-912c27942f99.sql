-- Fix the remaining function search path warning
ALTER FUNCTION public.get_user_role(uuid) SET search_path = 'public';
ALTER FUNCTION public.generate_share_token() SET search_path = 'public';