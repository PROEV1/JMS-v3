import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PartnerUser {
  id: string;
  user_id: string;
  partner_id: string;
  role: 'partner_manufacturer' | 'partner_dealer';
  permissions: any;
  partner: {
    id: string;
    name: string;
    partner_type: string;
    logo_url?: string;
    brand_colors: any;
    parent_partner_id?: string;
  };
}

export function usePartnerAuth() {
  const [partnerUser, setPartnerUser] = useState<PartnerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPartnerUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setPartnerUser(null);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('partner_users')
          .select(`
            *,
            partner:partners(
              id,
              name,
              partner_type,
              logo_url,
              brand_colors,
              parent_partner_id
            )
          `)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (error) {
          console.error('Error fetching partner user:', error);
          setPartnerUser(null);
        } else {
          setPartnerUser(data as any);
        }
      } catch (error) {
        console.error('Error in fetchPartnerUser:', error);
        setPartnerUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPartnerUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchPartnerUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  const getAccessiblePartnerIds = (): string[] => {
    if (!partnerUser) return [];
    
    if (partnerUser.role === 'partner_manufacturer') {
      // Manufacturers can access their own data and all dealers under them
      return [partnerUser.partner_id];
    }
    
    // Dealers can only access their own data
    return [partnerUser.partner_id];
  };

  return {
    partnerUser,
    loading,
    isPartnerUser: !!partnerUser,
    isManufacturer: partnerUser?.role === 'partner_manufacturer',
    isDealer: partnerUser?.role === 'partner_dealer',
    getAccessiblePartnerIds,
  };
}