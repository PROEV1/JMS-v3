import React, { useState } from 'react';
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
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [newStatusMapping, setNewStatusMapping] = useState({ partner: '', internal: '' });
  const [newOverrideRule, setNewOverrideRule] = useState({ status: '', suppress: false });

  const fetchGoogleSheetsPreview = async () => {
    if (!gsheetId) return;
    
    setIsLoadingPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-sheets-preview', {
        body: {
          gsheet_id: gsheetId,
          sheet_name: gsheetSheetName || 'Sheet1',
          preview_rows: 5
        }
      });

      if (error) throw error;

      if (data.success) {
        setAvailableColumns(data.headers || []);
        toast({ title: 'Sheet preview loaded successfully' });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({ 
        title: 'Failed to load sheet preview', 
        description: error.message, 
        variant: 'destructive' 
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Column Mappings</CardTitle>
          {sourceType === 'gsheet' && gsheetId && (
            <Button 
              onClick={fetchGoogleSheetsPreview} 
              disabled={isLoadingPreview}
              variant="outline"
              size="sm"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              {isLoadingPreview ? 'Loading...' : 'Load Columns'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {ORDER_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-4">
                <div className="w-1/3">
                  <Label className="flex items-center gap-2">
                    {field.label}
                    {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                  </Label>
                </div>
                <div className="w-2/3">
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
                </div>
              </div>
            ))}
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
