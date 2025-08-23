
-- 1) Extend order_status_enhanced with the new survey-related statuses
-- Note: This will fail if values already exist (expected behavior in Postgres < v14).
ALTER TYPE public.order_status_enhanced ADD VALUE 'awaiting_survey_submission';
ALTER TYPE public.order_status_enhanced ADD VALUE 'awaiting_survey_review';
ALTER TYPE public.order_status_enhanced ADD VALUE 'survey_approved';
ALTER TYPE public.order_status_enhanced ADD VALUE 'survey_rework_requested';

-- 2) Add a flag to orders to control if a survey is required (defaults to true)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS survey_required boolean NOT NULL DEFAULT true;

-- 3) Create survey enums and tables

-- Survey status enum (client-facing survey lifecycle)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'survey_status') THEN
    CREATE TYPE public.survey_status AS ENUM (
      'draft',            -- being filled by client
      'submitted',        -- client clicked submit
      'under_review',     -- ops reviewing
      'rework_requested', -- ops asked client to amend
      'resubmitted',      -- client re-submitted after rework
      'approved'          -- ops approved
    );
  END IF;
END$$;

-- Optional: media type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'survey_media_type') THEN
    CREATE TYPE public.survey_media_type AS ENUM ('image','video');
  END IF;
END$$;

-- Core survey table (supports rework cycles via multiple rows per order)
CREATE TABLE IF NOT EXISTS public.client_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  -- partner_id is useful for partner visibility checks; nullable for direct jobs
  partner_id uuid NULL REFERENCES public.partners(id),
  status public.survey_status NOT NULL DEFAULT 'draft',
  -- structured answers; wizard will write a normalized JSON map per step
  responses jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- status timestamps/notes
  submitted_at timestamptz NULL,
  reviewed_at timestamptz NULL,
  review_notes text NULL,
  rework_reason text NULL,
  resubmitted_at timestamptz NULL,
  -- auditing
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Media table for images/videos attached to a survey
CREATE TABLE IF NOT EXISTS public.client_survey_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.client_surveys(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  media_type public.survey_media_type NOT NULL,
  file_url text NOT NULL,
  file_name text NULL,
  file_size integer NULL,
  is_main boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  uploaded_by uuid NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- Useful indexes
CREATE INDEX IF NOT EXISTS idx_client_surveys_order_id_created_at
  ON public.client_surveys(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_survey_media_order_id
  ON public.client_survey_media(order_id);

CREATE INDEX IF NOT EXISTS idx_client_survey_media_survey_id_position
  ON public.client_survey_media(survey_id, position);

-- 4) RLS policies

ALTER TABLE public.client_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_survey_media ENABLE ROW LEVEL SECURITY;

-- Admins: manage everything
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='client_surveys' 
      AND policyname='Admins can manage all client surveys'
  ) THEN
    CREATE POLICY "Admins can manage all client surveys"
      ON public.client_surveys
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='client_survey_media' 
      AND policyname='Admins can manage all client survey media'
  ) THEN
    CREATE POLICY "Admins can manage all client survey media"
      ON public.client_survey_media
      FOR ALL
      USING (is_admin())
      WITH CHECK (is_admin());
  END IF;
END$$;

-- Clients: can manage their own survey (surveys for orders they own)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='client_surveys' 
      AND policyname='Clients can manage own surveys'
  ) THEN
    CREATE POLICY "Clients can manage own surveys"
      ON public.client_surveys
      FOR ALL
      USING (
        order_id IN (
          SELECT o.id
          FROM public.orders o
          JOIN public.clients c ON c.id = o.client_id
          WHERE c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        order_id IN (
          SELECT o.id
          FROM public.orders o
          JOIN public.clients c ON c.id = o.client_id
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='client_survey_media' 
      AND policyname='Clients can manage own survey media'
  ) THEN
    CREATE POLICY "Clients can manage own survey media"
      ON public.client_survey_media
      FOR ALL
      USING (
        order_id IN (
          SELECT o.id
          FROM public.orders o
          JOIN public.clients c ON c.id = o.client_id
          WHERE c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        order_id IN (
          SELECT o.id
          FROM public.orders o
          JOIN public.clients c ON c.id = o.client_id
          WHERE c.user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- Engineers: can view surveys for their assigned orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='client_surveys' 
      AND policyname='Engineers can view surveys for their orders'
  ) THEN
    CREATE POLICY "Engineers can view surveys for their orders"
      ON public.client_surveys
      FOR SELECT
      USING (
        order_id IN (
          SELECT o.id
          FROM public.orders o
          JOIN public.engineers e ON o.engineer_id = e.id
          WHERE e.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='client_survey_media' 
      AND policyname='Engineers can view survey media for their orders'
  ) THEN
    CREATE POLICY "Engineers can view survey media for their orders"
      ON public.client_survey_media
      FOR SELECT
      USING (
        order_id IN (
          SELECT o.id
          FROM public.orders o
          JOIN public.engineers e ON o.engineer_id = e.id
          WHERE e.user_id = auth.uid()
        )
      );
  END IF;
END$$;

-- Partner users: can view surveys for partner jobs they can access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='client_surveys' 
      AND policyname='Partners can view surveys for accessible partner jobs'
  ) THEN
    CREATE POLICY "Partners can view surveys for accessible partner jobs"
      ON public.client_surveys
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.orders o
          WHERE o.id = client_surveys.order_id
            AND o.is_partner_job = true
            AND can_access_partner_data(auth.uid(), o.partner_id)
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='client_survey_media' 
      AND policyname='Partners can view survey media for accessible partner jobs'
  ) THEN
    CREATE POLICY "Partners can view survey media for accessible partner jobs"
      ON public.client_survey_media
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.orders o
          WHERE o.id = client_survey_media.order_id
            AND o.is_partner_job = true
            AND can_access_partner_data(auth.uid(), o.partner_id)
        )
      );
  END IF;
END$$;

-- 5) Triggers to maintain updated_at and sync order status on survey changes

-- Reuse existing timestamp trigger function
DROP TRIGGER IF EXISTS trg_client_surveys_updated_at ON public.client_surveys;
CREATE TRIGGER trg_client_surveys_updated_at
  BEFORE UPDATE ON public.client_surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update order status when surveys change (insert/update/delete)
CREATE OR REPLACE FUNCTION public.update_order_status_on_survey_change()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_order_id uuid;
  order_record public.orders%ROWTYPE;
BEGIN
  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  IF v_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT * INTO order_record FROM public.orders WHERE id = v_order_id;
  IF FOUND THEN
    UPDATE public.orders
    SET status_enhanced = public.calculate_order_status_final(order_record),
        updated_at = now()
    WHERE id = v_order_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_update_order_status_on_survey_change ON public.client_surveys;
CREATE TRIGGER trg_update_order_status_on_survey_change
  AFTER INSERT OR UPDATE OR DELETE ON public.client_surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_order_status_on_survey_change();

-- 6) Update calculate_order_status_final() to include survey gating without breaking payment/agreement gating
CREATE OR REPLACE FUNCTION public.calculate_order_status_final(order_row orders)
RETURNS order_status_enhanced
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
  base_status order_status_enhanced;
  latest_survey RECORD;
BEGIN
  -- Respect manual override
  IF order_row.manual_status_override IS TRUE AND order_row.status_enhanced IS NOT NULL THEN
    RETURN order_row.status_enhanced;
  END IF;

  -- Partner On Hold (or explicit suppression) takes precedence
  IF (order_row.scheduling_suppressed IS TRUE)
     OR (order_row.partner_status IN ('ON_HOLD','SWITCH_JOB_SUB_TYPE_REQUESTED','WAITING_FOR_OHME_APPROVAL')) THEN
    RETURN 'on_hold_parts_docs'::order_status_enhanced;
  END IF;

  -- Partner Installed / Completion Pending => Completion Pending bucket
  IF order_row.partner_status IN ('INSTALLED','COMPLETION_PENDING') THEN
    RETURN 'install_completed_pending_qa'::order_status_enhanced;
  END IF;

  -- Partner Cancelled or Cancellation Requested => Cancelled
  IF order_row.partner_status IN ('CANCELLED','CANCELLATION_REQUESTED') THEN
    RETURN 'cancelled'::order_status_enhanced;
  END IF;

  -- If partner confirms install date and we have one, treat as scheduled
  IF order_row.partner_status = 'INSTALL_DATE_CONFIRMED'
     AND order_row.scheduled_install_date IS NOT NULL THEN
    RETURN 'scheduled'::order_status_enhanced;
  END IF;

  -- Compute base (payment, agreement, offers, scheduling, etc.)
  base_status := public.calculate_order_status_with_offers(order_row);

  -- Never hide payment/agreement gating
  IF base_status IN ('awaiting_payment'::order_status_enhanced, 'awaiting_agreement'::order_status_enhanced) THEN
    RETURN base_status;
  END IF;

  -- Survey gating applies only before a date is scheduled
  IF order_row.scheduled_install_date IS NULL AND COALESCE(order_row.survey_required, true) IS TRUE THEN
    SELECT * INTO latest_survey
    FROM public.client_surveys
    WHERE order_id = order_row.id
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN 'awaiting_survey_submission'::order_status_enhanced;
    END IF;

    IF latest_survey.status = 'rework_requested'::public.survey_status THEN
      RETURN 'survey_rework_requested'::order_status_enhanced;
    ELSIF latest_survey.status IN ('submitted'::public.survey_status, 'under_review'::public.survey_status, 'resubmitted'::public.survey_status) THEN
      RETURN 'awaiting_survey_review'::order_status_enhanced;
    ELSIF latest_survey.status = 'approved'::public.survey_status THEN
      -- keep as approved until scheduling happens
      RETURN 'survey_approved'::order_status_enhanced;
    ELSE
      -- draft or unknown -> still waiting on submission
      RETURN 'awaiting_survey_submission'::order_status_enhanced;
    END IF;
  END IF;

  -- Fall back to base logic
  RETURN base_status;
END;
$function$;
