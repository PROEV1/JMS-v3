-- Create missing order_status enum type
CREATE TYPE order_status AS ENUM (
  'active',
  'paused',
  'cancelled',
  'completed'
);