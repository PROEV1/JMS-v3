-- Create survey forms system tables
CREATE TABLE public.survey_forms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.survey_form_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.survey_forms(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMP WITH TIME ZONE,
  published_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(form_id, version_number)
);

CREATE TABLE public.survey_form_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  context_type TEXT NOT NULL CHECK (context_type IN ('direct', 'partner')),
  form_version_id UUID NOT NULL REFERENCES public.survey_form_versions(id),
  is_active BOOLEAN NOT NULL DEFAULT false,
  mapped_by UUID REFERENCES auth.users(id),
  mapped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(context_type) -- Only one active mapping per context
);

-- Add form_version_id to client_surveys to track which form version was used
ALTER TABLE public.client_surveys 
ADD COLUMN form_version_id UUID REFERENCES public.survey_form_versions(id);

-- Add field_key to client_survey_media to map to form fields
ALTER TABLE public.client_survey_media 
ADD COLUMN field_key TEXT;

-- Enable RLS on new tables
ALTER TABLE public.survey_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_form_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_form_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for survey_forms
CREATE POLICY "Admins can manage all survey forms" ON public.survey_forms
  FOR ALL USING (is_admin());

CREATE POLICY "Managers can view survey forms" ON public.survey_forms
  FOR SELECT USING (is_admin() OR is_manager());

-- RLS policies for survey_form_versions
CREATE POLICY "Admins can manage all survey form versions" ON public.survey_form_versions
  FOR ALL USING (is_admin());

CREATE POLICY "Managers can view survey form versions" ON public.survey_form_versions
  FOR SELECT USING (is_admin() OR is_manager());

-- RLS policies for survey_form_mappings
CREATE POLICY "Admins can manage survey form mappings" ON public.survey_form_mappings
  FOR ALL USING (is_admin());

CREATE POLICY "Managers can view survey form mappings" ON public.survey_form_mappings
  FOR SELECT USING (is_admin() OR is_manager());

-- Triggers for updated_at
CREATE TRIGGER update_survey_forms_updated_at
  BEFORE UPDATE ON public.survey_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_survey_form_versions_updated_at
  BEFORE UPDATE ON public.survey_form_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get active survey form for context
CREATE OR REPLACE FUNCTION public.get_active_survey_form(p_context_type TEXT)
RETURNS TABLE (
  form_id UUID,
  form_name TEXT,
  version_id UUID,
  version_number INTEGER,
  schema JSONB
)
LANGUAGE SQL
STABLE SECURITY DEFINER
AS $$
  SELECT 
    sf.id as form_id,
    sf.name as form_name,
    sfv.id as version_id,
    sfv.version_number,
    sfv.schema
  FROM survey_form_mappings sfm
  JOIN survey_form_versions sfv ON sfm.form_version_id = sfv.id
  JOIN survey_forms sf ON sfv.form_id = sf.id
  WHERE sfm.context_type = p_context_type 
    AND sfm.is_active = true
    AND sfv.status = 'published'
  LIMIT 1;
$$;