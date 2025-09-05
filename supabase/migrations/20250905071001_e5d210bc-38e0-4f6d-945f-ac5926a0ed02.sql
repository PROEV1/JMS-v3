-- Update RLS policy for engineers to see RMAs they created
DROP POLICY IF EXISTS "Engineers can view RMAs for their items" ON returns_rmas;

CREATE POLICY "Engineers can view RMAs they created or for their items" 
ON returns_rmas 
FOR SELECT 
USING (
  is_admin() OR 
  is_manager() OR 
  created_by = auth.uid() OR
  (EXISTS ( 
    SELECT 1
    FROM engineer_materials_used emu
    JOIN engineers e ON (e.id = emu.engineer_id)
    WHERE e.user_id = auth.uid() AND emu.item_id = returns_rmas.item_id
  ))
);