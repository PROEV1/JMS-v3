
-- Add status enum type for message statuses
CREATE TYPE message_status AS ENUM ('sending', 'sent', 'delivered', 'failed');

-- Add status column to messages table
ALTER TABLE public.messages 
ADD COLUMN status message_status DEFAULT 'sent';

-- Update existing messages to have 'delivered' status
UPDATE public.messages SET status = 'delivered';
