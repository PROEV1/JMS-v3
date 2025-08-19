import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CommsSuppressionSettings {
  suppress_client_emails: boolean;
  suppress_offer_emails: boolean;
  suppress_status_emails: boolean;
  test_mode_active: boolean;
}

export function useAdminCommsSetting() {
  const [settings, setSettings] = useState<CommsSuppressionSettings>({
    suppress_client_emails: false,
    suppress_offer_emails: false,
    suppress_status_emails: false,
    test_mode_active: false,
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'communication_suppression')
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        console.error('Error fetching communication settings:', error);
      } else if (data && typeof data.setting_value === 'object' && data.setting_value !== null) {
        const value = data.setting_value as Record<string, unknown>;
        setSettings({
          suppress_client_emails: value.suppress_client_emails === true,
          suppress_offer_emails: value.suppress_offer_emails === true,
          suppress_status_emails: value.suppress_status_emails === true,
          test_mode_active: value.test_mode_active === true,
        });
      }
    } catch (error) {
      console.error('Error fetching communication settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<CommsSuppressionSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'communication_suppression',
          setting_value: updatedSettings
        });

      if (error) throw error;
      
      setSettings(updatedSettings);
      return true;
    } catch (error) {
      console.error('Error updating communication settings:', error);
      return false;
    }
  };

  return {
    settings,
    loading,
    updateSettings,
    refresh: fetchSettings
  };
}