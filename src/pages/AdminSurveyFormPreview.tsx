import React from 'react';
import { useParams } from 'react-router-dom';
import { useSurveyFormVersion } from '@/hooks/useSurveyForms';
import { FormPreviewModal } from '@/components/admin/forms/FormPreviewModal';

export default function AdminSurveyFormPreview() {
  const { versionId } = useParams<{ versionId: string }>();
  const { data: version, isLoading } = useSurveyFormVersion(versionId!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading preview...</div>
      </div>
    );
  }

  if (!version) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-destructive">Survey form not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <FormPreviewModal 
        schema={version.schema} 
        onClose={() => window.close()} 
      />
    </div>
  );
}