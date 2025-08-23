import React from 'react';
import { MediaUploadZone } from '../MediaUploadZone';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle } from 'lucide-react';

interface ConsumerUnitStepProps {
  data: any;
  updateData: (key: string, value: any) => void;
  surveyId: string | null;
  orderId: string;
}

export function ConsumerUnitStep({ data, updateData, surveyId, orderId }: ConsumerUnitStepProps) {
  const consumerData = data.consumerUnit || {};

  const handleChange = (field: string, value: any) => {
    updateData('consumerUnit', {
      ...consumerData,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Consumer Unit Photos
        </h2>
        <p className="text-slate-600 text-sm">
          Photos of your electrical panel help us prepare for installation
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">What to photograph:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>The main consumer unit (fuse box/breaker panel)</li>
            <li>Any labels or markings on the unit</li>
            <li>Available spare slots for new circuits</li>
            <li>The area around the consumer unit</li>
          </ul>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="text-base font-medium mb-3 block">Consumer Unit Photos *</Label>
          <MediaUploadZone
            mediaType="image"
            surveyId={surveyId}
            orderId={orderId}
            uploadType="consumer_unit"
            maxFiles={4}
            minFiles={1}
            acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
            maxFileSize={8 * 1024 * 1024} // 8MB
          />
        </div>

        <div>
          <Label htmlFor="consumerNotes">Additional Information</Label>
          <Textarea
            id="consumerNotes"
            value={consumerData.consumerNotes || ''}
            onChange={(e) => handleChange('consumerNotes', e.target.value)}
            placeholder="Any concerns about your electrical setup, recent work done, or other relevant details..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}