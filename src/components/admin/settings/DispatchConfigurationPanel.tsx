import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Settings, Save, Package, AlertTriangle, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DispatchConfig {
  urgency_threshold_days: number;
  default_courier: string;
  auto_dispatch_enabled: boolean;
  job_types_requiring_dispatch: string[];
  partner_specific_settings: Record<string, {
    dispatch_required: boolean;
    lead_time_days: number;
    auto_dispatch: boolean;
  }>;
}

export function DispatchConfigurationPanel() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<DispatchConfig>({
    urgency_threshold_days: 2,
    default_courier: 'DPD',
    auto_dispatch_enabled: false,
    job_types_requiring_dispatch: ['installation', 'assessment'],
    partner_specific_settings: {}
  });

  // Fetch current dispatch configuration
  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ['dispatch-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'dispatch_configuration')
        .maybeSingle();

      if (error) throw error;
      
      if (data?.setting_value) {
        const configData = data.setting_value as any as DispatchConfig;
        setConfig(configData);
        return configData;
      }
      
      return config;
    }
  });

  // Fetch partners for configuration
  const { data: partners = [] } = useQuery({
    queryKey: ['partners-for-dispatch-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    }
  });

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (newConfig: DispatchConfig) => {
      const { error } = await supabase
        .from('admin_settings')
        .upsert({
          setting_key: 'dispatch_configuration',
          setting_value: newConfig as any
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dispatch configuration saved successfully');
      queryClient.invalidateQueries({ queryKey: ['dispatch-config'] });
    },
    onError: (error) => {
      console.error('Error saving dispatch config:', error);
      toast.error('Failed to save dispatch configuration');
    }
  });

  const handleSave = () => {
    saveConfigMutation.mutate(config);
  };

  const updateJobTypeRequirement = (jobType: string, required: boolean) => {
    if (required) {
      setConfig(prev => ({
        ...prev,
        job_types_requiring_dispatch: [...prev.job_types_requiring_dispatch, jobType]
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        job_types_requiring_dispatch: prev.job_types_requiring_dispatch.filter(type => type !== jobType)
      }));
    }
  };

  const updatePartnerSetting = (partnerId: string, key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      partner_specific_settings: {
        ...prev.partner_specific_settings,
        [partnerId]: {
          ...prev.partner_specific_settings[partnerId],
          [key]: value
        }
      }
    }));
  };

  const jobTypes = [
    { value: 'installation', label: 'Installation' },
    { value: 'assessment', label: 'Assessment' },
    { value: 'service_call', label: 'Service Call' }
  ];

  const courierOptions = [
    'DPD', 'Royal Mail', 'UPS', 'FedEx', 'Hermes', 'Yodel', 'Other'
  ];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Dispatch Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-4 bg-muted rounded w-1/4" />
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
          Dispatch Configuration
        </CardTitle>
        <CardDescription>
          Configure charger dispatch settings and automation rules
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* General Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            General Settings
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="urgency_threshold">Urgency Threshold (Days)</Label>
              <Input
                id="urgency_threshold"
                type="number"
                min="1"
                max="14"
                value={config.urgency_threshold_days}
                onChange={(e) => setConfig(prev => ({
                  ...prev,
                  urgency_threshold_days: parseInt(e.target.value) || 2
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Mark orders as urgent when install date is within this many days
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_courier">Default Courier</Label>
              <Select
                value={config.default_courier}
                onValueChange={(value) => setConfig(prev => ({ ...prev, default_courier: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courierOptions.map((courier) => (
                    <SelectItem key={courier} value={courier}>
                      {courier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="auto_dispatch"
              checked={config.auto_dispatch_enabled}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, auto_dispatch_enabled: checked }))}
            />
            <Label htmlFor="auto_dispatch">Enable Auto-Dispatch (Future Feature)</Label>
          </div>
        </div>

        <Separator />

        {/* Job Type Requirements */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Package className="h-4 w-4" />
            Job Type Requirements
          </h3>
          
          <div className="space-y-3">
            {jobTypes.map((jobType) => (
              <div key={jobType.value} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>{jobType.label}</Label>
                  {config.job_types_requiring_dispatch.includes(jobType.value) && (
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  )}
                </div>
                <Switch
                  checked={config.job_types_requiring_dispatch.includes(jobType.value)}
                  onCheckedChange={(checked) => updateJobTypeRequirement(jobType.value, checked)}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Partner-Specific Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Partner-Specific Settings
          </h3>
          
          <div className="space-y-4">
            {partners.map((partner) => {
              const partnerConfig = config.partner_specific_settings[partner.id] || {
                dispatch_required: true,
                lead_time_days: 2,
                auto_dispatch: false
              };

              return (
                <Card key={partner.id} className="p-4">
                  <div className="space-y-3">
                    <h4 className="font-medium">{partner.name}</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={partnerConfig.dispatch_required}
                          onCheckedChange={(checked) => updatePartnerSetting(partner.id, 'dispatch_required', checked)}
                        />
                        <Label className="text-sm">Dispatch Required</Label>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Lead Time (Days)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="14"
                          value={partnerConfig.lead_time_days}
                          onChange={(e) => updatePartnerSetting(partner.id, 'lead_time_days', parseInt(e.target.value) || 2)}
                          className="h-8"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={partnerConfig.auto_dispatch}
                          onCheckedChange={(checked) => updatePartnerSetting(partner.id, 'auto_dispatch', checked)}
                        />
                        <Label className="text-sm">Auto-Dispatch</Label>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {partners.length === 0 && (
              <div className="text-center text-muted-foreground py-4">
                No active partners found
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saveConfigMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {saveConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}