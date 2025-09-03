import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, AlertTriangle } from 'lucide-react';

interface SubcontractorSettings {
  enabled: boolean;
  alert_threshold_percent: number;
}

interface SubcontractorSettingsPanelProps {
  onSettingsChange?: (settings: SubcontractorSettings) => void;
}

export function SubcontractorSettingsPanel({ onSettingsChange }: SubcontractorSettingsPanelProps) {
  const [settings, setSettings] = useState<SubcontractorSettings>({
    enabled: false,
    alert_threshold_percent: 80,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'subcontractor_settings')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading subcontractor settings:', error);
      } else if (data) {
        const settingsValue = data.setting_value as any;
        setSettings({
          enabled: Boolean(settingsValue?.enabled),
          alert_threshold_percent: Number(settingsValue?.alert_threshold_percent) || 80,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'subcontractor_settings',
          setting_value: settings as any,
        });

      if (error) throw error;

      toast({
        title: "Settings Saved",
        description: "Subcontractor settings have been updated successfully",
      });

      onSettingsChange?.(settings);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subcontractor Management Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Enable subcontractor management to track capacity limits, utilization rates, 
            and manage contractors alongside employees. This adds additional fields and 
            controls to the engineer management interface.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="enable-subcontractor">Enable Subcontractor Management</Label>
            <p className="text-sm text-muted-foreground">
              Allow management of subcontractors with capacity limits and extended hours
            </p>
          </div>
          <Switch
            id="enable-subcontractor"
            checked={settings.enabled}
            onCheckedChange={(enabled) => setSettings({ ...settings, enabled })}
          />
        </div>

        {settings.enabled && (
          <>
            <div className="space-y-2">
              <Label htmlFor="alert-threshold">Capacity Alert Threshold (%)</Label>
              <Input
                id="alert-threshold"
                type="number"
                min="50"
                max="100"
                value={settings.alert_threshold_percent}
                onChange={(e) => setSettings({ 
                  ...settings, 
                  alert_threshold_percent: parseInt(e.target.value) || 80 
                })}
              />
              <p className="text-sm text-muted-foreground">
                Show alerts when subcontractors reach this percentage of their daily capacity
              </p>
            </div>

            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> Enabling subcontractor management will add new fields 
                to engineer forms and modify the scheduling algorithm to consider capacity limits 
                and flexible working hours for subcontractors.
              </AlertDescription>
            </Alert>
          </>
        )}

        <div className="flex justify-end">
          <Button onClick={saveSettings} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}