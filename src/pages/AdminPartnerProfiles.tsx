import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Upload, FileSpreadsheet, Trash2, Activity, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import MappingConfiguration from '@/components/admin/MappingConfiguration';
import { PartnerStatusMappingEditor } from '@/components/admin/PartnerStatusMappingEditor';
import ImportRunModal from '@/components/admin/ImportRunModal';
import { DeletePartnerJobsModal } from '@/components/admin/DeletePartnerJobsModal';
import { ImportProfileActions } from '@/components/admin/ImportProfileActions';
import { TestPartnerImport } from '@/components/TestPartnerImport';
import { PartnerImportAuditModal } from '@/components/admin/PartnerImportAuditModal';
import ImportHistoryModal from '@/components/admin/ImportHistoryModal';
import JobDurationDefaultsEditor from '@/components/admin/JobDurationDefaultsEditor';

interface ImportProfile {
  id: string;
  partner_id: string;
  name: string;
  source_type: 'csv' | 'gsheet';
  gsheet_id: string | null;
  gsheet_sheet_name: string | null;
  column_mappings: Record<string, string>;
  status_mappings: Record<string, string>;
  engineer_mapping_rules: Array<any>;
  status_override_rules: Record<string, boolean>;
  status_actions: Record<string, any>;
  job_duration_defaults: Record<string, number>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Helper function to convert status_actions to status_mappings for backward compatibility
const convertStatusActionsToMappings = (statusActions: Record<string, any>): Record<string, string> => {
  const mappings: Record<string, string> = {};
  
  Object.entries(statusActions || {}).forEach(([partnerStatus, actionConfig]) => {
    if (actionConfig && typeof actionConfig === 'object' && actionConfig.jms_status) {
      mappings[partnerStatus] = actionConfig.jms_status;
    }
  });
  
  return mappings;
};

// Default status mappings for common partner statuses
const getDefaultStatusMappings = () => ({
  'AWAITING_INSTALL_DATE': 'needs_scheduling',
  'INSTALL_DATE_CONFIRMED': 'scheduled',
  'INSTALLED': 'install_completed_pending_qa',
  'COMPLETION_PENDING': 'install_completed_pending_qa',
  'COMPLETE': 'completed',
  'WAITING_FOR_OHME_APPROVAL': 'on_hold_parts_docs',
  'ON_HOLD': 'on_hold_parts_docs',
  'SWITCH_JOB_SUB_TYPE_REQUESTED': 'on_hold_parts_docs',
  'CANCELLATION_REQUESTED': 'cancelled',
  'CANCELLED': 'cancelled',
  'ABANDONED': 'cancelled',
  'AWAITING_QUOTATION': 'awaiting_install_booking'
});

// Default status actions for common scenarios
const getDefaultStatusActions = () => ({
  'AWAITING_INSTALL_DATE': {
    jms_status: 'needs_scheduling',
    bucket: 'needs_scheduling',
    quote_bucket: null,
    include_in_quote_dashboard: false,
    actions: {
      suppress_scheduling: false,
      keep_calendar_block: false,
      surface_to_qa: false
    }
  },
  'INSTALL_DATE_CONFIRMED': {
    jms_status: 'scheduled',
    bucket: 'scheduled',
    quote_bucket: null,
    include_in_quote_dashboard: false,
    actions: {
      suppress_scheduling: false,
      keep_calendar_block: true,
      surface_to_qa: false
    }
  },
  'INSTALLED': {
    jms_status: 'install_completed_pending_qa',
    bucket: 'completion_pending',
    quote_bucket: null,
    include_in_quote_dashboard: false,
    actions: {
      suppress_scheduling: false,
      keep_calendar_block: true,
      surface_to_qa: false
    }
  },
  'COMPLETION_PENDING': {
    jms_status: 'install_completed_pending_qa',
    bucket: 'completion_pending',
    quote_bucket: null,
    include_in_quote_dashboard: false,
    actions: {
      suppress_scheduling: false,
      keep_calendar_block: true,
      surface_to_qa: false
    }
  },
  'COMPLETE': {
    jms_status: 'completed',
    bucket: 'completed',
    quote_bucket: null,
    include_in_quote_dashboard: false,
    actions: {
      suppress_scheduling: true,
      keep_calendar_block: false,
      surface_to_qa: false,
      suppression_reason: 'partner_completed'
    }
  },
  'WAITING_FOR_OHME_APPROVAL': {
    jms_status: 'on_hold_parts_docs',
    bucket: 'on_hold',
    quote_bucket: 'waiting_approval',
    include_in_quote_dashboard: true,
    actions: {
      suppress_scheduling: true,
      keep_calendar_block: true,
      surface_to_qa: true,
      suppression_reason: 'awaiting_ohme_approval'
    }
  },
  'ON_HOLD': {
    jms_status: 'on_hold_parts_docs',
    bucket: 'on_hold',
    quote_bucket: null,
    include_in_quote_dashboard: false,
    actions: {
      suppress_scheduling: true,
      keep_calendar_block: true,
      surface_to_qa: true,
      suppression_reason: 'partner_on_hold'
    }
  },
  'SWITCH_JOB_SUB_TYPE_REQUESTED': {
    jms_status: 'on_hold_parts_docs',
    bucket: 'on_hold',
    quote_bucket: null,
    include_in_quote_dashboard: false,
    actions: {
      suppress_scheduling: true,
      keep_calendar_block: true,
      surface_to_qa: true,
      suppression_reason: 'switch_job_sub_type'
    }
  },
  'CANCELLATION_REQUESTED': {
    jms_status: 'cancelled',
    bucket: 'cancelled',
    quote_bucket: null,
    include_in_quote_dashboard: false,
    actions: {
      suppress_scheduling: true,
      keep_calendar_block: false,
      surface_to_qa: true,
      suppression_reason: 'partner_cancellation_requested'
    }
  },
  'CANCELLED': {
    jms_status: 'cancelled',
    bucket: 'cancelled',
    quote_bucket: null,
    include_in_quote_dashboard: false,
    actions: {
      suppress_scheduling: true,
      keep_calendar_block: false,
      surface_to_qa: true,
      suppression_reason: 'partner_cancelled'
    }
  },
  'ABANDONED': {
    jms_status: 'cancelled',
    bucket: 'cancelled',
    quote_bucket: null,
    include_in_quote_dashboard: false,
    actions: {
      suppress_scheduling: true,
      keep_calendar_block: false,
      surface_to_qa: true,
      suppression_reason: 'partner_abandoned'
    }
  },
  'AWAITING_QUOTATION': {
    jms_status: 'awaiting_install_booking',
    bucket: 'not_in_scheduling',
    quote_bucket: 'needs_quotation',
    include_in_quote_dashboard: true,
    actions: {
      suppress_scheduling: true,
      keep_calendar_block: false,
      surface_to_qa: false,
      suppression_reason: 'awaiting_quotation'
    }
  }
});

export default function AdminPartnerProfiles() {
  const { id: partnerId } = useParams<{ id: string }>();
  const { toast } = useToast();

  // Add defensive check for missing partnerId
  if (!partnerId) {
    toast({
      title: "Error",
      description: "Partner ID is required",
      variant: "destructive",
    });
    return null;
  }
  const queryClient = useQueryClient();
  const [editingProfile, setEditingProfile] = useState<ImportProfile | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDeleteProfileDialog, setShowDeleteProfileDialog] = useState<string | null>(null);
  const [showAuditDialog, setShowAuditDialog] = useState<string | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState<string | null>(null);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    source_type: 'csv' as 'csv' | 'gsheet',
    gsheet_id: '',
    gsheet_sheet_name: '',
    column_mappings: {} as Record<string, string>,
    status_mappings: {} as Record<string, string>,
    engineer_mapping_rules: [] as Array<any>,
    status_override_rules: {} as Record<string, boolean>,
    status_actions: {} as Record<string, any>,
    engineer_mappings: {} as Record<string, string>,
    job_duration_defaults: { installation: 3, assessment: 0.5, service_call: 1 } as Record<string, number>,
    is_active: true
  });

  const { data: partner } = useQuery({
    queryKey: ['partner', partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('id', partnerId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['partner-profiles', partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_import_profiles')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ImportProfile[];
    }
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Convert engineer_mappings Record to engineer_mapping_rules array
      const engineerMappingRules = Object.entries(data.engineer_mappings).map(([partnerIdentifier, engineerId]) => ({
        partner_identifier: partnerIdentifier,
        engineer_id: engineerId
      }));

      // Convert status_actions to status_mappings for backward compatibility
      const statusMappings = convertStatusActionsToMappings(data.status_actions);
      
      const { error } = await supabase
        .from('partner_import_profiles')
        .insert([{
          partner_id: partnerId,
          name: data.name,
          source_type: data.source_type,
          gsheet_id: data.gsheet_id || null,
          gsheet_sheet_name: data.gsheet_sheet_name || null,
          column_mappings: data.column_mappings,
          status_mappings: statusMappings,
          engineer_mapping_rules: engineerMappingRules,
          status_override_rules: data.status_override_rules,
          status_actions: data.status_actions,
          job_duration_defaults: data.job_duration_defaults,
          is_active: data.is_active
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-profiles', partnerId] });
      setShowCreateDialog(false);
      setEditingProfile(null);
      resetForm();
      toast({ title: editingProfile ? 'Import profile updated successfully' : 'Import profile created successfully' });
    },
    onError: (error) => {
      toast({ title: editingProfile ? 'Error updating profile' : 'Error creating profile', description: error.message, variant: 'destructive' });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!editingProfile) throw new Error('No profile selected for update');
      
      // Convert engineer_mappings Record to engineer_mapping_rules array
      const engineerMappingRules = Object.entries(data.engineer_mappings).map(([partnerIdentifier, engineerId]) => ({
        partner_identifier: partnerIdentifier,
        engineer_id: engineerId
      }));

      // Convert status_actions to status_mappings for backward compatibility
      const statusMappings = convertStatusActionsToMappings(data.status_actions);
      
      const { error } = await supabase
        .from('partner_import_profiles')
        .update({
          name: data.name,
          source_type: data.source_type,
          gsheet_id: data.gsheet_id || null,
          gsheet_sheet_name: data.gsheet_sheet_name || null,
          column_mappings: data.column_mappings,
          status_mappings: statusMappings,
          engineer_mapping_rules: engineerMappingRules,
          status_override_rules: data.status_override_rules,
          status_actions: data.status_actions,
          job_duration_defaults: data.job_duration_defaults,
          is_active: data.is_active
        })
        .eq('id', editingProfile.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-profiles', partnerId] });
      setShowCreateDialog(false);
      setEditingProfile(null);
      resetForm();
      toast({ title: 'Import profile updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error updating profile', description: error.message, variant: 'destructive' });
    }
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from('partner_import_profiles')
        .delete()
        .eq('id', profileId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-profiles', partnerId] });
      setShowDeleteProfileDialog(null);
      toast({ title: 'Import profile deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error deleting profile', description: error.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      source_type: 'csv',
      gsheet_id: '',
      gsheet_sheet_name: '',
      column_mappings: {},
      status_mappings: {} as Record<string, string>,
      engineer_mapping_rules: [],
      status_override_rules: {},
      status_actions: {} as Record<string, any>,
      engineer_mappings: {},
      job_duration_defaults: { installation: 3, assessment: 0.5, service_call: 1 },
      is_active: true
    });
    setEditingProfile(null);
  };

  const handleEdit = (profile: ImportProfile) => {
    setEditingProfile(profile);
    
    // Convert engineer_mapping_rules array to simple Record<string, string>
    const engineerMappings: Record<string, string> = {};
    if (profile.engineer_mapping_rules) {
      profile.engineer_mapping_rules.forEach((rule: any) => {
        if (rule.partner_identifier && rule.engineer_id) {
          engineerMappings[rule.partner_identifier] = rule.engineer_id;
        }
      });
    }
    
    // Normalize status_actions to ensure proper structure
    const normalizedStatusActions = profile.status_actions || {};
    
    setFormData({
      name: profile.name,
      source_type: profile.source_type,
      gsheet_id: profile.gsheet_id || '',
      gsheet_sheet_name: profile.gsheet_sheet_name || '',
      column_mappings: profile.column_mappings,
      status_mappings: profile.status_mappings || {} as Record<string, string>,
      engineer_mapping_rules: profile.engineer_mapping_rules,
      status_override_rules: profile.status_override_rules,
      status_actions: normalizedStatusActions as Record<string, any>,
      engineer_mappings: engineerMappings,
      job_duration_defaults: profile.job_duration_defaults || { installation: 3, assessment: 0.5, service_call: 1 },
      is_active: profile.is_active
    });
    setShowCreateDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProfile) {
      updateProfileMutation.mutate(formData);
    } else {
      createProfileMutation.mutate(formData);
    }
  };

  const triggerImport = async (profileId: string, csvData?: string, dryRun: boolean = true, createMissingOrders: boolean = true, startRow?: number, maxRows?: number) => {
    try {
      const body: any = {
        profile_id: profileId,
        dry_run: dryRun,
        create_missing_orders: createMissingOrders,
        benchmark_mode: false
      };
      
      if (csvData) {
        body.csv_data = csvData;
      }

      // Add chunking parameters
      if (startRow !== undefined) {
        body.start_row = startRow;
      }
      if (maxRows !== undefined) {
        body.max_rows = maxRows;
      }

      console.log('=== FRONTEND DEBUG ===');
      console.log('Calling partner-import with body:', body);
      console.log('ProfileId:', profileId);
      console.log('DryRun:', dryRun);
      console.log('Chunk:', startRow !== undefined ? `${startRow}-${(startRow || 0) + (maxRows || 150)}` : 'full');

      // Retry logic with exponential backoff for CORS/network issues
      let lastError;
      const maxRetries = 3;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const { data, error } = await supabase.functions.invoke('partner-import', {
            body
          });

          console.log('=== FUNCTION RESPONSE ===');
          console.log('Response data:', data);
          console.log('Response error:', error);

          if (error) {
            console.error('Supabase function error:', error);
            
            // Check if it's a CORS or network error that we should retry
            if (attempt < maxRetries && (
              error.message?.includes('CORS') ||
              error.message?.includes('Failed to send') ||
              error.message?.includes('fetch')
            )) {
              console.log(`Attempt ${attempt} failed with recoverable error, retrying in ${attempt * 1000}ms...`);
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
              lastError = error;
              continue;
            }
            
            throw error;
          }

          // Success case - handle response
          if (startRow === undefined && data.success) {
            toast({ 
              title: dryRun ? 'Dry run completed' : 'Import completed',
              description: `Processed ${data.summary.processed} rows. ${data.summary.inserted_count} inserted, ${data.summary.updated_count} updated, ${data.summary.skipped_count} skipped. ${data.summary.errors.length} errors.`
            });
            
            // Show performance metrics if available
            if (data.performance_metrics) {
              setPerformanceMetrics(data.performance_metrics);
              setShowPerformanceDialog(true);
            }
          } else if (startRow === undefined && !data.success) {
            toast({
              title: 'Import failed',
              description: data.unmapped_engineers ? `${data.unmapped_engineers.length} engineers need to be mapped` : 'Unknown error',
              variant: 'destructive'
            });
          }

          return data;
          
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) {
            console.log(`Attempt ${attempt} failed, retrying in ${attempt * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }
      }
      
      // If all retries failed, throw the last error
      throw lastError;
    } catch (error: any) {
      // Only show error toast for single imports (not chunks)
      if (startRow === undefined) {
        toast({ 
          title: 'Import failed', 
          description: error.message, 
          variant: 'destructive' 
        });
      }
      throw error; // Re-throw so the modal can handle it
    }
  };

  const runBenchmark = async (profileId: string) => {
    try {
      const body = {
        profile_id: profileId,
        dry_run: true,
        benchmark_mode: true,
        max_rows: 500 // Benchmark with first 500 rows
      };

      toast({
        title: 'Running benchmark...',
        description: 'Performance analysis in progress'
      });

      const { data, error } = await supabase.functions.invoke('partner-import', {
        body
      });

      if (error) {
        console.error('Benchmark error:', error);
        throw error;
      }

      if (data.success && data.performance_metrics) {
        setPerformanceMetrics(data.performance_metrics);
        setShowPerformanceDialog(true);
        toast({
          title: 'Benchmark completed',
          description: `Analyzed ${data.summary.processed} rows in ${Math.round(data.performance_metrics.overall_time_ms)}ms`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Benchmark failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading import profiles...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <TestPartnerImport />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Import Profiles</h1>
          <p className="text-muted-foreground">Partner: {partner?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Imported Jobs
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Profile
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProfile ? 'Edit Import Profile' : 'Create Import Profile'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Profile Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="source_type">Source Type</Label>
                  <Select 
                    value={formData.source_type} 
                    onValueChange={(value: 'csv' | 'gsheet') => setFormData({ ...formData, source_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV Upload</SelectItem>
                      <SelectItem value="gsheet">Google Sheets</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.source_type === 'gsheet' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gsheet_id">Google Sheet ID</Label>
                    <Input
                      id="gsheet_id"
                      value={formData.gsheet_id}
                      onChange={(e) => setFormData({ ...formData, gsheet_id: e.target.value })}
                      placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gsheet_sheet_name">Sheet Name</Label>
                    <Input
                      id="gsheet_sheet_name"
                      value={formData.gsheet_sheet_name}
                      onChange={(e) => setFormData({ ...formData, gsheet_sheet_name: e.target.value })}
                      placeholder="Sheet1"
                    />
                  </div>
                </div>
              )}

              <MappingConfiguration
                sourceType={formData.source_type}
                gsheetId={formData.gsheet_id}
                gsheetSheetName={formData.gsheet_sheet_name}
                columnMappings={formData.column_mappings}
                statusMappings={formData.status_mappings as Record<string, string>}
                statusOverrideRules={formData.status_override_rules}
                engineerMappings={formData.engineer_mappings}
                onColumnMappingsChange={(mappings) => setFormData({ ...formData, column_mappings: mappings })}
                onStatusMappingsChange={(mappings) => setFormData({ ...formData, status_mappings: mappings })}
                onStatusOverrideRulesChange={(rules) => setFormData({ ...formData, status_override_rules: rules })}
                onEngineerMappingsChange={(mappings) => setFormData({ ...formData, engineer_mappings: mappings })}
                hideStatusMappings={true}
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Job Duration Defaults</h3>
                </div>
                <div className="text-sm text-muted-foreground space-y-1 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p><strong>Set default durations (in hours) for job types:</strong></p>
                  <p>• Keys are normalized: "Service Call" becomes "service_call", "Installation - Standard" becomes "installationstandard"</p>
                  <p>• If no duration is provided in import data, these defaults will be used</p>
                  <p>• Leave empty to use system fallback (3 hours)</p>
                </div>
                <JobDurationDefaultsEditor
                  defaults={formData.job_duration_defaults}
                  onUpdate={(defaults) => setFormData({ ...formData, job_duration_defaults: defaults })}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Partner Status Mappings</h3>
                </div>
                <div className="text-sm text-muted-foreground space-y-1 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p><strong>Configure how partner statuses are handled:</strong></p>
                  <p>• <strong>JMS Status:</strong> The internal status jobs will be set to</p>
                  <p>• <strong>Bucket:</strong> Which scheduling bucket jobs will appear in</p>
                  <p>• <strong>Actions:</strong> Scheduling automation rules (suppress scheduling, keep calendar blocks, etc.)</p>
                  <p>• Changes take effect immediately on the next import</p>
                </div>
                <PartnerStatusMappingEditor
                  statusActions={formData.status_actions as Record<string, any>}
                  onUpdate={(statusActions) => setFormData({ ...formData, status_actions: statusActions })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active Profile</Label>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  💡 Column mappings are saved when you click "{editingProfile ? 'Update Profile' : 'Create Profile'}"
                </div>
                <div className="flex space-x-2">
                  <Button type="button" variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createProfileMutation.isPending || updateProfileMutation.isPending} size="lg">
                    {createProfileMutation.isPending || updateProfileMutation.isPending ? (
                      editingProfile ? 'Updating...' : 'Creating...'
                    ) : (
                      editingProfile ? 'Update Profile & Save Mappings' : 'Create Profile & Save Mappings'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid gap-4">
        {profiles?.map((profile) => (
          <Card key={profile.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {profile.name}
                  <Badge variant={profile.is_active ? 'default' : 'secondary'}>
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant="outline">
                    {profile.source_type.toUpperCase()}
                  </Badge>
                </CardTitle>
                {profile.source_type === 'gsheet' && profile.gsheet_id && (
                  <p className="text-sm text-muted-foreground">
                    Sheet: {profile.gsheet_id}/{profile.gsheet_sheet_name || 'Sheet1'}
                  </p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runBenchmark(profile.id)}
                >
                  <Activity className="h-4 w-4 mr-1" />
                  Benchmark
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAuditDialog(profile.id)}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Audit & Reconcile
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistoryDialog(profile.id)}
                >
                  <History className="h-4 w-4 mr-1" />
                  Import History
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowImportDialog(profile.id)}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Run Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(profile)}
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteProfileDialog(profile.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
                <ImportProfileActions 
                  profile={profile} 
                  onUpdate={() => {
                    queryClient.invalidateQueries({ queryKey: ['partner-profiles', partnerId] });
                  }} 
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Status mappings: {Object.keys(profile.status_mappings || {}).length} configured</p>
                <p>Bucket mappings: {Object.keys(profile.status_actions || {}).length} configured</p>
                <p>Column mappings: {Object.keys(profile.column_mappings || {}).length} configured</p>
                <p>Job duration defaults: {Object.keys(profile.job_duration_defaults || {}).length} configured</p>
                <p>Override rules: {Object.keys(profile.status_override_rules || {}).length} configured</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Import Audit Modal */}
      {showAuditDialog && (
        <PartnerImportAuditModal
          isOpen={!!showAuditDialog}
          onClose={() => setShowAuditDialog(null)}
          profileId={showAuditDialog}
          profileName={profiles?.find(p => p.id === showAuditDialog)?.name || 'Unknown Profile'}
        />
      )}

      {/* Import Run Modal */}
      {showImportDialog && (
        <ImportRunModal
          isOpen={!!showImportDialog}
          onClose={() => setShowImportDialog(null)}
          onImport={(csvData, dryRun, createMissingOrders, startRow, maxRows) => triggerImport(showImportDialog, csvData, dryRun, createMissingOrders, startRow, maxRows)}
          sourceType={profiles?.find(p => p.id === showImportDialog)?.source_type || 'csv'}
          gsheetId={profiles?.find(p => p.id === showImportDialog)?.gsheet_id || undefined}
          gsheetSheetName={profiles?.find(p => p.id === showImportDialog)?.gsheet_sheet_name || undefined}
        />
      )}

      {/* Import History Modal */}
      {showHistoryDialog && partnerId && partner && (
        <ImportHistoryModal
          isOpen={!!showHistoryDialog}
          onClose={() => setShowHistoryDialog(null)}
          partnerId={partnerId}
          partnerName={partner.name}
        />
      )}

      {/* Delete Jobs Modal */}
      {partnerId && partner && (
        <DeletePartnerJobsModal
          isOpen={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
          partnerId={partnerId}
          partnerName={partner.name}
        />
      )}

      {/* Delete Profile Confirmation Dialog */}
      <Dialog open={!!showDeleteProfileDialog} onOpenChange={() => setShowDeleteProfileDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Import Profile</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the profile "{profiles?.find(p => p.id === showDeleteProfileDialog)?.name}"? 
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowDeleteProfileDialog(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (showDeleteProfileDialog) {
                  deleteProfileMutation.mutate(showDeleteProfileDialog);
                }
              }}
              disabled={deleteProfileMutation.isPending}
            >
              {deleteProfileMutation.isPending ? 'Deleting...' : 'Delete Profile'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Performance Metrics Modal */}
      <Dialog open={showPerformanceDialog} onOpenChange={setShowPerformanceDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Performance Analysis</DialogTitle>
          </DialogHeader>
          {performanceMetrics && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Overall Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p>Total Time: <strong>{Math.round(performanceMetrics.overall_time_ms)}ms</strong></p>
                      <p>Rows/Second: <strong>{performanceMetrics.rows_per_second.toFixed(1)}</strong></p>
                      <p>Avg Row Time: <strong>{performanceMetrics.row_processing.average_time_ms.toFixed(1)}ms</strong></p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Database Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p>Total Calls: <strong>{performanceMetrics.database_calls.total_count}</strong></p>
                      <p>Client Queries: <strong>{performanceMetrics.database_calls.client_queries}</strong></p>
                      <p>Order Queries: <strong>{performanceMetrics.database_calls.order_queries}</strong></p>
                      <p>Insert Ops: <strong>{performanceMetrics.database_calls.insert_operations}</strong></p>
                      <p>Update Ops: <strong>{performanceMetrics.database_calls.update_operations}</strong></p>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Stage Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>Profile Fetch: <strong>{Math.round(performanceMetrics.stages.profile_fetch_ms)}ms</strong></div>
                    <div>Sheets Fetch: <strong>{Math.round(performanceMetrics.stages.sheets_fetch_ms)}ms</strong></div>
                    <div>Mappings: <strong>{Math.round(performanceMetrics.stages.mappings_fetch_ms)}ms</strong></div>
                    <div>Processing: <strong>{Math.round(performanceMetrics.stages.data_processing_ms)}ms</strong></div>
                    <div>Logging: <strong>{Math.round(performanceMetrics.stages.logging_ms)}ms</strong></div>
                  </div>
                </CardContent>
              </Card>

              {performanceMetrics.row_processing.slowest_rows.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Slowest Rows</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      {performanceMetrics.row_processing.slowest_rows.map((row: any, idx: number) => (
                        <div key={idx} className="flex justify-between">
                          <span>Row {row.row_index} ({row.partner_external_id || 'N/A'})</span>
                          <span><strong>{Math.round(row.time_ms)}ms</strong></span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}