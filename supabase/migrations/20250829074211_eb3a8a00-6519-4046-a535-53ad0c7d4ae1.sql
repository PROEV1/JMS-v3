-- Add audit tracking for inventory transactions
CREATE TYPE txn_audit_action AS ENUM ('created', 'approved', 'rejected', 'modified', 'deleted');

-- Create audit table for transaction tracking
CREATE TABLE inventory_txn_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_id UUID REFERENCES inventory_txns(id) ON DELETE CASCADE,
  action txn_audit_action NOT NULL,
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add approval status to transactions
ALTER TABLE inventory_txns ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE inventory_txns ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE inventory_txns ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inventory_txns ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Enable RLS on audit table
ALTER TABLE inventory_txn_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit table
CREATE POLICY "Admins can view all audit logs" ON inventory_txn_audit
  FOR SELECT USING (is_admin());

CREATE POLICY "Admins can create audit logs" ON inventory_txn_audit
  FOR INSERT WITH CHECK (is_admin());

-- Create trigger function for automatic audit logging
CREATE OR REPLACE FUNCTION log_inventory_txn_audit()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO inventory_txn_audit (txn_id, action, new_data, performed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO inventory_txn_audit (txn_id, action, old_data, new_data, performed_by)
      VALUES (
        NEW.id, 
        CASE 
          WHEN NEW.status = 'approved' THEN 'approved'::txn_audit_action
          WHEN NEW.status = 'rejected' THEN 'rejected'::txn_audit_action
          ELSE 'modified'::txn_audit_action
        END,
        jsonb_build_object('status', OLD.status, 'old_data', to_jsonb(OLD)),
        jsonb_build_object('status', NEW.status, 'new_data', to_jsonb(NEW)),
        auth.uid()
      );
    ELSE
      -- Log other modifications
      INSERT INTO inventory_txn_audit (txn_id, action, old_data, new_data, performed_by)
      VALUES (NEW.id, 'modified', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO inventory_txn_audit (txn_id, action, old_data, performed_by)
    VALUES (OLD.id, 'deleted', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
CREATE TRIGGER inventory_txn_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON inventory_txns
  FOR EACH ROW EXECUTE FUNCTION log_inventory_txn_audit();

-- Create function to approve/reject transactions
CREATE OR REPLACE FUNCTION approve_inventory_transaction(
  p_txn_id UUID,
  p_action TEXT, -- 'approve' or 'reject'
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only admins can approve/reject
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  -- Validate action
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid action. Must be "approve" or "reject"';
  END IF;

  -- Update transaction
  UPDATE inventory_txns 
  SET 
    status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    approved_by = auth.uid(),
    approved_at = now(),
    rejection_reason = CASE WHEN p_action = 'reject' THEN p_reason ELSE NULL END,
    updated_at = now()
  WHERE id = p_txn_id;

  -- Log the audit entry with reason
  INSERT INTO inventory_txn_audit (txn_id, action, reason, performed_by)
  VALUES (
    p_txn_id,
    CASE WHEN p_action = 'approve' THEN 'approved'::txn_audit_action ELSE 'rejected'::txn_audit_action END,
    p_reason,
    auth.uid()
  );

  RETURN TRUE;
END;
$$;