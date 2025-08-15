import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Clock, MapPin, Users, Calendar } from 'lucide-react';

interface SchedulingSettings {
  minimum_advance_hours: number;
  max_distance_miles: number;
  max_jobs_per_day: number;
  working_hours_start: string;
  working_hours_end: string;
  allow_weekend_bookings: boolean;
  allow_holiday_bookings: boolean;
  require_client_confirmation: boolean;
}

export function SchedulingSettingsPanel() {
  const [settings, setSettings] = useState<SchedulingSettings>({
    minimum_advance_hours: 48,
    max_distance_miles: 50,
    max_jobs_per_day: 3,
    working_hours_start: '09:00',
    working_hours_end: '17:00',
    allow_weekend_bookings: false,
    allow_holiday_bookings: false,
    require_client_confirmation: true,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: schedulingRules, error: schedulingError } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'scheduling_rules')
        .single();

      const { data: bookingRules, error: bookingError } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'booking_rules')
        .single();

      if (schedulingError && schedulingError.code !== 'PGRST116') {
        console.error('Error loading scheduling rules:', schedulingError);
      }

      if (bookingError && bookingError.code !== 'PGRST116') {
        console.error('Error loading booking rules:', bookingError);
      }

      const schedulingSettings = (schedulingRules?.setting_value as Record<string, any>) || {};
      const bookingSettings = (bookingRules?.setting_value as Record<string, any>) || {};

      setSettings(prev => ({
        ...prev,
        ...schedulingSettings,
        ...bookingSettings
      }));
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load scheduling settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Split settings into scheduling rules and booking rules
      const schedulingRules = {
        minimum_advance_hours: settings.minimum_advance_hours,
        max_distance_miles: settings.max_distance_miles,
        max_jobs_per_day: settings.max_jobs_per_day,
        working_hours_start: settings.working_hours_start,
        working_hours_end: settings.working_hours_end,
      };

      const bookingRules = {
        allow_weekend_bookings: settings.allow_weekend_bookings,
        allow_holiday_bookings: settings.allow_holiday_bookings,
        require_client_confirmation: settings.require_client_confirmation,
      };

      // Save scheduling rules
      const { error: schedulingError } = await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'scheduling_rules',
          setting_value: schedulingRules,
        });

      if (schedulingError) throw schedulingError;

      // Save booking rules
      const { error: bookingError } = await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'booking_rules',
          setting_value: bookingRules,
        });

      if (bookingError) throw bookingError;

      toast.success('Scheduling settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save scheduling settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Scheduling & Booking Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Time and Distance Rules */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4" />
            Time & Distance Rules
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="advance_hours">Minimum Advance Notice (hours)</Label>
              <Input
                id="advance_hours"
                type="number"
                min="1"
                max="168"
                value={settings.minimum_advance_hours}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  minimum_advance_hours: parseInt(e.target.value) || 48 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Jobs cannot be booked within this timeframe
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_distance">Maximum Distance (miles)</Label>
              <Input
                id="max_distance"
                type="number"
                min="1"
                max="200"
                value={settings.max_distance_miles}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  max_distance_miles: parseInt(e.target.value) || 50 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Engineers won't be recommended beyond this distance
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="work_start">Working Hours Start</Label>
              <Input
                id="work_start"
                type="time"
                value={settings.working_hours_start}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  working_hours_start: e.target.value 
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="work_end">Working Hours End</Label>
              <Input
                id="work_end"
                type="time"
                value={settings.working_hours_end}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  working_hours_end: e.target.value 
                }))}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Workload Management */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" />
            Workload Management
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="max_jobs">Maximum Jobs Per Day</Label>
            <Input
              id="max_jobs"
              type="number"
              min="1"
              max="10"
              value={settings.max_jobs_per_day}
              onChange={(e) => setSettings(prev => ({ 
                ...prev, 
                max_jobs_per_day: parseInt(e.target.value) || 3 
              }))}
            />
            <p className="text-xs text-muted-foreground">
              Limit daily job assignments per engineer
            </p>
          </div>
        </div>

        <Separator />

        {/* Booking Rules */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4" />
            Booking Rules
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Weekend Bookings</Label>
                <p className="text-xs text-muted-foreground">
                  Enable scheduling on Saturdays and Sundays
                </p>
              </div>
              <Switch
                checked={settings.allow_weekend_bookings}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  allow_weekend_bookings: checked 
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Holiday Bookings</Label>
                <p className="text-xs text-muted-foreground">
                  Enable scheduling on public holidays
                </p>
              </div>
              <Switch
                checked={settings.allow_holiday_bookings}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  allow_holiday_bookings: checked 
                }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Client Confirmation</Label>
                <p className="text-xs text-muted-foreground">
                  Send confirmation emails for bookings
                </p>
              </div>
              <Switch
                checked={settings.require_client_confirmation}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  require_client_confirmation: checked 
                }))}
              />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button 
            onClick={saveSettings} 
            disabled={saving}
            className="w-full"
          >
            {saving ? 'Saving Settings...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}