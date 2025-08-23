import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PartnerUser {
  id: string;
  user_id: string;
  partner_id: string;
  role: 'partner_manufacturer' | 'partner_dealer' | 'partner_charger_manufacturer';
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

        // First get partner user
        const { data: partnerUserData, error: partnerUserError } = await supabase
          .from('partner_users')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (partnerUserError) {
          console.error('Error fetching partner user:', partnerUserError);
          setPartnerUser(null);
          setLoading(false);
          return;
        }

        if (!partnerUserData) {
          console.log('User is authenticated but has no partner_users record. User ID:', user.id);
          setPartnerUser(null);
          setLoading(false);
          return;
        }

        // Then get partner details
        const { data: partnerData, error: partnerError } = await supabase
          .from('partners')
          .select('id, name, partner_type, logo_url, brand_colors, parent_partner_id')
          .eq('id', partnerUserData.partner_id)
          .maybeSingle();

        if (partnerError) {
          console.error('Error fetching partner:', partnerError);
          setPartnerUser(null);
          setLoading(false);
          return;
        }

        if (!partnerData) {
          console.error('Partner record not found for partner_id:', partnerUserData.partner_id);
          setPartnerUser(null);
          setLoading(false);
          return;
        }

        // Combine the data
        const data = {
          ...partnerUserData,
          partner: partnerData
        };

        console.log('Found partner user:', data);
        setPartnerUser(data as any);
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
    
    if (partnerUser.role === 'partner_manufacturer' || partnerUser.role === 'partner_charger_manufacturer') {
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
    isManufacturer: partnerUser?.role === 'partner_manufacturer' || partnerUser?.role === 'partner_charger_manufacturer',
    isDealer: partnerUser?.role === 'partner_dealer',
    getAccessiblePartnerIds,
  };
}