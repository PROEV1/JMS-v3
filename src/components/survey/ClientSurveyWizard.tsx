import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, Upload, Camera, FileText, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SurveyStepHeader } from './SurveyStepHeader';
import { DualBrandHeader } from './DualBrandHeader';
import { PropertyDetailsStep } from './steps/PropertyDetailsStep';
import { ParkingAccessStep } from './steps/ParkingAccessStep';
import { ChargerLocationStep } from './steps/ChargerLocationStep';
import { ConsumerUnitStep } from './steps/ConsumerUnitStep';
import { VideoStep } from './steps/VideoStep';
import { ConfirmSubmitStep } from './steps/ConfirmSubmitStep';
import { useSurveyValidation } from '@/hooks/useSurveyValidation';

interface SurveyData {
  [key: string]: any;
  propertyDetails: any;
  parkingAccess: any;
  chargerLocation: any;
  consumerUnit: any;
  video: any;
  consent: boolean;
}

interface PartnerBrand {
  name: string;
  logo_url: string;
  hex: string;
}

interface ClientSurveyWizardProps {
  orderId: string;
  clientId: string;
  partnerId?: string;
  partnerBrand?: PartnerBrand;
}

const steps = [
  { id: 'property', title: 'Property Details', component: PropertyDetailsStep },
  { id: 'parking', title: 'Parking & Access', component: ParkingAccessStep },
  { id: 'charger', title: 'Charger Location', component: ChargerLocationStep },
  { id: 'consumer', title: 'Consumer Unit', component: ConsumerUnitStep },
  { id: 'video', title: 'Optional Video', component: VideoStep },
  { id: 'confirm', title: 'Review & Submit', component: ConfirmSubmitStep },
];

export function ClientSurveyWizard({ orderId, clientId, partnerId, partnerBrand }: ClientSurveyWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [surveyData, setSurveyData] = useState<SurveyData>({
    propertyDetails: {},
    parkingAccess: {},
    chargerLocation: {},
    consumerUnit: {},
    video: {},
    consent: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [surveyId, setSurveyId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadExistingSurvey();
  }, [orderId]);

  const loadExistingSurvey = async () => {
    try {
      const { data: survey } = await supabase
        .from('client_surveys')
        .select('*')
        .eq('order_id', orderId)
        .eq('status', 'draft')
        .single();

      if (survey) {
        setSurveyId(survey.id);
        setSurveyData(survey.responses as any);
      }
    } catch (error) {
      console.error('Error loading survey:', error);
    }
  };

  const saveDraft = async () => {
    try {
      if (surveyId) {
        await supabase
          .from('client_surveys')
          .update({ responses: surveyData })
          .eq('id', surveyId);
      } else {
        const { data } = await supabase
          .from('client_surveys')
          .insert({
            order_id: orderId,
            client_id: clientId,
            partner_id: partnerId,
            status: 'draft',
            responses: surveyData,
          })
          .select()
          .single();

        if (data) setSurveyId(data.id);
      }
      toast({ title: 'Draft saved successfully' });
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({ title: 'Error saving draft', variant: 'destructive' });
    }
  };

  const submitSurvey = async () => {
    setIsLoading(true);
    try {
      if (surveyId) {
        await supabase
          .from('client_surveys')
          .update({
            responses: surveyData,
            status: 'submitted',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', surveyId);
      } else {
        await supabase
          .from('client_surveys')
          .insert({
            order_id: orderId,
            client_id: clientId,
            partner_id: partnerId,
            status: 'submitted',
            responses: surveyData,
            submitted_at: new Date().toISOString(),
          });
      }

      toast({ title: 'Survey submitted successfully!' });
      navigate('/survey-success');
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast({ title: 'Error submitting survey', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const updateStepData = (stepKey: keyof SurveyData, data: any) => {
    setSurveyData(prev => ({
      ...prev,
      [stepKey]: data,
    }));
  };

  const { canContinue, errors } = useSurveyValidation(surveyData, currentStep);

  const nextStep = () => {
    if (!canContinue) {
      toast({ title: errors[0] || 'Please complete all required fields', variant: 'destructive' });
      return;
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const CurrentStepComponent = steps[currentStep].component;

  return (
    <div className="min-h-screen bg-background">
      <DualBrandHeader partnerBrand={partnerBrand} />
      
      <div className="max-w-2xl mx-auto px-4 py-8">
        <SurveyStepHeader
          currentStep={currentStep + 1}
          totalSteps={steps.length}
          stepTitle={steps[currentStep].title}
          progress={progress}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Card className="mt-6 border-slate-200 shadow-sm rounded-xl">
              <CardContent className="p-6">
                <CurrentStepComponent
                  data={surveyData}
                  updateData={updateStepData}
                  surveyId={surveyId}
                  orderId={orderId}
                />
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <div className="flex items-center space-x-4">
            {currentStep > 0 && (
              <Button
                variant="ghost"
                onClick={prevStep}
                className="text-slate-600"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={saveDraft}
              className="text-slate-600"
            >
              Save & finish later
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button 
                onClick={nextStep} 
                disabled={!canContinue}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={submitSurvey}
                disabled={!canContinue || isLoading}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? 'Submitting...' : 'Submit Survey'}
              </Button>
            )}
          </div>
        </div>

        {/* Bottom reassurance */}
        <div className="text-center text-sm text-slate-500 mt-6 py-4 border-t border-slate-200">
          ~8–10 mins • Secure upload • Pause anytime
        </div>
      </div>
    </div>
  );
}