
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
import { Plus, Edit, Upload, FileSpreadsheet, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import MappingConfiguration from '@/components/admin/MappingConfiguration';
import ImportRunModal from '@/components/admin/ImportRunModal';
import { DeletePartnerJobsModal } from '@/components/admin/DeletePartnerJobsModal';

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
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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
  const [formData, setFormData] = useState({
    name: '',
    source_type: 'csv' as 'csv' | 'gsheet',
    gsheet_id: '',
    gsheet_sheet_name: '',
    column_mappings: {} as Record<string, string>,
    status_mappings: {} as Record<string, string>,
    engineer_mapping_rules: [] as Array<any>,
    status_override_rules: {} as Record<string, boolean>,
    engineer_mappings: {} as Record<string, string>, // Add this for UI convenience
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
      
      const { error } = await supabase
        .from('partner_import_profiles')
        .insert([{
          partner_id: partnerId,
          name: data.name,
          source_type: data.source_type,
          gsheet_id: data.gsheet_id || null,
          gsheet_sheet_name: data.gsheet_sheet_name || null,
          column_mappings: data.column_mappings,
          status_mappings: data.status_mappings,
          engineer_mapping_rules: engineerMappingRules,
          status_override_rules: data.status_override_rules,
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
      
      const { error } = await supabase
        .from('partner_import_profiles')
        .update({
          name: data.name,
          source_type: data.source_type,
          gsheet_id: data.gsheet_id || null,
          gsheet_sheet_name: data.gsheet_sheet_name || null,
          column_mappings: data.column_mappings,
          status_mappings: data.status_mappings,
          engineer_mapping_rules: engineerMappingRules,
          status_override_rules: data.status_override_rules,
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

  const resetForm = () => {
    setFormData({
      name: '',
      source_type: 'csv',
      gsheet_id: '',
      gsheet_sheet_name: '',
      column_mappings: {},
      status_mappings: {},
      engineer_mapping_rules: [],
      status_override_rules: {},
      engineer_mappings: {},
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
    
    setFormData({
      name: profile.name,
      source_type: profile.source_type,
      gsheet_id: profile.gsheet_id || '',
      gsheet_sheet_name: profile.gsheet_sheet_name || '',
      column_mappings: profile.column_mappings,
      status_mappings: profile.status_mappings,
      engineer_mapping_rules: profile.engineer_mapping_rules,
      status_override_rules: profile.status_override_rules,
      engineer_mappings: engineerMappings,
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

  const triggerImport = async (profileId: string, csvData?: string, dryRun: boolean = true, createMissingOrders: boolean = true) => {
    try {
      const body: any = {
        profile_id: profileId,
        dry_run: dryRun,
        create_missing_orders: createMissingOrders
      };
      
      if (csvData) {
        body.csv_data = csvData;
      }

      const { data, error } = await supabase.functions.invoke('partner-import', {
        body
      });

      if (error) throw error;

      toast({ 
        title: dryRun ? 'Dry run completed' : 'Import completed',
        description: `Processed ${data.summary.processed} rows. ${data.summary.inserted_count} inserted, ${data.summary.updated_count} updated, ${data.summary.skipped_count} skipped. ${data.summary.errors.length} errors.`
      });

      return data; // Return the result for the modal to display
    } catch (error: any) {
      toast({ 
        title: 'Import failed', 
        description: error.message, 
        variant: 'destructive' 
      });
      throw error; // Re-throw so the modal can handle it
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading import profiles...</div>;
  }

  return (
    <div className="p-6 space-y-6">
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
                statusMappings={formData.status_mappings}
                statusOverrideRules={formData.status_override_rules}
                engineerMappings={formData.engineer_mappings}
                onColumnMappingsChange={(mappings) => setFormData({ ...formData, column_mappings: mappings })}
                onStatusMappingsChange={(mappings) => setFormData({ ...formData, status_mappings: mappings })}
                onStatusOverrideRulesChange={(rules) => setFormData({ ...formData, status_override_rules: rules })}
                onEngineerMappingsChange={(mappings) => setFormData({ ...formData, engineer_mappings: mappings })}
              />

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
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Status mappings: {Object.keys(profile.status_mappings).length} configured</p>
                <p>Column mappings: {Object.keys(profile.column_mappings).length} configured</p>
                <p>Override rules: {Object.keys(profile.status_override_rules).length} configured</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Import Run Modal */}
      {showImportDialog && (
        <ImportRunModal
          isOpen={!!showImportDialog}
          onClose={() => setShowImportDialog(null)}
          onImport={(csvData, dryRun, createMissingOrders) => triggerImport(showImportDialog, csvData, dryRun, createMissingOrders)}
          sourceType={profiles?.find(p => p.id === showImportDialog)?.source_type || 'csv'}
          gsheetId={profiles?.find(p => p.id === showImportDialog)?.gsheet_id || undefined}
          gsheetSheetName={profiles?.find(p => p.id === showImportDialog)?.gsheet_sheet_name || undefined}
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
    </div>
  );
}
