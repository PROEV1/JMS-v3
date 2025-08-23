import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SurveyForm, SurveyFormVersion, SurveyFormMapping, SurveyFormSchema } from '@/types/survey-forms';

export function useSurveyForms() {
  return useQuery({
    queryKey: ['survey-forms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_forms')
        .select(`
          *,
          survey_form_versions!inner (
            id,
            version_number,
            status,
            published_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (SurveyForm & { survey_form_versions: Pick<SurveyFormVersion, 'id' | 'version_number' | 'status' | 'published_at'>[] })[];
    }
  });
}

export function useSurveyFormVersions(formId: string) {
  return useQuery({
    queryKey: ['survey-form-versions', formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_form_versions')
        .select('*')
        .eq('form_id', formId)
        .order('version_number', { ascending: false });

      if (error) throw error;
      return data as unknown as SurveyFormVersion[];
    },
    enabled: !!formId
  });
}

export function useSurveyFormVersion(versionId: string) {
  return useQuery({
    queryKey: ['survey-form-version', versionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_form_versions')
        .select(`
          *,
          survey_forms (
            name,
            description
          )
        `)
        .eq('id', versionId)
        .single();

      if (error) throw error;
      return data as unknown as SurveyFormVersion & { survey_forms: Pick<SurveyForm, 'name' | 'description'> };
    },
    enabled: !!versionId
  });
}

export function useCreateSurveyForm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, description, schema }: { 
      name: string; 
      description?: string; 
      schema: SurveyFormSchema;
    }) => {
      // Create form
      const { data: form, error: formError } = await supabase
        .from('survey_forms')
        .insert({
          name,
          description
        })
        .select()
        .single();

      if (formError) throw formError;

      // Create initial version
      const { data: version, error: versionError } = await supabase
        .from('survey_form_versions')
        .insert({
          form_id: form.id,
          version_number: 1,
          schema: schema as any
        })
        .select()
        .single();

      if (versionError) throw versionError;

      return { form, version };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-forms'] });
    }
  });
}

export function useUpdateSurveyFormVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ versionId, schema }: { 
      versionId: string; 
      schema: SurveyFormSchema;
    }) => {
      const { data, error } = await supabase
        .from('survey_form_versions')
        .update({ schema: schema as any })
        .eq('id', versionId)
        .eq('status', 'draft') // Only allow updating drafts
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['survey-form-version', data.id] });
      queryClient.invalidateQueries({ queryKey: ['survey-form-versions', data.form_id] });
    }
  });
}

export function usePublishSurveyFormVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      const { data, error } = await supabase
        .from('survey_form_versions')
        .update({ 
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', versionId)
        .eq('status', 'draft') // Only allow publishing drafts
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['survey-form-version', data.id] });
      queryClient.invalidateQueries({ queryKey: ['survey-form-versions', data.form_id] });
      queryClient.invalidateQueries({ queryKey: ['survey-forms'] });
    }
  });
}

export function useCreateNewDraftVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ formId, schema }: { 
      formId: string; 
      schema: SurveyFormSchema;
    }) => {
      // Get the current max version number for this form
      const { data: versions, error: versionsError } = await supabase
        .from('survey_form_versions')
        .select('version_number')
        .eq('form_id', formId)
        .order('version_number', { ascending: false })
        .limit(1);

      if (versionsError) throw versionsError;

      const nextVersionNumber = versions.length > 0 ? versions[0].version_number + 1 : 1;

      // Create new version
      const { data: version, error: versionError } = await supabase
        .from('survey_form_versions')
        .insert({
          form_id: formId,
          version_number: nextVersionNumber,
          schema: schema as any,
          status: 'draft'
        })
        .select()
        .single();

      if (versionError) throw versionError;

      return version;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-forms'] });
      queryClient.invalidateQueries({ queryKey: ['survey-form-versions'] });
    }
  });
}

export function useSurveyFormMappings() {
  return useQuery({
    queryKey: ['survey-form-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_form_mappings')
        .select(`
          *,
          survey_form_versions (
            id,
            version_number,
            schema,
            survey_forms (
              name
            )
          )
        `)
        .eq('is_active', true);

      if (error) throw error;
      return data as unknown as (SurveyFormMapping & { 
        survey_form_versions: SurveyFormVersion & { 
          survey_forms: Pick<SurveyForm, 'name'> 
        } 
      })[];
    }
  });
}

export function useUpdateSurveyFormMapping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contextType, formVersionId }: { 
      contextType: 'direct' | 'partner'; 
      formVersionId: string;
    }) => {
      // First deactivate existing mapping
      await supabase
        .from('survey_form_mappings')
        .update({ is_active: false })
        .eq('context_type', contextType);

      // Then create new mapping
      const { data, error } = await supabase
        .from('survey_form_mappings')
        .insert({
          context_type: contextType,
          form_version_id: formVersionId,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['survey-form-mappings'] });
    }
  });
}

export function useActiveSurveyForm(contextType: 'direct' | 'partner') {
  return useQuery({
    queryKey: ['active-survey-form', contextType],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_active_survey_form', { p_context_type: contextType });

      if (error) throw error;
      return data[0] || null;
    }
  });
}