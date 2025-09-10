import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type UserRole = 'admin' | 'client' | 'engineer' | 'manager' | 'standard_office_user' | 'partner' | null;

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      console.log('useUserRole: Starting fetch, user:', user);
      console.log('useUserRole: User ID:', user?.id);
      console.log('useUserRole: User email:', user?.email);
      
      if (!user?.id) {
        console.log('useUserRole: No user ID, setting role to null');
        setRole(null);
        setLoading(false);
        return;
      }

      // Set loading to true when we have a user but need to fetch role
      setLoading(true);

      try {
        console.log('useUserRole: Fetching role for user ID:', user.id);
        
        // Fetch both partner and profile data in parallel
        const [partnerResult, profileResult] = await Promise.all([
          supabase
            .from('partner_users')
            .select('partner_id, role')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('role, status')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        ]);

        const { data: partnerUser, error: partnerError } = partnerResult;
        const { data: profileData, error: profileError } = profileResult;

        console.log('useUserRole: Partner user check:', { partnerUser, partnerError });
        console.log('useUserRole: Profile query result:', { profileData, profileError });

        if (profileError) {
          console.error('useUserRole: Profile database error:', profileError);
          throw profileError;
        }

        // Apply role precedence: admin/manager first, then partner, then others
        let finalRole: UserRole = null;

        // Check profile role first - all profile roles take precedence over partner roles
        if (profileData && profileData.status === 'active') {
          const profileRole = profileData.role as UserRole;
          console.log('useUserRole: Found active profile, role:', profileRole);
          finalRole = profileRole;
          console.log('useUserRole: Setting profile role as final:', finalRole);
        }

        // Only check for partner role if no profile role exists
        if (!finalRole) {
          if (partnerUser && !partnerError) {
            console.log('useUserRole: User is a partner, considering partner role');
            finalRole = 'partner';
          }
        }

        console.log('useUserRole: After partner check, finalRole:', finalRole);

        console.log('useUserRole: Final role determined:', finalRole);
        setRole(finalRole);
      } catch (error) {
        console.error('useUserRole: Error fetching user role:', error);
        setRole(null);
      } finally {
        setLoading(false);
        console.log('useUserRole: Finished loading');
      }
    };

    fetchUserRole();
  }, [user?.id]);

  return { role, loading };
}