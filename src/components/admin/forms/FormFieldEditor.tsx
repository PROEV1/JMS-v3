import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, X } from 'lucide-react';
import { SurveyField, SurveyFieldOption, SurveyFormSchema } from '@/types/survey-forms';

interface FormFieldEditorProps {
  field: SurveyField;
  onUpdate: (field: SurveyField) => void;
  onDelete: () => void;
  schema: SurveyFormSchema;
  stepKey: string;
  canEdit: boolean;
}

export function FormFieldEditor({
  field,
  onUpdate,
  onDelete,
  schema,
  stepKey,
  canEdit
}: FormFieldEditorProps) {
  const handleSettingChange = (key: keyof typeof field.settings, value: any) => {
    onUpdate({
      ...field,
      settings: {
        ...field.settings,
        [key]: value
      }
    });
  };

  const handleOptionChange = (index: number, key: keyof SurveyFieldOption, value: string) => {
    const options = [...(field.settings.options || [])];
    options[index] = { ...options[index], [key]: value };
    handleSettingChange('options', options);
  };

  const handleAddOption = () => {
    const options = [...(field.settings.options || [])];
    options.push({ value: '', label: '' });
    handleSettingChange('options', options);
  };

  const handleRemoveOption = (index: number) => {
    const options = [...(field.settings.options || [])];
    options.splice(index, 1);
    handleSettingChange('options', options);
  };

  const needsOptions = ['select', 'multiselect', 'radio'].includes(field.type);
  const needsMediaSettings = ['file', 'photo', 'video'].includes(field.type);
  const needsValidation = ['text', 'long_text', 'number', 'currency'].includes(field.type);

  // Get available fields for logic conditions (only fields from earlier steps)
  const availableFields = schema.steps
    .filter(step => step.order < schema.steps.find(s => s.key === stepKey)?.order!)
    .flatMap(step => step.fields)
    .filter(f => ['text', 'select', 'radio'].includes(f.type));

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Field Settings</h3>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Basic</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-medium mb-1 block">Field Type</label>
            <Badge variant="outline">{field.type.replace('_', ' ')}</Badge>
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Label</label>
            <Input
              value={field.settings.label}
              onChange={(e) => handleSettingChange('label', e.target.value)}
              placeholder="Field label"
              disabled={!canEdit}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Placeholder</label>
            <Input
              value={field.settings.placeholder || ''}
              onChange={(e) => handleSettingChange('placeholder', e.target.value)}
              placeholder="Placeholder text"
              disabled={!canEdit}
            />
          </div>

          <div>
            <label className="text-xs font-medium mb-1 block">Help Text</label>
            <Textarea
              value={field.settings.helpText || ''}
              onChange={(e) => handleSettingChange('helpText', e.target.value)}
              placeholder="Additional guidance for users"
              disabled={!canEdit}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-medium">Required</label>
            <Switch
              checked={field.settings.required}
              onCheckedChange={(checked) => handleSettingChange('required', checked)}
              disabled={!canEdit}
            />
          </div>

          {field.settings.defaultValue !== undefined && (
            <div>
              <label className="text-xs font-medium mb-1 block">Default Value</label>
              <Input
                value={field.settings.defaultValue || ''}
                onChange={(e) => handleSettingChange('defaultValue', e.target.value)}
                placeholder="Default value"
                disabled={!canEdit}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Options */}
      {needsOptions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Options
              {canEdit && (
                <Button size="sm" variant="outline" onClick={handleAddOption}>
                  <Plus className="w-3 h-3" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {field.settings.options?.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option.value}
                    onChange={(e) => handleOptionChange(index, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1"
                    disabled={!canEdit}
                  />
                  <Input
                    value={option.label}
                    onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                    placeholder="Label"
                    className="flex-1"
                    disabled={!canEdit}
                  />
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRemoveOption(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validation */}
      {needsValidation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Validation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {field.type === 'number' || field.type === 'currency' ? (
              <>
                <div>
                  <label className="text-xs font-medium mb-1 block">Min Value</label>
                  <Input
                    type="number"
                    value={field.settings.minValue || ''}
                    onChange={(e) => handleSettingChange('minValue', parseFloat(e.target.value) || undefined)}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Max Value</label>
                  <Input
                    type="number"
                    value={field.settings.maxValue || ''}
                    onChange={(e) => handleSettingChange('maxValue', parseFloat(e.target.value) || undefined)}
                    disabled={!canEdit}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium mb-1 block">Min Length</label>
                  <Input
                    type="number"
                    value={field.settings.minValue || ''}
                    onChange={(e) => handleSettingChange('minValue', parseInt(e.target.value) || undefined)}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Max Length</label>
                  <Input
                    type="number"
                    value={field.settings.maxValue || ''}
                    onChange={(e) => handleSettingChange('maxValue', parseInt(e.target.value) || undefined)}
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Regex Pattern</label>
                  <Input
                    value={field.settings.regex || ''}
                    onChange={(e) => handleSettingChange('regex', e.target.value)}
                    placeholder="Regular expression"
                    disabled={!canEdit}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Media Settings */}
      {needsMediaSettings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Media Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">Min Items</label>
              <Input
                type="number"
                value={field.settings.mediaSettings?.minItems || ''}
                onChange={(e) => handleSettingChange('mediaSettings', {
                  ...field.settings.mediaSettings,
                  minItems: parseInt(e.target.value) || undefined
                })}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Max Items</label>
              <Input
                type="number"
                value={field.settings.mediaSettings?.maxItems || ''}
                onChange={(e) => handleSettingChange('mediaSettings', {
                  ...field.settings.mediaSettings,
                  maxItems: parseInt(e.target.value) || undefined
                })}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Max Size (MB)</label>
              <Input
                type="number"
                value={field.settings.mediaSettings?.maxSizeMB || ''}
                onChange={(e) => handleSettingChange('mediaSettings', {
                  ...field.settings.mediaSettings,
                  maxSizeMB: parseInt(e.target.value) || undefined
                })}
                disabled={!canEdit}
              />
            </div>
            {field.type === 'video' && (
              <div>
                <label className="text-xs font-medium mb-1 block">Max Length (seconds)</label>
                <Input
                  type="number"
                  value={field.settings.mediaSettings?.maxVideoLengthSeconds || ''}
                  onChange={(e) => handleSettingChange('mediaSettings', {
                    ...field.settings.mediaSettings,
                    maxVideoLengthSeconds: parseInt(e.target.value) || undefined
                  })}
                  disabled={!canEdit}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logic Rules */}
      {canEdit && availableFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Logic Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Show or require this field based on answers to previous fields
            </p>
            {/* Simplified logic UI for v1 - can be expanded later */}
            <div className="text-xs text-muted-foreground">
              Logic rules will be available in a future update
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}