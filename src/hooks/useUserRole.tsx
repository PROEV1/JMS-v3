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
        
        // First check if user is a partner user (prevent 406 errors)
        const { data: partnerUser, error: partnerError } = await supabase
          .from('partner_users')
          .select('partner_id, role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('useUserRole: Partner user check:', { partnerUser, partnerError });

        // If they're a partner user, return 'partner' role
        if (partnerUser) {
          console.log('useUserRole: User is a partner, setting role to partner');
          setRole('partner');
          setLoading(false);
          return;
        }

        // Otherwise check their profile role (prevent 406 errors)
        const { data, error } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('useUserRole: Profile query result:', { data, error });

        if (error) {
          console.error('useUserRole: Database error:', error);
          throw error;
        }
        
        if (data) {
          console.log('useUserRole: Found profile, role:', data.role, 'status:', data.status);
          if (data.status === 'active') {
            setRole(data.role as UserRole);
            console.log('useUserRole: Set role to:', data.role);
          } else {
            console.log('useUserRole: User is inactive, setting role to null');
            setRole(null);
          }
        } else {
          console.log('useUserRole: No profile found, setting role to null');
          setRole(null);
        }
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