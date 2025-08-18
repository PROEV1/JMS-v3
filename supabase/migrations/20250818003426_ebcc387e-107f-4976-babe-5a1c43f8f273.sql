-- Setup pg_cron extension for offer expiration
SELECT cron.schedule(
  'expire-offers',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://qvppvstgconmzzjsryna.supabase.co/functions/v1/expire-offers',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cHB2c3RnY29ubXp6anNyeW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTYxNjEsImV4cCI6MjA3MDgzMjE2MX0.3hJXqRe_xTpIhdIIEDBgG-8qc23UCRMwpLaf2zV0Se8"}'::jsonb,
        body:='{"automated": true}'::jsonb
    ) as request_id;
  $$
);