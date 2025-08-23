-- Add partner hierarchy and branding
ALTER TABLE partners ADD COLUMN partner_type TEXT NOT NULL DEFAULT 'dealer';
ALTER TABLE partners ADD COLUMN parent_partner_id UUID REFERENCES partners(id);
ALTER TABLE partners ADD COLUMN logo_url TEXT;
ALTER TABLE partners ADD COLUMN brand_colors JSONB DEFAULT '{"primary": "#2563eb", "secondary": "#64748b"}'::jsonb;
ALTER TABLE partners ADD COLUMN portal_subdomain TEXT UNIQUE;

-- Create partner users table
CREATE TABLE partner_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('partner_manufacturer', 'partner_dealer')),
  permissions JSONB DEFAULT '{"can_upload": true, "can_view_jobs": true}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, partner_id)
);

-- Enable RLS on partner_users
ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;

-- Create function to check partner user role
CREATE OR REPLACE FUNCTION get_partner_user_role(user_uuid UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT role FROM partner_users 
  WHERE user_id = user_uuid AND is_active = true
  LIMIT 1;
$$;

-- Create function to get partner user's partner_id
CREATE OR REPLACE FUNCTION get_partner_user_partner_id(user_uuid UUID)
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT partner_id FROM partner_users 
  WHERE user_id = user_uuid AND is_active = true
  LIMIT 1;
$$;

-- Create function to check if user can access partner data
CREATE OR REPLACE FUNCTION can_access_partner_data(user_uuid UUID, target_partner_id UUID)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
STABLE SECURITY DEFINER
AS $$
DECLARE
  user_partner_id UUID;
  user_role TEXT;
BEGIN
  -- Get user's partner info
  SELECT partner_id, role INTO user_partner_id, user_role
  FROM partner_users 
  WHERE user_id = user_uuid AND is_active = true;
  
  IF user_partner_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Manufacturer can see their own data and all dealer data under them
  IF user_role = 'partner_manufacturer' THEN
    RETURN target_partner_id = user_partner_id OR 
           EXISTS (SELECT 1 FROM partners WHERE id = target_partner_id AND parent_partner_id = user_partner_id);
  END IF;
  
  -- Dealer can only see their own data
  IF user_role = 'partner_dealer' THEN
    RETURN target_partner_id = user_partner_id;
  END IF;
  
  RETURN false;
END;
$$;

-- RLS Policies for partner_users
CREATE POLICY "Partner users can view their own record"
ON partner_users FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all partner users"
ON partner_users FOR ALL
USING (is_admin());

-- Update orders RLS to allow partner users to view their jobs
CREATE POLICY "Partner users can view their partner jobs"
ON orders FOR SELECT
USING (
  is_partner_job = true AND 
  can_access_partner_data(auth.uid(), partner_id)
);

-- Update clients RLS for partner access
CREATE POLICY "Partner users can view clients for their jobs"
ON clients FOR SELECT
USING (
  is_partner_client = true AND 
  can_access_partner_data(auth.uid(), partner_id)
);

-- Create partner job uploads table
CREATE TABLE partner_job_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  file_name TEXT NOT NULL,
  file_url TEXT,
  upload_type TEXT NOT NULL CHECK (upload_type IN ('csv', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  error_details JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE partner_job_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner users can manage uploads for their partner"
ON partner_job_uploads FOR ALL
USING (can_access_partner_data(auth.uid(), partner_id));

-- Add trigger for updated_at
CREATE TRIGGER update_partner_users_updated_at
  BEFORE UPDATE ON partner_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for updated_at on partners
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();