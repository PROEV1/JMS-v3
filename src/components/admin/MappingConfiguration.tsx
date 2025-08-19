import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, X, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MappingConfigurationProps {
  sourceType: 'csv' | 'gsheet';
  gsheetId?: string;
  gsheetSheetName?: string;
  columnMappings: Record<string, string>;
  statusMappings: Record<string, string>;
  statusOverrideRules: Record<string, boolean>;
  onColumnMappingsChange: (mappings: Record<string, string>) => void;
  onStatusMappingsChange: (mappings: Record<string, string>) => void;
  onStatusOverrideRulesChange: (rules: Record<string, boolean>) => void;
}

const ORDER_FIELDS = [
  { key: 'partner_external_id', label: 'Partner External ID', required: true },
  { key: 'partner_status', label: 'Partner Status', required: true },
  { key: 'scheduled_date', label: 'Scheduled Date', required: false },
  { key: 'sub_partner', label: 'Sub Partner', required: false },
  { key: 'partner_external_url', label: 'Partner External URL', required: false },
  { key: 'client_name', label: 'Client Name', required: false },
  { key: 'client_email', label: 'Client Email', required: false },
  { key: 'client_phone', label: 'Client Phone', required: false },
  { key: 'job_address', label: 'Job Address', required: false },
  { key: 'postcode', label: 'Postcode', required: false }
];

const STATUS_OPTIONS = [
  { key: 'awaiting_payment', label: 'Awaiting Payment' },
  { key: 'awaiting_agreement', label: 'Awaiting Agreement' },
  { key: 'awaiting_install_booking', label: 'Awaiting Install Booking' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'install_completed_pending_qa', label: 'Install Completed (Pending QA)' },
  { key: 'completed', label: 'Completed' }
];

export default function MappingConfiguration({
  sourceType,
  gsheetId,
  gsheetSheetName,
  columnMappings,
  statusMappings,
  statusOverrideRules,
  onColumnMappingsChange,
  onStatusMappingsChange,
  onStatusOverrideRulesChange
}: MappingConfigurationProps) {
  const { toast } = useToast();
  // Seed availableColumns with existing mapped values to ensure they're always visible
  const existingMappedColumns = Object.values(columnMappings).filter(Boolean);
  const [availableColumns, setAvailableColumns] = useState<string[]>(existingMappedColumns);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [newStatusMapping, setNewStatusMapping] = useState({ partner: '', internal: '' });
  const [newOverrideRule, setNewOverrideRule] = useState({ status: '', suppress: false });

  // Auto-load Google Sheet columns when component mounts if gsheetId is present
  useEffect(() => {
    if (sourceType === 'gsheet' && gsheetId && availableColumns.length === 0) {
      fetchGoogleSheetsPreview();
    }
  }, [sourceType, gsheetId]);

  // Update availableColumns when columnMappings change to ensure mapped values stay visible
  useEffect(() => {
    const mappedValues = Object.values(columnMappings).filter(Boolean);
    setAvailableColumns(prev => {
      const combined = [...new Set([...prev, ...mappedValues])];
      return combined;
    });
  }, [columnMappings]);

  const fetchGoogleSheetsPreview = async () => {
    if (!gsheetId) {
      toast({
        title: "Missing Sheet ID",
        description: "Please provide a Google Sheet ID first.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoadingPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-sheets-preview', {
        body: {
          gsheet_id: gsheetId,
          sheet_name: gsheetSheetName || 'Sheet1',
          preview_rows: 5
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Failed to connect to Google Sheets service');
      }
      
      if (data.success && data.headers) {
        // Preserve existing mapped columns and add new ones from the sheet
        const existingMappedColumns = Object.values(columnMappings).filter(Boolean);
        const allColumns = [...new Set([...existingMappedColumns, ...data.headers])];
        setAvailableColumns(allColumns);
        toast({
          title: "Success",
          description: `Loaded ${data.headers.length} columns from Google Sheet`,
        });
      } else {
        throw new Error(data.error || 'Failed to fetch sheet data');
      }
    } catch (error: any) {
      console.error('Failed to fetch Google Sheets preview:', error);
      
      let errorMessage = 'Failed to load Google Sheet columns. ';
      let actionMessage = '';
      
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        errorMessage += 'Sheet not found.';
        actionMessage = 'Please check the Sheet ID and make sure the sheet exists.';
      } else if (error.message?.includes('Access denied') || error.message?.includes('403')) {
        errorMessage += 'Access denied.';
        actionMessage = 'Please share the sheet with the service account email and grant view permissions.';
      } else if (error.message?.includes('credentials not configured')) {
        errorMessage += 'Service account not configured.';
        actionMessage = 'Please contact your administrator to configure Google Sheets access.';
      } else if (error.message?.includes('Invalid Google Service Account')) {
        errorMessage += 'Invalid service account credentials.';
        actionMessage = 'Please contact your administrator to check the Google Service Account setup.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      toast({
        title: "Error Loading Sheet",
        description: `${errorMessage} ${actionMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const updateColumnMapping = (orderField: string, sourceColumn: string) => {
    const newMappings = { ...columnMappings };
    if (sourceColumn && sourceColumn !== 'none') {
      newMappings[orderField] = sourceColumn;
    } else {
      delete newMappings[orderField];
    }
    onColumnMappingsChange(newMappings);
  };

  const addStatusMapping = () => {
    if (!newStatusMapping.partner || !newStatusMapping.internal) return;
    
    onStatusMappingsChange({
      ...statusMappings,
      [newStatusMapping.partner]: newStatusMapping.internal
    });
    setNewStatusMapping({ partner: '', internal: '' });
  };

  const removeStatusMapping = (partnerStatus: string) => {
    const newMappings = { ...statusMappings };
    delete newMappings[partnerStatus];
    onStatusMappingsChange(newMappings);
  };

  const addOverrideRule = () => {
    if (!newOverrideRule.status) return;
    
    onStatusOverrideRulesChange({
      ...statusOverrideRules,
      [newOverrideRule.status]: newOverrideRule.suppress
    });
    setNewOverrideRule({ status: '', suppress: false });
  };

  const removeOverrideRule = (status: string) => {
    const newRules = { ...statusOverrideRules };
    delete newRules[status];
    onStatusOverrideRulesChange(newRules);
  };

  return (
    <div className="space-y-6">
      {/* Column Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Column Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sourceType === 'gsheet' && gsheetId && (
              <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">Google Sheets Integration</h4>
                  <Button 
                    onClick={fetchGoogleSheetsPreview} 
                    disabled={isLoadingPreview}
                    variant="outline"
                    size="sm"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    {isLoadingPreview ? 'Loading...' : 'Load Columns'}
                  </Button>
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                  <p>• Ensure the Google Sheet is shared with the service account</p>
                  <p>• Grant "Viewer" permissions to the service account email</p>
                  <p>• Check that the Sheet ID is correct and the sheet exists</p>
                  {availableColumns.length === 0 && (
                    <p className="text-orange-600 dark:text-orange-400 font-medium">
                      → Click "Load Columns" to fetch available columns from your sheet
                    </p>
                  )}
                </div>
              </div>
            )}
            
            <div className="grid gap-4">
              {ORDER_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-4">
                  <div className="w-1/3">
                    <Label className="flex items-center gap-2">
                      {field.label}
                      {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    </Label>
                  </div>
                  <div className="w-2/3 space-y-1">
                    <Select
                      value={columnMappings[field.key] || 'none'}
                      onValueChange={(value) => updateColumnMapping(field.key, value === 'none' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select source column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- None --</SelectItem>
                        {availableColumns.map((column) => (
                          <SelectItem key={column} value={column}>
                            {column}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {columnMappings[field.key] && (
                      <div className="text-xs text-muted-foreground">
                        Currently mapped to: <span className="font-medium">{columnMappings[field.key]}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Status Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Add new mapping */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Partner Status</Label>
                <Input
                  value={newStatusMapping.partner}
                  onChange={(e) => setNewStatusMapping({ ...newStatusMapping, partner: e.target.value })}
                  placeholder="e.g., AWAITING_INSTALL_DATE"
                />
              </div>
              <div className="flex-1">
                <Label>Maps To</Label>
                <Select
                  value={newStatusMapping.internal}
                  onValueChange={(value) => setNewStatusMapping({ ...newStatusMapping, internal: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select internal status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.key} value={status.key}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={addStatusMapping} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Existing mappings */}
            <div className="space-y-2">
              {Object.entries(statusMappings).map(([partnerStatus, internalStatus]) => (
                <div key={partnerStatus} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">{partnerStatus}</Badge>
                    <span>→</span>
                    <Badge>{STATUS_OPTIONS.find(s => s.key === internalStatus)?.label || internalStatus}</Badge>
                  </div>
                  <Button 
                    onClick={() => removeStatusMapping(partnerStatus)} 
                    variant="ghost" 
                    size="sm"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Override Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Status Override Rules</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Add new rule */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Partner Status</Label>
                <Input
                  value={newOverrideRule.status}
                  onChange={(e) => setNewOverrideRule({ ...newOverrideRule, status: e.target.value })}
                  placeholder="e.g., ON_HOLD"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newOverrideRule.suppress}
                  onCheckedChange={(checked) => setNewOverrideRule({ ...newOverrideRule, suppress: checked })}
                />
                <Label>Suppress Scheduling</Label>
              </div>
              <Button onClick={addOverrideRule} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Existing rules */}
            <div className="space-y-2">
              {Object.entries(statusOverrideRules).map(([status, suppress]) => (
                <div key={status} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">{status}</Badge>
                    <span>→</span>
                    <Badge variant={suppress ? 'destructive' : 'default'}>
                      {suppress ? 'Suppress Scheduling' : 'Allow Scheduling'}
                    </Badge>
                  </div>
                  <Button 
                    onClick={() => removeOverrideRule(status)} 
                    variant="ghost" 
                    size="sm"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
