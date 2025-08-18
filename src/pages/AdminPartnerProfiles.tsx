
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Upload, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

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
  const { partnerId } = useParams<{ partnerId: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingProfile, setEditingProfile] = useState<ImportProfile | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    source_type: 'csv' as 'csv' | 'gsheet',
    gsheet_id: '',
    gsheet_sheet_name: '',
    column_mappings: '{}',
    status_mappings: '{}',
    engineer_mapping_rules: '[]',
    status_override_rules: '{}',
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
      const { error } = await supabase
        .from('partner_import_profiles')
        .insert([{
          partner_id: partnerId,
          name: data.name,
          source_type: data.source_type,
          gsheet_id: data.gsheet_id || null,
          gsheet_sheet_name: data.gsheet_sheet_name || null,
          column_mappings: JSON.parse(data.column_mappings),
          status_mappings: JSON.parse(data.status_mappings),
          engineer_mapping_rules: JSON.parse(data.engineer_mapping_rules),
          status_override_rules: JSON.parse(data.status_override_rules),
          is_active: data.is_active
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-profiles', partnerId] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: 'Import profile created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error creating profile', description: error.message, variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      source_type: 'csv',
      gsheet_id: '',
      gsheet_sheet_name: '',
      column_mappings: '{}',
      status_mappings: '{}',
      engineer_mapping_rules: '[]',
      status_override_rules: '{}',
      is_active: true
    });
  };

  const handleEdit = (profile: ImportProfile) => {
    setEditingProfile(profile);
    setFormData({
      name: profile.name,
      source_type: profile.source_type,
      gsheet_id: profile.gsheet_id || '',
      gsheet_sheet_name: profile.gsheet_sheet_name || '',
      column_mappings: JSON.stringify(profile.column_mappings, null, 2),
      status_mappings: JSON.stringify(profile.status_mappings, null, 2),
      engineer_mapping_rules: JSON.stringify(profile.engineer_mapping_rules, null, 2),
      status_override_rules: JSON.stringify(profile.status_override_rules, null, 2),
      is_active: profile.is_active
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      JSON.parse(formData.column_mappings);
      JSON.parse(formData.status_mappings);
      JSON.parse(formData.engineer_mapping_rules);
      JSON.parse(formData.status_override_rules);
    } catch {
      toast({ title: 'Invalid JSON in configuration', variant: 'destructive' });
      return;
    }

    createProfileMutation.mutate(formData);
  };

  const triggerImport = async (profileId: string, dryRun: boolean = true) => {
    try {
      const { data, error } = await supabase.functions.invoke('partner-import', {
        body: {
          profile_id: profileId,
          dry_run: dryRun
        }
      });

      if (error) throw error;

      toast({ 
        title: dryRun ? 'Dry run completed' : 'Import completed',
        description: `Processed ${data.summary.processed} rows. ${data.summary.inserted_count} inserted, ${data.summary.updated_count} updated.`
      });
    } catch (error: any) {
      toast({ 
        title: 'Import failed', 
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Import Profiles</h1>
          <p className="text-muted-foreground">Partner: {partner?.name}</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingProfile(null); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Import Profile</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Select value={formData.source_type} onValueChange={(value: 'csv' | 'gsheet') => setFormData({ ...formData, source_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV Upload</SelectItem>
                    <SelectItem value="gsheet">Google Sheets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.source_type === 'gsheet' && (
                <>
                  <div>
                    <Label htmlFor="gsheet_id">Google Sheet ID</Label>
                    <Input
                      id="gsheet_id"
                      value={formData.gsheet_id}
                      onChange={(e) => setFormData({ ...formData, gsheet_id: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="gsheet_sheet_name">Sheet Name</Label>
                    <Input
                      id="gsheet_sheet_name"
                      value={formData.gsheet_sheet_name}
                      onChange={(e) => setFormData({ ...formData, gsheet_sheet_name: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="column_mappings">Column Mappings (JSON)</Label>
                <Textarea
                  id="column_mappings"
                  value={formData.column_mappings}
                  onChange={(e) => setFormData({ ...formData, column_mappings: e.target.value })}
                  placeholder='{"partner_status": "Status", "scheduled_date": "Install Date"}'
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="status_mappings">Status Mappings (JSON)</Label>
                <Textarea
                  id="status_mappings"
                  value={formData.status_mappings}
                  onChange={(e) => setFormData({ ...formData, status_mappings: e.target.value })}
                  placeholder='{"AWAITING_INSTALL_DATE": "awaiting_install_booking"}'
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="status_override_rules">Status Override Rules (JSON)</Label>
                <Textarea
                  id="status_override_rules"
                  value={formData.status_override_rules}
                  onChange={(e) => setFormData({ ...formData, status_override_rules: e.target.value })}
                  placeholder='{"ON_HOLD": true, "CANCELLATION_REQUESTED": true}'
                  rows={2}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                  onClick={() => triggerImport(profile.id, true)}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  Dry Run
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => triggerImport(profile.id, false)}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(profile)}
                >
                  <Edit className="h-4 w-4" />
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
    </div>
  );
}
