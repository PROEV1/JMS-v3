import { supabase } from '@/integrations/supabase/client';

export const markMessagesAsRead = async (clientId: string) => {
  try {
    const { data, error } = await supabase.rpc('mark_client_messages_read', {
      p_client_id: clientId
    });

    if (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }
    
    return data === true;
  } catch (error) {
    console.error('Error in markMessagesAsRead:', error);
    return false;
  }
};