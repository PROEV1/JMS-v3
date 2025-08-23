import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit, Eye, Settings, Trash2 } from 'lucide-react';
import { useSurveyForms, useCreateSurveyForm, useDeleteSurveyForm } from '@/hooks/useSurveyForms';
import { DEFAULT_EV_INSTALL_TEMPLATE } from '@/types/survey-forms';
import { useToast } from '@/hooks/use-toast';

export default function AdminSurveyForms() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: forms, isLoading } = useSurveyForms();
  const createForm = useCreateSurveyForm();
  const deleteForm = useDeleteSurveyForm();

  const handleCreateForm = async () => {
    try {
      const result = await createForm.mutateAsync({
        name: 'New Survey Form',
        description: 'A new survey form',
        schema: DEFAULT_EV_INSTALL_TEMPLATE.schema
      });
      
      navigate(`/admin/survey-forms/${result.version.id}/edit`);
      toast({
        title: "Form created",
        description: "New survey form has been created"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create form",
        variant: "destructive"
      });
    }
  };

  const handleDeleteForm = async (formId: string, formName: string) => {
    try {
      await deleteForm.mutateAsync(formId);
      toast({
        title: "Form deleted",
        description: `"${formName}" has been deleted successfully`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete form",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Survey Forms</h1>
          <p className="text-muted-foreground">Manage survey forms and versions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate('/admin/survey-form-mappings')}
          >
            <Settings className="w-4 h-4 mr-2" />
            Survey Mappings
          </Button>
          <Button onClick={handleCreateForm}>
            <Plus className="w-4 h-4 mr-2" />
            Create Form
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {forms?.map((form) => (
          <Card key={form.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{form.name}</span>
                <div className="flex gap-2">
                  {form.survey_form_versions.map(version => (
                    <Badge key={version.id} variant={version.status === 'published' ? 'default' : 'secondary'}>
                      v{version.version_number} ({version.status})
                    </Badge>
                  ))}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{form.description}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/survey-forms/${form.survey_form_versions[0]?.id}/edit`)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/survey-forms/${form.survey_form_versions[0]?.id}/preview`)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Survey Form</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{form.name}"? This action cannot be undone and will remove all versions and associated data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteForm(form.id, form.name)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}