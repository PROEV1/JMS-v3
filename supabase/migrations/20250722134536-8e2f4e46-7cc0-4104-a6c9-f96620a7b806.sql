-- Add DELETE policy for admins on messages table
CREATE POLICY "Admins can delete all messages" 
ON public.messages 
FOR DELETE 
USING (get_user_role(auth.uid()) = 'admin'::user_role);