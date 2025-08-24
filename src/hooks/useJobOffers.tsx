import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface JobOffer {
  id: string;
  order_id: string;
  engineer_id: string;
  offered_date: string;
  time_window?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at: string;
  client_token: string;
  delivery_channel: string;
  rejection_reason?: string;
  accepted_at?: string;
  rejected_at?: string;
  expired_at?: string;
  created_at: string;
  order?: {
    order_number: string;
    client_id: string;
    client?: {
      full_name: string;
      email: string;
    };
  };
  engineer?: {
    name: string;
    email: string;
  };
}

export function useJobOffers(orderId?: string) {
  const [offers, setOffers] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('job_offers')
        .select(`
          *,
          order:orders!job_offers_order_id_fkey(
            order_number,
            client_id,
            client:clients(full_name, email)
          ),
          engineer:engineers!job_offers_engineer_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false });

      if (orderId) {
        query = query.eq('order_id', orderId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setOffers(data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching job offers:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, [orderId]);

  const getActiveOffers = () => {
    return offers.filter(offer => offer.status === 'pending' && new Date(offer.expires_at) > new Date());
  };

  const getOfferByStatus = (status: JobOffer['status']) => {
    return offers.filter(offer => offer.status === status);
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const releaseOffer = async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('job_offers')
        .update({ 
          status: 'expired',
          expired_at: new Date().toISOString()
        })
        .eq('id', offerId);

      if (error) throw error;

      await fetchOffers(); // Refresh the offers
      return true;
    } catch (err: any) {
      console.error('Error releasing offer:', err);
      throw err;
    }
  };

  const resendOffer = async (offerId: string) => {
    try {
      const offer = offers.find(o => o.id === offerId);
      if (!offer) throw new Error('Offer not found');

      const { data, error } = await supabase.functions.invoke('send-offer', {
        body: {
          order_id: offer.order_id,
          engineer_id: offer.engineer_id,
          offered_date: offer.offered_date,
          time_window: offer.time_window,
          delivery_channel: offer.delivery_channel
        }
      });

      if (error || data?.error) {
        // Handle specific error types from send-offer function
        if (data?.error === 'engineer_not_available') {
          const engineerName = data?.details?.engineer_name || 'Engineer';
          const availableDays = data?.details?.available_days?.join(', ') || 'weekdays';
          throw new Error(`${engineerName} is not available on ${data?.details?.requested_day}. Available days: ${availableDays}`);
        } else if (data?.message && data.message.includes('at capacity')) {
          throw new Error('Engineer is at capacity on this date. Please choose a different date or engineer.');
        } else if (data?.message && data.message.includes('exceed working hours')) {
          throw new Error('This booking would exceed the engineer\'s working hours. Please choose a different date or engineer.');
        } else {
          throw new Error(data?.error || 'Failed to resend offer');
        }
      }

      await fetchOffers(); // Refresh the offers
      return true;
    } catch (err: any) {
      console.error('Error resending offer:', err);
      throw err;
    }
  };

  return {
    offers,
    loading,
    error,
    refetch: fetchOffers,
    getActiveOffers,
    getOfferByStatus,
    getTimeRemaining,
    releaseOffer,
    resendOffer
  };
}