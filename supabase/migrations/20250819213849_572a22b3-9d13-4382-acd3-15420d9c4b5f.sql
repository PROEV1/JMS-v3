-- Create enum for order job types
CREATE TYPE order_job_type AS ENUM ('installation', 'assessment', 'service_call');

-- Add job_type column to orders table with default value
ALTER TABLE public.orders 
ADD COLUMN job_type order_job_type NOT NULL DEFAULT 'installation';