import { supabase } from '@/integrations/supabase/client';

export const markMessagesAsRead = async (clientId: string) => {
  try {
    // Get the client's user_id first
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('user_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('Error getting client user_id:', clientError);
      return false;
    }

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', client.user_id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error in markMessagesAsRead:', error);
    return false;
  }
};