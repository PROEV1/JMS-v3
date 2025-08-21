
-- 1) Add configurable status_actions to partner import profiles
ALTER TABLE public.partner_import_profiles
ADD COLUMN IF NOT EXISTS status_actions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Helpful index for fast bucketing/counts (used by tiles)
CREATE INDEX IF NOT EXISTS idx_orders_suppressed_reason
ON public.orders (scheduling_suppressed, scheduling_suppressed_reason);

-- 3) Ensure "Ohme" partner exists
DO $$
DECLARE
  v_partner_id uuid;
BEGIN
  SELECT id INTO v_partner_id
  FROM public.partners
  WHERE lower(name) = 'ohme'
  LIMIT 1;

  IF v_partner_id IS NULL THEN
    INSERT INTO public.partners (name, slug, is_active)
    VALUES ('Ohme', 'ohme', true)
    RETURNING id INTO v_partner_id;
  END IF;
END $$;

-- 4) Seed "Ohme Job Import" profile with your mappings (only if it doesn't already exist)
DO $$
DECLARE
  v_partner_id uuid;
  v_exists boolean;
BEGIN
  SELECT id INTO v_partner_id
  FROM public.partners
  WHERE lower(name) = 'ohme'
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM public.partner_import_profiles
    WHERE partner_id = v_partner_id AND name = 'Ohme Job Import'
  ) INTO v_exists;

  IF NOT v_exists THEN
    INSERT INTO public.partner_import_profiles (
      partner_id,
      name,
      source_type,
      is_active,
      column_mappings,
      status_mappings,
      status_override_rules,
      engineer_mapping_rules,
      status_actions
    ) VALUES (
      v_partner_id,
      'Ohme Job Import',
      'csv',
      true,
      '{}'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      '[]'::jsonb,
      '{
        "INSTALLED": {
          "jms_status": "install_completed_pending_qa",
          "bucket": "completion_pending",
          "actions": { "keep_calendar_block": true, "surface_to_qa": true }
        },
        "AWAITING_QUOTATION": {
          "jms_status": "quote_accepted",
          "bucket": "not_in_scheduling",
          "actions": { "suppress_scheduling": true, "suppression_reason": "awaiting_quotation" }
        },
        "AWAITING_INSTALL_DATE": {
          "jms_status": "awaiting_install_booking",
          "bucket": "needs_scheduling",
          "actions": { "suppress_scheduling": false }
        },
        "INSTALL_DATE_CONFIRMED": {
          "jms_status": "scheduled",
          "bucket": "scheduled",
          "actions": { "create_calendar_block": true, "lock_scheduling": true }
        },
        "WAITING_FOR_OHME_APPROVAL": {
          "jms_status": "on_hold_parts_docs",
          "bucket": "on_hold",
          "actions": { "suppress_scheduling": true, "suppression_reason": "waiting_for_ohme_approval" }
        },
        "CANCELLATION_REQUESTED": {
          "jms_status": "cancelled",
          "bucket": "cancelled",
          "actions": { "release_calendar_block": true, "suppress_scheduling": true, "suppression_reason": "cancellation_requested" }
        },
        "ON_HOLD": {
          "jms_status": "on_hold_parts_docs",
          "bucket": "on_hold",
          "actions": { "suppress_scheduling": true, "suppression_reason": "on_hold" }
        },
        "SWITCH_JOB_SUB_TYPE_REQUESTED": {
          "jms_status": "on_hold_parts_docs",
          "bucket": "on_hold",
          "actions": { "suppress_scheduling": true, "suppression_reason": "switch_job_sub_type_requested" }
        },
        "ABANDONED": {
          "jms_status": "cancelled",
          "bucket": "cancelled",
          "actions": { "release_calendar_block": true, "suppress_scheduling": true, "suppression_reason": "abandoned" }
        },
        "COMPLETION_PENDING": {
          "jms_status": "install_completed_pending_qa",
          "bucket": "completion_pending",
          "actions": { "keep_calendar_block": true }
        },
        "CANCELLED": {
          "jms_status": "cancelled",
          "bucket": "cancelled",
          "actions": { "release_calendar_block": true, "suppress_scheduling": true, "suppression_reason": "cancelled" }
        },
        "COMPLETE": {
          "jms_status": "completed",
          "bucket": "completed",
          "actions": { "release_calendar_block": true }
        }
      }'::jsonb
    );
  END IF;
END $$;
