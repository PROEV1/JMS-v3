import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SurveyFormSchema } from '@/types/survey-forms';
import { DynamicSurveyField } from '@/components/survey/DynamicSurveyField';

interface FormPreviewModalProps {
  schema: SurveyFormSchema;
  onClose: () => void;
}

export function FormPreviewModal({ schema, onClose }: FormPreviewModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const currentStep = schema.steps[currentStepIndex];
  const progress = ((currentStepIndex + 1) / schema.steps.length) * 100;

  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  const canContinue = () => {
    // Check if all required fields in current step are filled
    return currentStep.fields.every(field => {
      if (!field.settings.required) return true;
      const value = formData[field.key];
      
      if (field.type === 'photo' || field.type === 'video' || field.type === 'file') {
        const minItems = field.settings.mediaSettings?.minItems || 0;
        return Array.isArray(value) && value.length >= minItems;
      }
      
      return value !== undefined && value !== null && value !== '';
    });
  };

  const nextStep = () => {
    if (currentStepIndex < schema.steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center justify-between">
            <span>Form Preview</span>
            <Badge variant="outline">Test Mode</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Header */}
        <div className="py-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-muted-foreground">
              Step {currentStepIndex + 1} of {schema.steps.length} • {currentStep.progressLabel || currentStep.title}
            </div>
            <div className="w-32">
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">{currentStep.title}</h2>
            {currentStep.description && (
              <p className="text-muted-foreground">{currentStep.description}</p>
            )}
          </div>

          <div className="space-y-6">
            {currentStep.fields.map(field => (
              <DynamicSurveyField
                key={field.key}
                field={field}
                value={formData[field.key]}
                onChange={(value) => handleFieldChange(field.key, value)}
                formData={formData}
              />
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="border-t p-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStepIndex === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close Preview
            </Button>
            
            {currentStepIndex === schema.steps.length - 1 ? (
              <Button disabled={!canContinue()}>
                Submit (Preview)
              </Button>
            ) : (
              <Button 
                onClick={nextStep}
                disabled={!canContinue()}
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}