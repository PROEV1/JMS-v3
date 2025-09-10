import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SurveyFormBuilder } from '@/components/admin/forms/SurveyFormBuilder';
import { useSurveyFormVersion, useUpdateSurveyFormVersion, usePublishSurveyFormVersion, useCreateNewDraftVersion } from '@/hooks/useSurveyForms';
import { useToast } from '@/hooks/use-toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function AdminSurveyFormEdit() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Debug logging
  console.log('AdminSurveyFormEdit: versionId =', versionId);
  
  const { data: version, isLoading, error } = useSurveyFormVersion(versionId!);
  
  // Debug logging
  console.log('AdminSurveyFormEdit: version =', version);
  console.log('AdminSurveyFormEdit: isLoading =', isLoading);
  console.log('AdminSurveyFormEdit: error =', error);
  
  const updateVersion = useUpdateSurveyFormVersion();
  const publishVersion = usePublishSurveyFormVersion();
  const createNewDraft = useCreateNewDraftVersion();
  
  const [localSchema, setLocalSchema] = useState(null);
  const [currentVersionId, setCurrentVersionId] = useState(versionId);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    console.log('AdminSurveyFormEdit: useEffect triggered with version:', version);
    if (version?.schema) {
      console.log('AdminSurveyFormEdit: Setting schema:', version.schema);
      setLocalSchema(version.schema);
      setIsPublished(version.status === 'published');
    } else if (version && !version.schema) {
      // Handle case where version exists but schema is null/undefined
      console.error('Survey form version has no schema:', version);
      toast({
        title: "Error",
        description: "Survey form schema is missing or corrupted",
        variant: "destructive"
      });
    }
  }, [version?.schema, version?.status, toast, version]);

  // Show error if query failed
  if (error) {
    console.error('AdminSurveyFormEdit: Query error:', error);
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Error Loading Survey Form</h2>
          <p className="text-muted-foreground mb-4">
            Failed to load survey form: {error.message}
          </p>
          <Button onClick={() => navigate('/admin/survey-forms')}>
            Back to Survey Forms
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading survey form...</p>
        </div>
      </div>
    );
  }

  if (!version) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Survey Form Not Found</h2>
          <p className="text-muted-foreground mb-4">The survey form version you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/admin/survey-forms')}>
            Back to Survey Forms
          </Button>
        </div>
      </div>
    );
  }

  if (!localSchema) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Schema Error</h2>
          <p className="text-muted-foreground mb-4">This survey form has a corrupted or missing schema.</p>
          <Button onClick={() => navigate('/admin/survey-forms')}>
            Back to Survey Forms
          </Button>
        </div>
      </div>
    );
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
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}