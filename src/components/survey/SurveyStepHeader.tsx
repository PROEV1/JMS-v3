import React from 'react';
import { Progress } from '@/components/ui/progress';

interface SurveyStepHeaderProps {
  currentStep: number;
  totalSteps: number;
  stepTitle: string;
  progress: number;
}

export function SurveyStepHeader({ currentStep, totalSteps, stepTitle, progress }: SurveyStepHeaderProps) {
  return (
    <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-slate-200 py-4 mb-6 -mx-4 px-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-slate-600">
          Step {currentStep} of {totalSteps} • {stepTitle}
        </div>
        <div className="w-32">
          <Progress value={progress} className="h-2" />
        </div>
      </div>
    </div>
  );
}