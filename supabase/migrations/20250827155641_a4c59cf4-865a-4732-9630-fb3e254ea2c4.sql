-- Create geocode cache table for persistent postcode caching
CREATE TABLE public.geocode_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  postcode TEXT NOT NULL UNIQUE,
  longitude NUMERIC(10, 7) NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  hit_count INTEGER NOT NULL DEFAULT 1,
  last_accessed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX idx_geocode_cache_postcode ON public.geocode_cache(postcode);
CREATE INDEX idx_geocode_cache_expires_at ON public.geocode_cache(expires_at);

-- Enable RLS
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

-- Create policies - Allow read access for authenticated users, admin write access
CREATE POLICY "Allow authenticated users to read geocode cache" 
ON public.geocode_cache 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Allow edge functions to manage geocode cache" 
ON public.geocode_cache 
FOR ALL 
USING (auth.role() = 'service_role');

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_geocodes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.geocode_cache 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Create mapbox usage tracking table
CREATE TABLE public.mapbox_usage_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL, -- 'mapbox-distance' or 'postcode-lookup'
  api_type TEXT NOT NULL, -- 'geocoding', 'directions', 'matrix'
  call_count INTEGER NOT NULL DEFAULT 1,
  session_id TEXT, -- To group related calls
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_mapbox_usage_function_name ON public.mapbox_usage_tracking(function_name);
CREATE INDEX idx_mapbox_usage_api_type ON public.mapbox_usage_tracking(api_type);
CREATE INDEX idx_mapbox_usage_created_at ON public.mapbox_usage_tracking(created_at);
CREATE INDEX idx_mapbox_usage_session_id ON public.mapbox_usage_tracking(session_id);

-- Enable RLS
ALTER TABLE public.mapbox_usage_tracking ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow edge functions to write usage tracking" 
ON public.mapbox_usage_tracking 
FOR INSERT 
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Allow admins to read usage tracking" 
ON public.mapbox_usage_tracking 
FOR SELECT 
USING (public.is_admin());

-- Function to get geocode from cache or return null
CREATE OR REPLACE FUNCTION public.get_geocode_from_cache(p_postcode TEXT)
RETURNS TABLE(longitude NUMERIC, latitude NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Normalize postcode
  p_postcode := UPPER(REPLACE(p_postcode, ' ', ''));
  
  -- Try to get from cache (not expired)
  RETURN QUERY
  SELECT gc.longitude, gc.latitude
  FROM public.geocode_cache gc
  WHERE gc.postcode = p_postcode 
    AND gc.expires_at > now()
  LIMIT 1;
  
  -- Update hit count and last accessed if found
  UPDATE public.geocode_cache
  SET hit_count = hit_count + 1,
      last_accessed = now(),
      updated_at = now()
  WHERE postcode = p_postcode 
    AND expires_at > now();
END;
$$;

-- Function to store geocode in cache
CREATE OR REPLACE FUNCTION public.store_geocode_in_cache(p_postcode TEXT, p_longitude NUMERIC, p_latitude NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Normalize postcode
  p_postcode := UPPER(REPLACE(p_postcode, ' ', ''));
  
  -- Insert or update cache entry
  INSERT INTO public.geocode_cache (postcode, longitude, latitude)
  VALUES (p_postcode, p_longitude, p_latitude)
  ON CONFLICT (postcode) 
  DO UPDATE SET 
    longitude = EXCLUDED.longitude,
    latitude = EXCLUDED.latitude,
    cached_at = now(),
    expires_at = now() + INTERVAL '24 hours',
    hit_count = geocode_cache.hit_count + 1,
    last_accessed = now(),
    updated_at = now();
END;
$$;

-- Function to log mapbox usage
CREATE OR REPLACE FUNCTION public.log_mapbox_usage(p_function_name TEXT, p_api_type TEXT, p_call_count INTEGER DEFAULT 1, p_session_id TEXT DEFAULT NULL, p_metadata JSONB DEFAULT '{}')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.mapbox_usage_tracking (function_name, api_type, call_count, session_id, metadata)
  VALUES (p_function_name, p_api_type, p_call_count, p_session_id, p_metadata);
END;
$$;