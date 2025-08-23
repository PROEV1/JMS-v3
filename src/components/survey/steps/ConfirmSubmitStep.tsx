import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, Shield } from 'lucide-react';

interface ConfirmSubmitStepProps {
  data: any;
  updateData: (key: string, value: any) => void;
}

export function ConfirmSubmitStep({ data, updateData }: ConfirmSubmitStepProps) {
  const handleConsentChange = (checked: boolean) => {
    updateData('consent', checked);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Review & Submit
        </h2>
        <p className="text-slate-600 text-sm">
          Please review your submission and confirm your consent
        </p>
      </div>

      {/* Survey Summary */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <h3 className="font-medium text-slate-900 mb-4">Survey Summary</h3>
          
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Property Details</span>
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                Complete
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Parking & Access</span>
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                Complete
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Charger Location Photos</span>
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                Complete
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Consumer Unit Photos</span>
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-1" />
                Complete
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Video Walkthrough</span>
              <span className="text-slate-500">Optional</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Happens Next */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-6">
          <h3 className="font-medium text-blue-900 mb-4">What happens next?</h3>
          
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Review Process (1-2 business days)</p>
                <p>Our team will review your survey and photos to prepare for installation</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Installation Scheduling</p>
                <p>Once approved, we'll contact you to schedule your installation</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consent */}
      <div className="space-y-4">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="consent"
            checked={data.consent || false}
            onCheckedChange={handleConsentChange}
            className="mt-1"
          />
          <Label 
            htmlFor="consent" 
            className="text-sm text-slate-700 leading-relaxed cursor-pointer"
          >
            I confirm that the information provided is accurate and I consent to ProEV using 
            this data to prepare for my EV charger installation. I understand that any 
            inaccurate information may result in delays or additional costs.
          </Label>
        </div>
        
        <p className="text-xs text-slate-500 ml-6">
          Your data will be stored securely and used only for installation purposes. 
          See our privacy policy for more details.
        </p>
      </div>
    </div>
  );
}