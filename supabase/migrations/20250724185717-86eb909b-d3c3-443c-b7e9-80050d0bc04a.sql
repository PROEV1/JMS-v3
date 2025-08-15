-- Expand admin_settings with default configurations for all integrations
INSERT INTO public.admin_settings (setting_key, setting_value) VALUES 
(
  'stripe_config',
  '{
    "environment": "test",
    "test_publishable_key": "",
    "test_secret_key": "",
    "live_publishable_key": "",
    "live_secret_key": "",
    "test_webhook_endpoint": "",
    "live_webhook_endpoint": "",
    "test_product_prices": {
      "deposit": "price_test_deposit",
      "full_payment": "price_test_full"
    },
    "live_product_prices": {
      "deposit": "",
      "full_payment": ""
    }
  }'::jsonb
),
(
  'email_config',
  '{
    "provider": "resend",
    "smtp_host": "",
    "smtp_port": 587,
    "smtp_username": "",
    "smtp_password": "",
    "from_email": "",
    "from_name": "ProSpaces",
    "templates": {
      "quote_sent": "default",
      "payment_received": "default",
      "order_confirmed": "default"
    }
  }'::jsonb
),
(
  'sms_config',
  '{
    "provider": "twilio",
    "account_sid": "",
    "auth_token": "",
    "from_number": "",
    "templates": {
      "order_update": "Your order {{order_number}} has been updated: {{status}}",
      "payment_reminder": "Payment reminder for order {{order_number}}. Amount due: {{amount}}"
    }
  }'::jsonb
),
(
  'notification_settings',
  '{
    "email_notifications": true,
    "sms_notifications": false,
    "auto_invoice_generation": true,
    "payment_reminders": true,
    "order_status_updates": true,
    "reminder_timing": {
      "first_reminder": 7,
      "second_reminder": 14,
      "final_reminder": 21
    }
  }'::jsonb
),
(
  'system_settings',
  '{
    "maintenance_mode": false,
    "feature_flags": {
      "online_payments": true,
      "sms_notifications": false,
      "file_uploads": true,
      "quote_sharing": true
    },
    "app_name": "ProSpaces",
    "support_email": "support@prospace.com",
    "default_currency": "USD",
    "timezone": "UTC"
  }'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;