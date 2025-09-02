
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Settings } from 'lucide-react';
import { toast } from 'sonner';

interface StatusMapping {
  partnerStatus: string;
  jmsStatus: string;
  bucket: string;
  actions: {
    suppress_scheduling?: boolean;
    suppression_reason?: string;
    keep_calendar_block?: boolean;
    release_calendar_block?: boolean;
    lock_scheduling?: boolean;
    surface_to_qa?: boolean;
  };
}

interface PartnerStatusMappingEditorProps {
  statusActions: Record<string, any>;
  onUpdate: (statusActions: Record<string, any>) => void;
}

const jmsStatusOptions = [
  'quote_accepted', 'awaiting_payment', 'payment_received', 'awaiting_agreement',
  'agreement_signed', 'awaiting_install_booking', 'scheduled', 'in_progress',
  'install_completed_pending_qa', 'completed', 'revisit_required', 'cancelled',
  'needs_scheduling', 'date_offered', 'date_accepted', 'date_rejected',
  'offer_expired', 'on_hold_parts_docs', 'awaiting_final_payment'
];

const bucketOptions = [
  'needs_scheduling', 'scheduled', 'completion_pending', 'completed',
  'on_hold', 'cancelled', 'not_in_scheduling'
];

export function PartnerStatusMappingEditor({ statusActions, onUpdate }: PartnerStatusMappingEditorProps) {
  const [mappings, setMappings] = useState<StatusMapping[]>(() => {
    return Object.entries(statusActions || {}).map(([partnerStatus, config]: [string, any]) => {
      // Backward compatibility: if create_calendar_block was true, set keep_calendar_block to true
      const actions = { ...config.actions || {} };
      if (actions.create_calendar_block && !actions.keep_calendar_block) {
        actions.keep_calendar_block = true;
      }
      // Remove create_calendar_block from actions
      delete actions.create_calendar_block;

      return {
        partnerStatus,
        jmsStatus: config.jms_status || 'awaiting_install_booking',
        bucket: config.bucket || 'needs_scheduling',
        actions
      };
    });
  });

  // Re-hydrate state when statusActions prop changes
  useEffect(() => {
    const newMappings = Object.entries(statusActions || {}).map(([partnerStatus, config]: [string, any]) => {
      // Backward compatibility: if create_calendar_block was true, set keep_calendar_block to true
      const actions = { ...config.actions || {} };
      if (actions.create_calendar_block && !actions.keep_calendar_block) {
        actions.keep_calendar_block = true;
      }
      // Remove create_calendar_block from actions
      delete actions.create_calendar_block;

      return {
        partnerStatus,
        jmsStatus: config.jms_status || 'awaiting_install_booking',
        bucket: config.bucket || 'needs_scheduling',
        actions
      };
    });
    setMappings(newMappings);
  }, [statusActions]);

  const addMapping = () => {
    setMappings([...mappings, {
      partnerStatus: '',
      jmsStatus: 'awaiting_install_booking',
      bucket: 'needs_scheduling',
      actions: {}
    }]);
  };

  const removeMapping = (index: number) => {
    const newMappings = mappings.filter((_, i) => i !== index);
    setMappings(newMappings);
    updateParent(newMappings);
  };

  const updateMapping = (index: number, field: keyof StatusMapping, value: any) => {
    const newMappings = [...mappings];
    if (field === 'actions') {
      newMappings[index].actions = { ...newMappings[index].actions, ...value };
    } else {
      newMappings[index][field] = value;
    }
    setMappings(newMappings);
    updateParent(newMappings);
  };

  const updateParent = (newMappings: StatusMapping[]) => {
    const statusActions = newMappings.reduce((acc, mapping) => {
      if (mapping.partnerStatus) {
        acc[mapping.partnerStatus] = {
          jms_status: mapping.jmsStatus,
          bucket: mapping.bucket,
          actions: mapping.actions
        };
      }
      return acc;
    }, {} as Record<string, any>);

    onUpdate(statusActions);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Partner Status Mappings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mappings.map((mapping, index) => (
          <Card key={index} className="p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Status Mapping #{index + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMapping(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Partner Status</Label>
                  <Input
                    value={mapping.partnerStatus}
                    onChange={(e) => updateMapping(index, 'partnerStatus', e.target.value.toUpperCase())}
                    placeholder="e.g., INSTALLED"
                  />
                </div>

                <div>
                  <Label>JMS Status</Label>
                  <Select
                    value={mapping.jmsStatus}
                    onValueChange={(value) => updateMapping(index, 'jmsStatus', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {jmsStatusOptions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Bucket</Label>
                  <Select
                    value={mapping.bucket}
                    onValueChange={(value) => updateMapping(index, 'bucket', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bucketOptions.map((bucket) => (
                        <SelectItem key={bucket} value={bucket}>
                          {bucket.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Actions</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`suppress-${index}`} className="text-sm">
                      Suppress Scheduling
                    </Label>
                    <Switch
                      id={`suppress-${index}`}
                      checked={mapping.actions.suppress_scheduling || false}
                      onCheckedChange={(checked) => 
                        updateMapping(index, 'actions', { suppress_scheduling: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor={`calendar-${index}`} className="text-sm">
                        Keep Calendar Block
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Maintain engineer's calendar block when this status is received
                      </p>
                    </div>
                    <Switch
                      id={`calendar-${index}`}
                      checked={mapping.actions.keep_calendar_block || false}
                      onCheckedChange={(checked) => 
                        updateMapping(index, 'actions', { keep_calendar_block: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor={`qa-${index}`} className="text-sm">
                      Surface to QA
                    </Label>
                    <Switch
                      id={`qa-${index}`}
                      checked={mapping.actions.surface_to_qa || false}
                      onCheckedChange={(checked) => 
                        updateMapping(index, 'actions', { surface_to_qa: checked })
                      }
                    />
                  </div>
                </div>

                {mapping.actions.suppress_scheduling && (
                  <div>
                    <Label>Suppression Reason</Label>
                    <Input
                      value={mapping.actions.suppression_reason || ''}
                      onChange={(e) => 
                        updateMapping(index, 'actions', { suppression_reason: e.target.value })
                      }
                      placeholder="e.g., awaiting_quotation"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}

        <Button type="button" onClick={addMapping} variant="outline" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Status Mapping
        </Button>
      </CardContent>
    </Card>
  );
}
