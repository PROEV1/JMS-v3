-- Enable realtime for orders and job_offers tables
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.job_offers REPLICA IDENTITY FULL;

-- Add tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_offers;