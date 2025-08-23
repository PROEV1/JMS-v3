import React from 'react';
import { MediaUploadZone } from '../MediaUploadZone';
import { Label } from '@/components/ui/label';
import { AlertCircle, Video } from 'lucide-react';

interface VideoStepProps {
  data: any;
  updateData: (key: string, value: any) => void;
  surveyId: string | null;
  orderId: string;
}

export function VideoStep({ data, updateData, surveyId, orderId }: VideoStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Optional Video Walkthrough
        </h2>
        <p className="text-slate-600 text-sm">
          A short video can help us understand your installation requirements better
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Video className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-800">
            <p className="font-medium mb-1">Video Tips (Optional - Maximum 45 seconds):</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Start from your preferred charger location</li>
              <li>Show the path to your consumer unit</li>
              <li>Highlight any potential challenges or concerns</li>
              <li>Keep it brief and informative</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <Label className="text-base font-medium mb-3 block">Property Walkthrough Video (Optional)</Label>
          <MediaUploadZone
            mediaType="video"
            surveyId={surveyId}
            orderId={orderId}
            uploadType="walkthrough_video"
            maxFiles={1}
            minFiles={0}
            acceptedTypes={['video/mp4', 'video/quicktime', 'video/webm']}
            maxFileSize={50 * 1024 * 1024} // 50MB
            maxDuration={45} // 45 seconds
          />
        </div>

        <div className="bg-slate-50 rounded-lg p-4 text-center">
          <p className="text-sm text-slate-600">
            This step is completely optional. You can skip it and continue to submit your survey.
          </p>
        </div>
      </div>
    </div>
  );
}