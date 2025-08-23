import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Settings, ExternalLink } from 'lucide-react';
import { useSurveyFormMappings, useSurveyForms, useUpdateSurveyFormMapping } from '@/hooks/useSurveyForms';
import { useToast } from '@/hooks/use-toast';

export default function AdminSurveyFormMappings() {
  const { toast } = useToast();
  const { data: mappings, isLoading: mappingsLoading } = useSurveyFormMappings();
  const { data: forms, isLoading: formsLoading } = useSurveyForms();
  const updateMapping = useUpdateSurveyFormMapping();

  const handleMappingChange = async (contextType: 'direct' | 'partner', formVersionId: string) => {
    try {
      await updateMapping.mutateAsync({ contextType, formVersionId });
      toast({
        title: "Mapping updated",
        description: `Active survey form for ${contextType} orders has been updated`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update mapping",
        variant: "destructive"
      });
    }
  };

  const getActiveMapping = (contextType: 'direct' | 'partner') => {
    return mappings?.find(m => m.context_type === contextType);
  };

  const getPublishedVersions = () => {
    if (!forms) return [];
    
    return forms.flatMap(form => 
      form.survey_form_versions
        .filter(v => v.status === 'published')
        .map(version => ({
          id: version.id,
          label: `${form.name} v${version.version_number}`,
          formName: form.name,
          versionNumber: version.version_number
        }))
    );
  };

  if (mappingsLoading || formsLoading) {
    return <div className="p-6">Loading...</div>;
  }

  const publishedVersions = getPublishedVersions();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Survey Form Mappings</h1>
          <p className="text-muted-foreground">
            Configure which survey form is active for different order types
          </p>
        </div>
        <Button variant="outline" onClick={() => window.open('/admin/survey-forms', '_blank')}>
          <Settings className="w-4 h-4 mr-2" />
          Manage Forms
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Direct Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Direct Orders
              <Badge variant="outline">Pro EV Brand</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Survey form used for direct client orders after quote acceptance
            </p>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Active Form</label>
              <Select
                value={getActiveMapping('direct')?.form_version_id || ''}
                onValueChange={(value) => handleMappingChange('direct', value)}
                disabled={updateMapping.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a published form version" />
                </SelectTrigger>
                <SelectContent>
                  {publishedVersions.map(version => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {getActiveMapping('direct') && (
              <div className="p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Currently Active</p>
                    <p className="text-xs text-muted-foreground">
                      {getActiveMapping('direct')?.survey_form_versions.survey_forms.name} v{getActiveMapping('direct')?.survey_form_versions.version_number}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`/admin/survey-forms/${getActiveMapping('direct')?.form_version_id}/preview`} target="_blank">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Partner Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Partner Orders
              <Badge variant="outline">Dual Brand</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Survey form used for partner job orders when clients are created
            </p>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Active Form</label>
              <Select
                value={getActiveMapping('partner')?.form_version_id || ''}
                onValueChange={(value) => handleMappingChange('partner', value)}
                disabled={updateMapping.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a published form version" />
                </SelectTrigger>
                <SelectContent>
                  {publishedVersions.map(version => (
                    <SelectItem key={version.id} value={version.id}>
                      {version.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {getActiveMapping('partner') && (
              <div className="p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Currently Active</p>
                    <p className="text-xs text-muted-foreground">
                      {getActiveMapping('partner')?.survey_form_versions.survey_forms.name} v{getActiveMapping('partner')?.survey_form_versions.version_number}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`/admin/survey-forms/${getActiveMapping('partner')?.form_version_id}/preview`} target="_blank">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {publishedVersions.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground mb-4">
              No published survey forms available. Create and publish a form to enable mappings.
            </p>
            <Button asChild>
              <a href="/admin/survey-forms">
                <Settings className="w-4 h-4 mr-2" />
                Create Survey Form
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <strong>Direct Orders:</strong> When a client accepts a quote, they automatically receive a survey email with the active direct form.
          </div>
          <div>
            <strong>Partner Orders:</strong> When a partner creates a job, the client receives a survey email with the active partner form (with dual branding).
          </div>
          <div>
            <strong>Versioning:</strong> Only published form versions can be mapped. Once published, forms become immutable to ensure data consistency.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}