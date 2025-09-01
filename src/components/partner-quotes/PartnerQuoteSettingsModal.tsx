import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Clock, File, EyeOff } from 'lucide-react';

interface PartnerQuoteSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  partnerName: string;
  onSettingsUpdated?: () => void;
}

interface PartnerSettings {
  sla_hours: number;
  require_file: boolean;
  auto_hide_days: number;
}

export function PartnerQuoteSettingsModal({
  open,
  onOpenChange,
  partnerId,
  partnerName,
  onSettingsUpdated
}: PartnerQuoteSettingsModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PartnerSettings>({
    sla_hours: 48,
    require_file: true,
    auto_hide_days: 30
  });

  useEffect(() => {
    if (open && partnerId) {
      fetchSettings();
    }
  }, [open, partnerId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('partner_quote_settings')
        .select('*')
        .eq('partner_id', partnerId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          sla_hours: data.sla_hours || 48,
          require_file: data.require_file ?? true,
          auto_hide_days: data.auto_hide_days || 30
        });
      }
    } catch (error) {
      console.error('Error fetching partner settings:', error);
      toast({
        title: "Error",
        description: "Failed to load partner settings",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('partner_quote_settings')
        .upsert({
          partner_id: partnerId,
          sla_hours: settings.sla_hours,
          require_file: settings.require_file,
          auto_hide_days: settings.auto_hide_days,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Settings Updated",
        description: "Partner quote settings have been saved successfully.",
      });

      onSettingsUpdated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving partner settings:', error);
      toast({
        title: "Error",
        description: "Failed to save partner settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Partner Settings - {partnerName}
          </DialogTitle>
          <DialogDescription>
            Configure SLA, file requirements, and display settings for this partner.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* SLA Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-4 w-4" />
                SLA Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sla_hours">Response Time SLA (hours)</Label>
                <Input
                  id="sla_hours"
                  type="number"
                  min="1"
                  max="168"
                  value={settings.sla_hours}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    sla_hours: parseInt(e.target.value) || 48
                  }))}
                />
                <p className="text-sm text-muted-foreground">
                  Time limit for partners to respond to quote requests (1-168 hours)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* File Requirements */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <File className="h-4 w-4" />
                File Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="require_file">Require File Upload</Label>
                  <p className="text-sm text-muted-foreground">
                    Mandate that partners upload quote files
                  </p>
                </div>
                <Switch
                  id="require_file"
                  checked={settings.require_file}
                  onCheckedChange={(checked) => setSettings(prev => ({
                    ...prev,
                    require_file: checked
                  }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Display Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <EyeOff className="h-4 w-4" />
                Display Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="auto_hide_days">Auto-hide after (days)</Label>
                <Input
                  id="auto_hide_days"
                  type="number"
                  min="1"
                  max="365"
                  value={settings.auto_hide_days}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    auto_hide_days: parseInt(e.target.value) || 30
                  }))}
                />
                <p className="text-sm text-muted-foreground">
                  Automatically hide completed/rejected quotes after this many days (1-365)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}