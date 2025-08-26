import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Clock, MapPin, Users, Calendar, Database, Trash2, AlertTriangle } from 'lucide-react';

interface SchedulingSettings {
  minimum_advance_hours: number;
  max_distance_miles: number;
  max_jobs_per_day: number;
  working_hours_start: string;
  working_hours_end: string;
  day_lenience_minutes: number;
  allow_weekend_bookings: boolean;
  allow_holiday_bookings: boolean;
  require_client_confirmation: boolean;
  recommendation_search_horizon_days?: number;
  top_recommendations_count?: number;
  require_service_area_match?: boolean;
  max_travel_minutes_fallback?: number;
}

export function SchedulingSettingsPanel() {
  const [settings, setSettings] = useState<SchedulingSettings>({
    minimum_advance_hours: 48,
    max_distance_miles: 50,
    max_jobs_per_day: 3,
    working_hours_start: '09:00',
    working_hours_end: '17:00',
    day_lenience_minutes: 15,
    allow_weekend_bookings: false,
    allow_holiday_bookings: false,
    require_client_confirmation: true,
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Seed data controls
  const [seedClients, setSeedClients] = useState(100);
  const [seedOrdersMin, setSeedOrdersMin] = useState(1);
  const [seedOrdersMax, setSeedOrdersMax] = useState(3);
  const [seedTag, setSeedTag] = useState('SEED');
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [seedErrors, setSeedErrors] = useState<string[]>([]);
  const [diagnosticInfo, setDiagnosticInfo] = useState<any>(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

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
        day_lenience_minutes: settings.day_lenience_minutes,
        recommendation_search_horizon_days: settings.recommendation_search_horizon_days,
        top_recommendations_count: settings.top_recommendations_count,
      };

      const bookingRules = {
        allow_weekend_bookings: settings.allow_weekend_bookings,
        allow_holiday_bookings: settings.allow_holiday_bookings,
        require_client_confirmation: settings.require_client_confirmation,
        require_service_area_match: settings.require_service_area_match ?? true,
        max_travel_minutes_fallback: settings.max_travel_minutes_fallback,
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

  const runDiagnostic = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('seed-scheduling-data-v2', {
        body: { diagnose: true }
      });

      if (error) throw error;

      setDiagnosticInfo(data);
      setShowDiagnostic(true);
      toast.success('Diagnostic completed - check results below');
    } catch (error: any) {
      console.error('Diagnostic failed:', error);
      toast.error(`Diagnostic failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const seedSchedulingData = async () => {
    setSeeding(true);
    setSeedErrors([]);
    
    try {
      // Try v2 function first, fallback to v1 if 404
      let data, error;
      try {
        ({ data, error } = await supabase.functions.invoke('seed-scheduling-data-v2', {
          body: {
            clients: seedClients,
            orders_per_client_min: seedOrdersMin,
            orders_per_client_max: seedOrdersMax,
            tag: seedTag
          }
        }));
      } catch (v2Error: any) {
        console.log('V2 function failed, trying v1:', v2Error);
        if (v2Error?.message?.includes('404') || v2Error?.status === 404) {
          toast.error('Edge function not found - check deployment status');
          return;
        } else if (v2Error?.status === 401 || v2Error?.status === 403) {
          toast.error('Permission denied - admin access required');
          return;
        } else {
          throw v2Error;
        }
      }

      if (error) throw error;

      // Check for successful data creation
      if (data?.success === true && data?.counts?.clients > 0) {
        toast.success(`Created ${data.counts.clients} clients and ${data.counts.orders} orders`);
        console.log('Seed data created:', data);
        
        // Show any warnings if there were non-critical errors
        if (data.errors && data.errors.length > 0) {
          setSeedErrors(data.errors);
        }
      } else {
        // Failed to create data
        const errorMessage = data?.message || data?.error || 'No data was created';
        toast.error(`Seed failed: ${errorMessage}`);
        
        if (data?.errors) {
          setSeedErrors(data.errors);
        }
      }
    } catch (error: any) {
      console.error('Error seeding data:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast.error(`Failed to seed test data: ${errorMessage}`);
      
      // Show actionable message for common errors
      if (error?.status === 404) {
        setSeedErrors(['Edge function not deployed - check GitHub Actions']);
      } else if (error?.status === 401 || error?.status === 403) {
        setSeedErrors(['Permission denied - admin access required']);
      }
    } finally {
      setSeeding(false);
    }
  };

  const clearSeedData = async () => {
    setClearing(true);
    try {
      // Try v2 function first, fallback to v1 if 404
      let data, error;
      try {
        ({ data, error } = await supabase.functions.invoke('clear-seed-data-v2'));
      } catch (v2Error: any) {
        console.log('V2 clear function failed, trying v1:', v2Error);
        if (v2Error?.message?.includes('404') || v2Error?.status === 404) {
          ({ data, error } = await supabase.functions.invoke('clear-seed-data'));
        } else {
          throw v2Error;
        }
      }

      if (error) throw error;

      toast.success(data.message);
      console.log('Seed data cleared:', data);
    } catch (error: any) {
      console.error('Error clearing seed data:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast.error(`Failed to clear seed data: ${errorMessage}`);
    } finally {
      setClearing(false);
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
    <div className="space-y-6">
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
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="day_lenience">Day Lenience (minutes)</Label>
                <Input
                  id="day_lenience"
                  type="number"
                  min="0"
                  max="60"
                  value={settings.day_lenience_minutes}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    day_lenience_minutes: parseInt(e.target.value) || 15 
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Allow engineers to get home this many minutes after their end time
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recommendation_horizon">Recommendation Search (days)</Label>
                <Input
                  id="recommendation_horizon"
                  type="number"
                  min="30"
                  max="365"
                  value={settings.recommendation_search_horizon_days || 120}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    recommendation_search_horizon_days: parseInt(e.target.value) || 120 
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  How far to search for engineer availability
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="top_recommendations">Top Recommendations Count</Label>
                <Input
                  id="top_recommendations"
                  type="number"
                  min="1"
                  max="10"
                  value={settings.top_recommendations_count || 3}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    top_recommendations_count: parseInt(e.target.value) || 3 
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Number of featured recommendations to show
                </p>
              </div>
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

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Strict Service Area Matching</Label>
                <p className="text-xs text-muted-foreground">
                  Only show engineers with declared service areas for the job postcode
                </p>
              </div>
              <Switch
                checked={settings.require_service_area_match || false}
                onCheckedChange={(checked) => setSettings(prev => ({ 
                  ...prev, 
                  require_service_area_match: checked 
                }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_travel_fallback">Max Travel Minutes (no service area)</Label>
              <Input
                id="max_travel_fallback"
                type="number"
                min="60"
                max="300"
                value={settings.max_travel_minutes_fallback || 120}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  max_travel_minutes_fallback: parseInt(e.target.value) || 120 
                }))}
              />
              <p className="text-xs text-muted-foreground">
                Travel time limit for engineers with no declared service area for the postcode
              </p>
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

      {/* Scheduling Test Data */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Scheduling Test Data
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Generate realistic test data for testing the scheduling pipeline with volume
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="space-y-1">
              <p className="text-yellow-800 font-medium text-sm">Test Data Only</p>
              <p className="text-yellow-700 text-xs">
                This creates fake clients and orders with @seed.local emails. Engineers are NOT created - only existing engineers are used for assignments.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="seed_clients">Number of Clients</Label>
              <Input
                id="seed_clients"
                type="number"
                min="10"
                max="500"
                value={seedClients}
                onChange={(e) => setSeedClients(parseInt(e.target.value) || 100)}
              />
              <p className="text-xs text-muted-foreground">
                Total test clients to create
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seed_orders_min">Min Orders/Client</Label>
              <Input
                id="seed_orders_min"
                type="number"
                min="1"
                max="5"
                value={seedOrdersMin}
                onChange={(e) => setSeedOrdersMin(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seed_orders_max">Max Orders/Client</Label>
              <Input
                id="seed_orders_max"
                type="number"
                min="1"
                max="10"
                value={seedOrdersMax}
                onChange={(e) => setSeedOrdersMax(parseInt(e.target.value) || 3)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="seed_tag">Data Tag</Label>
              <Input
                id="seed_tag"
                maxLength={10}
                value={seedTag}
                onChange={(e) => setSeedTag(e.target.value || 'SEED')}
              />
              <p className="text-xs text-muted-foreground">
                Tag for easy identification
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              onClick={seedSchedulingData} 
              disabled={seeding || clearing}
              className="flex-1"
            >
              <Database className="h-4 w-4 mr-2" />
              {seeding ? 'Creating Test Data...' : 'Create Test Data'}
            </Button>
            
            <Button 
              onClick={clearSeedData} 
              disabled={seeding || clearing}
              variant="destructive"
              className="flex-1"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {clearing ? 'Clearing Data...' : 'Clear Seed Data'}
            </Button>
          </div>

          {/* Error Messages */}
          {seedErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-red-800 font-medium text-sm">Seed Data Errors</p>
                  <div className="text-red-700 text-xs space-y-1">
                    {seedErrors.slice(0, 5).map((error, index) => (
                      <div key={index}>• {error}</div>
                    ))}
                    {seedErrors.length > 5 && (
                      <div>• ... and {seedErrors.length - 5} more errors</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Tool */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Troubleshooting</p>
                <p className="text-xs text-muted-foreground">
                  Run diagnostics to check environment and permissions
                </p>
              </div>
              <Button
                onClick={runDiagnostic}
                variant="outline"
                size="sm"
                disabled={seeding || clearing}
              >
                Run Diagnose
              </Button>
            </div>

            {/* Diagnostic Results */}
            {showDiagnostic && diagnosticInfo && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-blue-800">Diagnostic Results</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="font-medium text-blue-700 mb-1">Environment</div>
                      <div className="space-y-1 text-blue-600">
                        <div>• Supabase URL: {diagnosticInfo.environment?.hasUrl ? '✓' : '✗'}</div>
                        <div>• Service Key: {diagnosticInfo.environment?.hasServiceKey ? '✓' : '✗'}</div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium text-blue-700 mb-1">Authentication</div>
                      <div className="space-y-1 text-blue-600">
                        <div>• User: {diagnosticInfo.authentication?.userEmail}</div>
                        <div>• Role: {diagnosticInfo.authentication?.role}</div>
                        <div>• Status: {diagnosticInfo.authentication?.status}</div>
                      </div>
                    </div>
                    
                    <div className="md:col-span-2">
                      <div className="font-medium text-blue-700 mb-1">Existing Data</div>
                      <div className="space-y-1 text-blue-600">
                        <div>• Seed Users: {diagnosticInfo.existingData?.seedUsers || 0}</div>
                        <div>• Seed Clients: {diagnosticInfo.existingData?.seedClients || 0}</div>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => setShowDiagnostic(false)}
                    variant="ghost"
                    size="sm"
                    className="w-full"
                  >
                    Close Diagnostic
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>What gets created:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Client users with @seed.local emails across UK postcodes</li>
              <li>Quotes with realistic EV charger products and pricing</li>
              <li>Orders across all scheduling statuses (15% marked as urgent)</li>
              <li>70% of orders assigned to existing engineers based on regions</li>
              <li>Realistic dates, addresses, and scheduling conflicts for testing</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}