-- Add max_installs_per_day to engineers table
ALTER TABLE public.engineers 
ADD COLUMN max_installs_per_day INTEGER NOT NULL DEFAULT 2;

-- Add index for better performance on engineer capacity queries
CREATE INDEX idx_engineers_max_installs_per_day ON public.engineers(max_installs_per_day) WHERE max_installs_per_day > 0;