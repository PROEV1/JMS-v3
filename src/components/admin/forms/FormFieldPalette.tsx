import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Type, 
  FileText, 
  Hash, 
  DollarSign, 
  Mail, 
  Phone, 
  ChevronDown, 
  CheckSquare, 
  Calendar, 
  Clock, 
  MapPin, 
  File, 
  Image, 
  Video, 
  PenTool, 
  Navigation 
} from 'lucide-react';
import { SurveyField, SurveyFieldType } from '@/types/survey-forms';

interface FormFieldPaletteProps {
  onAddField: (field: SurveyField) => void;
  onClose: () => void;
}

const FIELD_TYPES: Array<{
  type: SurveyFieldType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: 'Text' | 'Selection' | 'Date & Time' | 'Media' | 'Special';
}> = [
  // Text
  { type: 'text', label: 'Text Input', description: 'Single line text', icon: <Type className="w-4 h-4" />, category: 'Text' },
  { type: 'long_text', label: 'Long Text', description: 'Multi-line text area', icon: <FileText className="w-4 h-4" />, category: 'Text' },
  { type: 'number', label: 'Number', description: 'Numeric input', icon: <Hash className="w-4 h-4" />, category: 'Text' },
  { type: 'currency', label: 'Currency', description: 'Money amount', icon: <DollarSign className="w-4 h-4" />, category: 'Text' },
  { type: 'email', label: 'Email', description: 'Email address', icon: <Mail className="w-4 h-4" />, category: 'Text' },
  { type: 'phone', label: 'Phone', description: 'Phone number', icon: <Phone className="w-4 h-4" />, category: 'Text' },
  
  // Selection
  { type: 'select', label: 'Dropdown', description: 'Single selection from list', icon: <ChevronDown className="w-4 h-4" />, category: 'Selection' },
  { type: 'multiselect', label: 'Multi-select', description: 'Multiple selections from list', icon: <CheckSquare className="w-4 h-4" />, category: 'Selection' },
  { type: 'radio', label: 'Radio Cards', description: 'Single choice with cards', icon: <CheckSquare className="w-4 h-4" />, category: 'Selection' },
  { type: 'checkbox', label: 'Checkbox', description: 'Single checkbox for consent', icon: <CheckSquare className="w-4 h-4" />, category: 'Selection' },
  
  // Date & Time
  { type: 'date', label: 'Date', description: 'Date picker', icon: <Calendar className="w-4 h-4" />, category: 'Date & Time' },
  { type: 'time', label: 'Time', description: 'Time picker', icon: <Clock className="w-4 h-4" />, category: 'Date & Time' },
  
  // Media
  { type: 'file', label: 'File Upload', description: 'General file upload', icon: <File className="w-4 h-4" />, category: 'Media' },
  { type: 'photo', label: 'Photo Upload', description: 'Image upload with preview', icon: <Image className="w-4 h-4" />, category: 'Media' },
  { type: 'video', label: 'Video Upload', description: 'Video file upload', icon: <Video className="w-4 h-4" />, category: 'Media' },
  
  // Special
  { type: 'address', label: 'Address', description: 'Multi-line address with postcode', icon: <MapPin className="w-4 h-4" />, category: 'Special' },
  { type: 'signature', label: 'Signature', description: 'Digital signature pad', icon: <PenTool className="w-4 h-4" />, category: 'Special' },
  { type: 'geotag', label: 'Location', description: 'GPS coordinates', icon: <Navigation className="w-4 h-4" />, category: 'Special' },
];

export function FormFieldPalette({ onAddField, onClose }: FormFieldPaletteProps) {
  const categories = Array.from(new Set(FIELD_TYPES.map(f => f.category)));

  const handleAddField = (type: SurveyFieldType) => {
    const fieldType = FIELD_TYPES.find(f => f.type === type);
    if (!fieldType) return;

    const newField: SurveyField = {
      key: '', // Will be set by parent
      type,
      order: 0, // Will be set by parent
      settings: {
        label: fieldType.label,
        required: false,
        ...(type === 'text' && { placeholder: 'Enter text here...' }),
        ...(type === 'long_text' && { placeholder: 'Enter detailed information...' }),
        ...(type === 'email' && { placeholder: 'example@email.com' }),
        ...(type === 'phone' && { placeholder: '+44 7XXX XXXXXX' }),
        ...(type === 'number' && { placeholder: '0' }),
        ...(type === 'currency' && { placeholder: '£0.00' }),
        ...((['select', 'multiselect', 'radio'].includes(type)) && {
          options: [
            { value: 'option1', label: 'Option 1' },
            { value: 'option2', label: 'Option 2' }
          ]
        }),
        ...((['photo', 'video', 'file'].includes(type)) && {
          mediaSettings: {
            maxItems: type === 'photo' ? 10 : 1,
            maxSizeMB: type === 'video' ? 100 : 10,
            ...(type === 'video' && { maxVideoLengthSeconds: 300 })
          }
        })
      }
    };

    onAddField(newField);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Field</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map(category => (
            <div key={category}>
              <h3 className="font-medium mb-3 text-sm text-muted-foreground">{category}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {FIELD_TYPES
                  .filter(field => field.category === category)
                  .map(field => (
                    <Card
                      key={field.type}
                      className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                      onClick={() => handleAddField(field.type)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="text-primary mt-1">
                            {field.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm mb-1">{field.label}</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {field.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}