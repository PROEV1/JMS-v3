import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SurveyFormBuilder } from '@/components/admin/forms/SurveyFormBuilder';
import { useSurveyFormVersion, useUpdateSurveyFormVersion, usePublishSurveyFormVersion, useCreateNewDraftVersion } from '@/hooks/useSurveyForms';
import { useToast } from '@/hooks/use-toast';

export default function AdminSurveyFormEdit() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: version, isLoading } = useSurveyFormVersion(versionId!);
  const updateVersion = useUpdateSurveyFormVersion();
  const publishVersion = usePublishSurveyFormVersion();
  const createNewDraft = useCreateNewDraftVersion();
  
  const [localSchema, setLocalSchema] = useState(null);
  const [currentVersionId, setCurrentVersionId] = useState(versionId);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    if (version?.schema) {
      setLocalSchema(version.schema);
      setIsPublished(version.status === 'published');
    }
  }, [version?.schema, version?.status]);

  if (isLoading || !version || !localSchema) {
    return <div className="p-6">Loading...</div>;
  }

  const handleSave = async () => {
    try {
      await updateVersion.mutateAsync({
        versionId: version.id,
        schema: localSchema
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

  const handleSchemaChange = async (schema: any) => {
    // If the current version is published, create a new draft version
    if (isPublished && version) {
      try {
        const newVersion = await createNewDraft.mutateAsync({
          formId: version.form_id,
          schema: schema
        });
        
        // Update the URL to the new version
        navigate(`/admin/survey-forms/${newVersion.id}/edit`, { replace: true });
        setCurrentVersionId(newVersion.id);
        setIsPublished(false);
        
        toast({
          title: "New draft created",
          description: "Created a new draft version for editing"
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to create new draft version",
          variant: "destructive"
        });
        return;
      }
    }
    
    setLocalSchema(schema);
  };

  return (
    <SurveyFormBuilder
      schema={localSchema}
      onSchemaChange={handleSchemaChange}
      onSave={handleSave}
      onPublish={handlePublish}
      canPublish={!isPublished}
      isPublished={isPublished}
      saving={updateVersion.isPending}
      publishing={publishVersion.isPending}
    />
  );
}