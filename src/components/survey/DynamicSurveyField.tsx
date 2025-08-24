import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SurveyField } from '@/types/survey-forms';
import { MediaUploadField } from './MediaUploadField';

interface DynamicSurveyFieldProps {
  field: SurveyField;
  value: any;
  onChange: (value: any) => void;
  formData: Record<string, any>;
}

export function DynamicSurveyField({ field, value, onChange, formData }: DynamicSurveyFieldProps) {
  const { settings } = field;

  // Check logic rules
  const shouldShow = !field.logic || field.logic.every(rule => {
    const conditionValue = formData[rule.condition.fieldKey];
    switch (rule.condition.operator) {
      case 'equals':
        return conditionValue === rule.condition.value;
      case 'not_equals':
        return conditionValue !== rule.condition.value;
      case 'contains':
        return String(conditionValue || '').includes(rule.condition.value);
      default:
        return true;
    }
  });

  if (!shouldShow) return null;

  const renderField = () => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <Input
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={settings.placeholder}
            required={settings.required}
          />
        );

      case 'long_text':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={settings.placeholder}
            required={settings.required}
            rows={4}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : '')}
            placeholder={settings.placeholder}
            required={settings.required}
            min={settings.minValue}
            max={settings.maxValue}
          />
        );

      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
            <Input
              type="number"
              value={value || ''}
              onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : '')}
              placeholder={settings.placeholder?.replace('£', '')}
              required={settings.required}
              min={settings.minValue}
              max={settings.maxValue}
              className="pl-8"
              step="0.01"
            />
          </div>
        );

      case 'select':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={settings.placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {settings.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <div className="grid gap-3">
            {settings.options?.map(option => (
              <Card
                key={option.value}
                className={`cursor-pointer transition-colors hover:bg-accent ${
                  value === option.value ? 'ring-2 ring-primary bg-accent' : ''
                }`}
                onClick={() => onChange(option.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      value === option.value ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}>
                      {value === option.value && (
                        <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                    <span className="font-medium">{option.label}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'multiselect':
        return (
          <div className="space-y-2">
            {settings.options?.map(option => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.key}_${option.value}`}
                  checked={Array.isArray(value) && value.includes(option.value)}
                  onCheckedChange={(checked) => {
                    const currentArray = Array.isArray(value) ? value : [];
                    if (checked) {
                      onChange([...currentArray, option.value]);
                    } else {
                      onChange(currentArray.filter(v => v !== option.value));
                    }
                  }}
                />
                <Label htmlFor={`${field.key}_${option.value}`}>{option.label}</Label>
              </div>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.key}
              checked={!!value}
              onCheckedChange={onChange}
              required={settings.required}
            />
            <Label htmlFor={field.key} className="text-sm">
              {settings.label}
            </Label>
          </div>
        );

      case 'date':
        return (
          <Input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={settings.required}
          />
        );

      case 'time':
        return (
          <Input
            type="time"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            required={settings.required}
          />
        );

      case 'photo':
      case 'video':
      case 'file':
        return (
          <MediaUploadField
            field={field}
            value={value}
            onChange={onChange}
          />
        );

      case 'address':
        return (
          <div className="space-y-4">
            <Input
              placeholder="Address Line 1"
              value={value?.line1 || ''}
              onChange={(e) => onChange({ ...value, line1: e.target.value })}
            />
            <Input
              placeholder="Address Line 2 (optional)"
              value={value?.line2 || ''}
              onChange={(e) => onChange({ ...value, line2: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="City"
                value={value?.city || ''}
                onChange={(e) => onChange({ ...value, city: e.target.value })}
              />
              <Input
                placeholder="Postcode"
                value={value?.postcode || ''}
                onChange={(e) => onChange({ ...value, postcode: e.target.value })}
              />
            </div>
          </div>
        );

      case 'signature':
        return (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">Digital signature pad preview</p>
            {value && (
              <Badge variant="outline" className="mt-2">Signature captured</Badge>
            )}
          </div>
        );

      case 'geotag':
        return (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">GPS location capture preview</p>
            {value && (
              <Badge variant="outline" className="mt-2">
                Location: {value.lat?.toFixed(6)}, {value.lng?.toFixed(6)}
              </Badge>
            )}
          </div>
        );

      default:
        return (
          <div className="text-muted-foreground text-sm">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  return (
    <div className="space-y-2">
      {field.type !== 'checkbox' && (
        <Label htmlFor={field.key} className="text-sm font-medium">
          {settings.label}
          {settings.required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      {renderField()}
      
      {settings.helpText && (
        <p className="text-xs text-muted-foreground">{settings.helpText}</p>
      )}
    </div>
  );
}