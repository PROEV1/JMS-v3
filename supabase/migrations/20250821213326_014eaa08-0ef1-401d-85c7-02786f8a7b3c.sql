-- Update existing "Ohme Job Import" profile with exact mappings
UPDATE public.partner_import_profiles 
SET status_actions = '{
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
WHERE name = 'Ohme Job Import'
  AND partner_id IN (SELECT id FROM public.partners WHERE lower(name) = 'ohme');