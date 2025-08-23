import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { SurveyFormSchema, SurveyStep } from '@/types/survey-forms';
import { DynamicSurveyField } from './DynamicSurveyField';
import { DualBrandHeader } from './DualBrandHeader';
import { SurveyStepHeader } from './SurveyStepHeader';
import { useSurveyValidation } from '@/hooks/useSurveyValidation';
import { useToast } from '@/hooks/use-toast';

interface DynamicSurveyWizardProps {
  schema: SurveyFormSchema;
  orderId: string;
  partnerBrand?: {
    name: string;
    logo_url?: string;
  };
  existingResponses: Record<string, any>;
  existingMedia: any[];
  onSaveDraft: (responses: Record<string, any>, media: Record<string, any[]>) => Promise<void>;
  onSubmit: (responses: Record<string, any>, media: Record<string, any[]>) => Promise<void>;
}

export function DynamicSurveyWizard({
  schema,
  orderId,
  partnerBrand,
  existingResponses,
  existingMedia,
  onSaveDraft,
  onSubmit
}: DynamicSurveyWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, any>>(existingResponses);
  const [mediaData, setMediaData] = useState<Record<string, any[]>>(() => {
    // Convert existing media to field-keyed format
    const mediaByField: Record<string, any[]> = {};
    existingMedia.forEach(media => {
      if (media.field_key) {
        if (!mediaByField[media.field_key]) {
          mediaByField[media.field_key] = [];
        }
        mediaByField[media.field_key].push({
          url: media.file_url,
          name: media.file_name,
          type: media.media_type
        });
      }
    });
    return mediaByField;
  });
  const [saving, setSaving] = useState(false);

  const currentStepData = schema.steps[currentStep];
  const progress = ((currentStep + 1) / schema.steps.length) * 100;

  // Use the updated validation hook with the dynamic schema
  const { isValid, errors, canContinue } = useSurveyValidation(
    {
      ...Object.fromEntries(
        schema.steps.map(step => [
          step.key,
          Object.fromEntries(
            step.fields.map(field => [field.key, formData[field.key]])
          )
        ])
      ),
      // Add media validation
      chargerLocation: { photos: mediaData.charger_location_photos || [] },
      consumerUnit: { photos: mediaData.consumer_unit_photos || [] },
      consent: formData.consent
    },
    currentStep
  );

  const handleFieldChange = (fieldKey: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldKey]: value
    }));
  };

  const handleMediaChange = (fieldKey: string, files: any[]) => {
    setMediaData(prev => ({
      ...prev,
      [fieldKey]: files
    }));
  };

  const saveDraft = async () => {
    setSaving(true);
    try {
      await onSaveDraft(formData, mediaData);
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    if (canContinue && currentStep < schema.steps.length - 1) {
      // Auto-save when moving to next step
      await saveDraft();
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const submitSurvey = async () => {
    if (canContinue) {
      setSaving(true);
      try {
        await onSubmit(formData, mediaData);
      } finally {
        setSaving(false);
      }
    }
  };

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(formData).length > 0) {
        saveDraft();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [formData, mediaData]);

  return (
    <div className="min-h-screen bg-background">
      {/* Dual Brand Header */}
      {schema.designSettings.useDualBrand && partnerBrand && (
        <DualBrandHeader partnerBrand={{ 
          name: partnerBrand.name, 
          logo_url: partnerBrand.logo_url || '', 
          hex: '#0EA5E9' 
        }} />
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Step Header */}
        <SurveyStepHeader
          currentStep={currentStep + 1}
          totalSteps={schema.steps.length}
          stepTitle={currentStepData.title}
          progress={progress}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-8"
          >
            {/* Step Content */}
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold mb-2">{currentStepData.title}</h1>
                {currentStepData.description && (
                  <p className="text-muted-foreground">{currentStepData.description}</p>
                )}
              </div>

              {/* Dynamic Fields */}
              <div className="space-y-6">
                {currentStepData.fields.map(field => (
                  <DynamicSurveyField
                    key={field.key}
                    field={field}
                    value={field.type === 'photo' || field.type === 'video' || field.type === 'file' 
                      ? mediaData[field.key] 
                      : formData[field.key]
                    }
                    onChange={field.type === 'photo' || field.type === 'video' || field.type === 'file'
                      ? (value) => handleMediaChange(field.key, value)
                      : (value) => handleFieldChange(field.key, value)
                    }
                    formData={formData}
                  />
                ))}
              </div>

              {/* Validation Errors */}
              {errors.length > 0 && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                  <h3 className="font-medium text-destructive mb-2">Please complete the following:</h3>
                  <ul className="text-sm text-destructive space-y-1">
                    {errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save & finish later'}
            </Button>

            {currentStep === schema.steps.length - 1 ? (
              <Button
                onClick={submitSurvey}
                disabled={!canContinue || saving}
              >
                {saving ? 'Submitting...' : 'Submit Survey'}
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canContinue || saving}
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}