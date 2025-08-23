import React from 'react';
import { MediaUploadZone } from '../MediaUploadZone';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle } from 'lucide-react';

interface ChargerLocationStepProps {
  data: any;
  updateData: (key: string, value: any) => void;
  surveyId: string | null;
  orderId: string;
}

export function ChargerLocationStep({ data, updateData, surveyId, orderId }: ChargerLocationStepProps) {
  const chargerData = data.chargerLocation || {};

  const handleChange = (field: string, value: any) => {
    updateData('chargerLocation', {
      ...chargerData,
      [field]: value,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Charger Location Photos
        </h2>
        <p className="text-slate-600 text-sm">
          Please take photos of where you'd like your charger installed
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3">
        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">Required: Minimum 3 photos</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Wide shot showing the full area</li>
            <li>Close-up of the proposed mounting surface</li>
            <li>Photo showing the route from charger to your consumer unit</li>
          </ul>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="text-base font-medium mb-3 block">Charger Location Photos *</Label>
          <MediaUploadZone
            mediaType="image"
            surveyId={surveyId}
            orderId={orderId}
            uploadType="charger_location"
            maxFiles={8}
            minFiles={3}
            acceptedTypes={['image/jpeg', 'image/png', 'image/webp']}
            maxFileSize={8 * 1024 * 1024} // 8MB
          />
        </div>

        <div>
          <Label htmlFor="locationNotes">Location Details</Label>
          <Textarea
            id="locationNotes"
            value={chargerData.locationNotes || ''}
            onChange={(e) => handleChange('locationNotes', e.target.value)}
            placeholder="Describe your preferred charger location, any concerns, or special requirements..."
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}