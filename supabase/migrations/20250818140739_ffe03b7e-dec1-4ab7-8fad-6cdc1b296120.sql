-- Update get_engineer_soft_holds function to properly count pending and accepted offers
CREATE OR REPLACE FUNCTION public.get_engineer_soft_holds(p_engineer_id uuid, p_date date)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT COUNT(*)::INT
    FROM job_offers jo
    LEFT JOIN orders o ON jo.order_id = o.id
    WHERE jo.engineer_id = p_engineer_id
      AND jo.offered_date::date = p_date
      AND jo.status IN ('pending', 'accepted')
      AND (
        (jo.status = 'pending' AND jo.expires_at > now()) OR
        (jo.status = 'accepted' AND (o.scheduled_install_date IS NULL OR o.scheduled_install_date::date != p_date))
      )
  );
END;
$function$;

-- Update get_engineer_daily_workload_with_holds to use the updated soft holds function
CREATE OR REPLACE FUNCTION public.get_engineer_daily_workload_with_holds(p_engineer_id uuid, p_date date)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT 
      COALESCE(confirmed_jobs, 0) + COALESCE(soft_holds, 0)
    FROM (
      SELECT COUNT(*) as confirmed_jobs
      FROM orders
      WHERE engineer_id = p_engineer_id
        AND scheduled_install_date::date = p_date
        AND status_enhanced NOT IN ('completed')
    ) confirmed
    CROSS JOIN (
      SELECT public.get_engineer_soft_holds(p_engineer_id, p_date) as soft_holds
    ) holds
  );
END;
$function$;

-- Create function to get engineer daily time with holds (including job offers)
CREATE OR REPLACE FUNCTION public.get_engineer_daily_time_with_holds(p_engineer_id uuid, p_date date)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  total_minutes INTEGER := 0;
  scheduled_minutes INTEGER := 0;
  offer_minutes INTEGER := 0;
BEGIN
  -- Calculate minutes from scheduled orders
  SELECT COALESCE(SUM((estimated_duration_hours * 60)::INTEGER), 0) INTO scheduled_minutes
  FROM orders
  WHERE engineer_id = p_engineer_id
    AND scheduled_install_date::date = p_date
    AND status_enhanced NOT IN ('completed');

  -- Calculate minutes from active job offers (not yet scheduled)
  SELECT COALESCE(SUM((o.estimated_duration_hours * 60)::INTEGER), 0) INTO offer_minutes
  FROM job_offers jo
  JOIN orders o ON jo.order_id = o.id
  LEFT JOIN orders scheduled_order ON (jo.order_id = scheduled_order.id AND scheduled_order.scheduled_install_date::date = p_date)
  WHERE jo.engineer_id = p_engineer_id
    AND jo.offered_date::date = p_date
    AND jo.status IN ('pending', 'accepted')
    AND (
      (jo.status = 'pending' AND jo.expires_at > now()) OR
      (jo.status = 'accepted' AND scheduled_order.id IS NULL)
    );

  total_minutes := scheduled_minutes + offer_minutes;
  
  RETURN total_minutes;
END;
$function$;