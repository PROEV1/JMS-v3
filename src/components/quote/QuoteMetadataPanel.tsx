import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Send, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Engineer {
  id: string;
  name: string;
  region: string | null;
}

interface ChargerModel {
  id: string;
  name: string;
  description: string | null;
  sku: string;
}

interface QuoteMetadata {
  quote_type: 'standard' | 'custom' | null;
  part_required: boolean;
  part_details: string | null;
  groundworks_required: boolean;
  multiple_engineers_required: boolean;
  specific_engineer_required: boolean;
  specific_engineer_id: string | null;
  expected_duration_days: number | null;
  charger_model_id: string | null;
  partner_id: string | null;
}

interface QuoteMetadataPanelProps {
  quoteId: string;
  initialData: QuoteMetadata;
  onSave: (data: QuoteMetadata) => Promise<void>;
  onSendQuote: () => Promise<void>;
  isReadOnly: boolean;
  isSaving: boolean;
  isSending: boolean;
}

export const QuoteMetadataPanel: React.FC<QuoteMetadataPanelProps> = ({
  quoteId,
  initialData,
  onSave,
  onSendQuote,
  isReadOnly,
  isSaving,
  isSending,
}) => {
  const [metadata, setMetadata] = useState<QuoteMetadata>(initialData);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [chargerModels, setChargerModels] = useState<ChargerModel[]>([]);
  const [loadingEngineers, setLoadingEngineers] = useState(false);
  const [loadingChargers, setLoadingChargers] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchEngineers();
    fetchChargerModels();
  }, []);

  useEffect(() => {
    setMetadata(initialData);
  }, [initialData]);

  const fetchEngineers = async () => {
    setLoadingEngineers(true);
    try {
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name, region')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setEngineers(data || []);
    } catch (error) {
      console.error('Error fetching engineers:', error);
      toast({
        title: "Error",
        description: "Failed to load engineers list",
        variant: "destructive",
      });
    } finally {
      setLoadingEngineers(false);
    }
  };

  const fetchChargerModels = async () => {
    setLoadingChargers(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('id, name, description, sku')
        .eq('is_charger', true)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setChargerModels(data || []);
    } catch (error) {
      console.error('Error fetching charger models:', error);
      toast({
        title: "Error",
        description: "Failed to load charger models",
        variant: "destructive",
      });
    } finally {
      setLoadingChargers(false);
    }
  };

  const updateMetadata = (field: keyof QuoteMetadata, value: any) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleQuoteTypeChange = (type: 'standard' | 'custom') => {
    setMetadata(prev => ({
      ...prev,
      quote_type: type === prev.quote_type ? null : type,
    }));
  };

  const handleSpecificEngineerChange = (checked: boolean) => {
    updateMetadata('specific_engineer_required', checked);
    if (!checked) {
      updateMetadata('specific_engineer_id', null);
    }
  };

  const handleSave = async () => {
    try {
      // Validate part details if part required
      if (metadata.part_required && !metadata.part_details?.trim()) {
        toast({
          title: "Validation Error",
          description: "Please provide part details when part is required",
          variant: "destructive",
        });
        return;
      }

      console.log('🔄 QuoteMetadataPanel: Saving quote metadata', {
        quoteId,
        metadata,
        quote_type: metadata.quote_type
      });

      await onSave(metadata);
      
      console.log('✅ QuoteMetadataPanel: Quote metadata saved successfully', {
        quoteId,
        quote_type: metadata.quote_type
      });
      
      toast({
        title: "Success",
        description: "Quote metadata saved successfully",
      });
    } catch (error) {
      console.error('❌ QuoteMetadataPanel: Failed to save quote metadata', error);
      toast({
        title: "Error",
        description: "Failed to save quote metadata",
        variant: "destructive",
      });
    }
  };

  const handleSendQuote = async () => {
    try {
      // Validate part details if part required
      if (metadata.part_required && !metadata.part_details?.trim()) {
        toast({
          title: "Validation Error",
          description: "Please provide part details when part is required",
          variant: "destructive",
        });
        return;
      }

      console.log('🚀 QuoteMetadataPanel: Sending quote', {
        quoteId,
        metadata,
        quote_type: metadata.quote_type
      });

      // Save current metadata first
      await onSave(metadata);
      
      console.log('✅ QuoteMetadataPanel: Metadata saved before sending quote');
      
      // Then send the quote
      await onSendQuote();
      
      console.log('✅ QuoteMetadataPanel: Quote sent successfully', {
        quoteId,
        quote_type: metadata.quote_type
      });
      
      toast({
        title: "Success",
        description: "Quote marked as quoted and sent to client",
      });
    } catch (error) {
      console.error('❌ QuoteMetadataPanel: Failed to send quote', error);
      toast({
        title: "Error",
        description: "Failed to send quote",
        variant: "destructive",
      });
    }
  };

  const getChargerDisplay = (charger: ChargerModel) => {
    return {
      name: charger.name,
      details: charger.sku,
    };
  };

  const selectedEngineer = engineers.find(e => e.id === metadata.specific_engineer_id);
  const selectedCharger = chargerModels.find(c => c.id === metadata.charger_model_id);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Quote Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quote Type Toggle */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Quote Type</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={metadata.quote_type === 'standard' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleQuoteTypeChange('standard')}
              disabled={isReadOnly}
              className="h-8 px-3 text-xs"
            >
              Quoted (Standard)
            </Button>
            <Button
              type="button"
              variant={metadata.quote_type === 'custom' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleQuoteTypeChange('custom')}
              disabled={isReadOnly}
              className="h-8 px-3 text-xs"
            >
              Quoted (Custom)
            </Button>
          </div>
        </div>

        {/* Quote Flags - Only show when quote type is selected */}
        {metadata.quote_type && (
          <div className="space-y-4">
            <Label className="text-sm font-medium">Quote Flags</Label>
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="part-required"
                    checked={metadata.part_required}
                    onCheckedChange={(checked) => {
                      updateMetadata('part_required', checked);
                      if (!checked) {
                        updateMetadata('part_details', null);
                      }
                    }}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor="part-required" className="text-sm">Part Required</Label>
                </div>

                {metadata.part_required && (
                  <div className="ml-6 space-y-1">
                    <Label htmlFor="part-details" className="text-xs text-muted-foreground">Part Details</Label>
                    <Textarea
                      id="part-details"
                      value={metadata.part_details || ''}
                      onChange={(e) => updateMetadata('part_details', e.target.value)}
                      placeholder="Describe the specific parts needed for this installation..."
                      className="h-20 text-sm"
                      disabled={isReadOnly}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="groundworks-required"
                  checked={metadata.groundworks_required}
                  onCheckedChange={(checked) => updateMetadata('groundworks_required', checked)}
                  disabled={isReadOnly}
                />
                <Label htmlFor="groundworks-required" className="text-sm">Groundworks Required</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="multiple-engineers"
                  checked={metadata.multiple_engineers_required}
                  onCheckedChange={(checked) => updateMetadata('multiple_engineers_required', checked)}
                  disabled={isReadOnly}
                />
                <Label htmlFor="multiple-engineers" className="text-sm">Multiple Engineers Required</Label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="specific-engineer"
                    checked={metadata.specific_engineer_required}
                    onCheckedChange={handleSpecificEngineerChange}
                    disabled={isReadOnly}
                  />
                  <Label htmlFor="specific-engineer" className="text-sm">Specific Engineer Required</Label>
                </div>

                {metadata.specific_engineer_required && (
                  <div className="ml-6 space-y-1">
                    <Label className="text-xs text-muted-foreground">Select Engineer</Label>
                    <Select
                      value={metadata.specific_engineer_id || ''}
                      onValueChange={(value) => updateMetadata('specific_engineer_id', value)}
                      disabled={isReadOnly || loadingEngineers}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Choose engineer..." />
                      </SelectTrigger>
                      <SelectContent>
                        {engineers.map((engineer) => (
                          <SelectItem key={engineer.id} value={engineer.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{engineer.name}</span>
                              {engineer.region && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {engineer.region}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Job Duration Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Expected Job Duration</Label>
          <Select
            value={metadata.expected_duration_days?.toString() || ''}
            onValueChange={(value) => updateMetadata('expected_duration_days', parseFloat(value))}
            disabled={isReadOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select duration..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.25">0.5 Hours</SelectItem>
              <SelectItem value="0.5">1 Hour</SelectItem>
              <SelectItem value="0.75">1.5 Hours</SelectItem>
              <SelectItem value="1">2 Hours</SelectItem>
              <SelectItem value="1.25">2.5 Hours</SelectItem>
              <SelectItem value="1.5">3 Hours</SelectItem>
              <SelectItem value="1.75">3.5 Hours</SelectItem>
              <SelectItem value="2">4 Hours</SelectItem>
              <SelectItem value="2.5">5 Hours</SelectItem>
              <SelectItem value="3">6 Hours</SelectItem>
              <SelectItem value="3.5">7 Hours</SelectItem>
              <SelectItem value="4">8 Hours (Full Day)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Duration will be used for internal planning unless overridden by partner system on job import.
          </p>
        </div>

        {/* Charger Model Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Charger Model Required</Label>
          <Select
            value={metadata.charger_model_id || ''}
            onValueChange={(value) => updateMetadata('charger_model_id', value)}
            disabled={isReadOnly || loadingChargers}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select charger model..." />
            </SelectTrigger>
            <SelectContent>
              {chargerModels.map((charger) => {
                const display = getChargerDisplay(charger);
                return (
                  <SelectItem key={charger.id} value={charger.id}>
                    <div className="space-y-1">
                      <div className="font-medium">{display.name}</div>
                      {display.details && (
                        <div className="text-xs text-muted-foreground">{display.details}</div>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Partner Warning */}
        {metadata.partner_id && (
          <div className="flex items-start space-x-2 p-3 bg-muted rounded-lg">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <strong>Note:</strong> Duration and charger model may be updated by the partner system on confirmation.
            </div>
          </div>
        )}

        {/* Action Buttons - Only Save and Mark as Quoted */}
        {!isReadOnly && (
          <div className="flex space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              onClick={handleSendQuote}
              disabled={isSending}
              className="flex-1"
            >
              <Send className="h-4 w-4 mr-2" />
              {isSending ? 'Sending...' : 'Mark as Quoted'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};