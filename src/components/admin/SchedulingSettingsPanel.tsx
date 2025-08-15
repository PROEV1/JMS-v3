import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Settings, Clock, MapPin, Users } from 'lucide-react';

interface SchedulingSettings {
  hours_advance_notice: number;
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
    hours_advance_notice: 48,
    max_distance_miles: 90,
    max_jobs_per_day: 3,
    working_hours_start: '08:00',
    working_hours_end: '18:00',
    allow_weekend_bookings: false,
    allow_holiday_bookings: false,
    require_client_confirmation: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('*')
        .in('setting_key', ['scheduling_rules', 'booking_rules']);

      if (error) throw error;

      if (data) {
        const schedulingRules = data.find(s => s.setting_key === 'scheduling_rules')?.setting_value as any || {};
        const bookingRules = data.find(s => s.setting_key === 'booking_rules')?.setting_value as any || {};

        setSettings({
          hours_advance_notice: schedulingRules.hours_advance_notice || 48,
          max_distance_miles: schedulingRules.max_distance_miles || 90,
          max_jobs_per_day: schedulingRules.max_jobs_per_day || 3,
          working_hours_start: schedulingRules.working_hours_start || '08:00',
          working_hours_end: schedulingRules.working_hours_end || '18:00',
          allow_weekend_bookings: bookingRules.allow_weekend_bookings || false,
          allow_holiday_bookings: bookingRules.allow_holiday_bookings || false,
          require_client_confirmation: bookingRules.require_client_confirmation || true
        });
      }
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
      // Update scheduling rules
      const schedulingRules = {
        hours_advance_notice: settings.hours_advance_notice,
        max_distance_miles: settings.max_distance_miles,
        max_jobs_per_day: settings.max_jobs_per_day,
        working_hours_start: settings.working_hours_start,
        working_hours_end: settings.working_hours_end
      };

      const bookingRules = {
        allow_weekend_bookings: settings.allow_weekend_bookings,
        allow_holiday_bookings: settings.allow_holiday_bookings,
        require_client_confirmation: settings.require_client_confirmation
      };

      const { error: schedulingError } = await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'scheduling_rules',
          setting_value: schedulingRules,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      if (schedulingError) throw schedulingError;

      const { error: bookingError } = await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'booking_rules',
          setting_value: bookingRules,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
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
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Scheduling Configuration
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure scheduling rules and booking constraints for smart recommendations
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Time and Distance Rules */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <h3 className="text-lg font-medium">Time & Distance Rules</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hours_advance_notice">Minimum Advance Notice (hours)</Label>
              <Input
                id="hours_advance_notice"
                type="number"
                min="1"
                max="168"
                value={settings.hours_advance_notice}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  hours_advance_notice: parseInt(e.target.value) || 48
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Minimum hours required between booking and installation
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_distance_miles">Maximum Distance (miles)</Label>
              <Input
                id="max_distance_miles"
                type="number"
                min="1"
                max="500"
                value={settings.max_distance_miles}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  max_distance_miles: parseInt(e.target.value) || 90
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Maximum distance engineers will travel for installations
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="working_hours_start">Working Hours Start</Label>
              <Input
                id="working_hours_start"
                type="time"
                value={settings.working_hours_start}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  working_hours_start: e.target.value
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="working_hours_end">Working Hours End</Label>
              <Input
                id="working_hours_end"
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

        {/* Workload Rules */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <h3 className="text-lg font-medium">Workload Management</h3>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="max_jobs_per_day">Maximum Jobs Per Engineer Per Day</Label>
            <Input
              id="max_jobs_per_day"
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
              Maximum number of installations an engineer can handle per day
            </p>
          </div>
        </div>

        <Separator />

        {/* Booking Rules */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <h3 className="text-lg font-medium">Booking Rules</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Allow Weekend Bookings</Label>
                <p className="text-xs text-muted-foreground">
                  Allow installations to be scheduled on weekends
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
                  Allow installations to be scheduled on public holidays
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
                  Require client confirmation before finalizing bookings
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

        <Separator />

        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}