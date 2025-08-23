import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SurveyFormBuilder } from '@/components/admin/forms/SurveyFormBuilder';
import { useSurveyFormVersion, useUpdateSurveyFormVersion, usePublishSurveyFormVersion } from '@/hooks/useSurveyForms';
import { useToast } from '@/hooks/use-toast';

export default function AdminSurveyFormEdit() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: version, isLoading } = useSurveyFormVersion(versionId!);
  const updateVersion = useUpdateSurveyFormVersion();
  const publishVersion = usePublishSurveyFormVersion();

  if (isLoading || !version) {
    return <div className="p-6">Loading...</div>;
  }

  const handleSave = async () => {
    try {
      await updateVersion.mutateAsync({
        versionId: version.id,
        schema: version.schema
      });
      toast({
        title: "Form saved",
        description: "Your changes have been saved"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save form",
        variant: "destructive"
      });
    }
  };

  const handlePublish = async () => {
    try {
      await publishVersion.mutateAsync(version.id);
      toast({
        title: "Form published",
        description: "Form is now available for use"
      });
      navigate('/admin/survey-forms');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to publish form",
        variant: "destructive"
      });
    }
  };

  const handleSchemaChange = (schema: any) => {
    // Update local state - the actual save happens when user clicks save
  };

  return (
    <SurveyFormBuilder
      schema={version.schema}
      onSchemaChange={handleSchemaChange}
      onSave={handleSave}
      onPublish={handlePublish}
      canPublish={version.status === 'draft'}
      isPublished={version.status === 'published'}
      saving={updateVersion.isPending}
      publishing={publishVersion.isPending}
    />
  );
}