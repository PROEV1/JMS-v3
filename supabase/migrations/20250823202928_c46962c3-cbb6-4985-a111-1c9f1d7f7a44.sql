-- Create a partner first (if one doesn't exist)
INSERT INTO public.partners (id, name, partner_type, brand_colors, client_payment_required, client_agreement_required)
VALUES (
  gen_random_uuid(),
  'Test Partner Company', 
  'dealer',
  '{"primary": "#dc2626", "secondary": "#1e293b"}'::jsonb,
  true,
  true
)
ON CONFLICT DO NOTHING;

-- Get the partner ID we just created or use existing
DO $$
DECLARE
  partner_uuid UUID;
  user_uuid UUID := 'c0573782-efa5-474d-a96f-0191b4c3bc4c'::UUID;
BEGIN
  -- Get or create partner
  SELECT id INTO partner_uuid FROM public.partners WHERE name = 'Test Partner Company' LIMIT 1;
  
  -- Create partner user record for pconstable@gmx.com
  INSERT INTO public.partner_users (
    user_id,
    partner_id,
    role,
    is_active,
    permissions
  ) VALUES (
    user_uuid,
    partner_uuid,
    'partner_dealer',
    true,
    '{"can_upload": true, "can_view_jobs": true, "can_create_jobs": true}'::jsonb
  )
  ON CONFLICT (user_id, partner_id) DO UPDATE SET
    is_active = true,
    permissions = EXCLUDED.permissions;
END $$;