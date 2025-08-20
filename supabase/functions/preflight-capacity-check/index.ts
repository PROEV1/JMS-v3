import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.52.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface PreflightRequest {
  order_id: string;
  engineer_id: string;
  offered_date: string;
  virtual_orders?: Array<{
    id: string;
    estimated_duration_hours?: number;
  }>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Preflight capacity check requested');

    const requestBody = await req.json();
    const { order_id, engineer_id, offered_date, virtual_orders = [] }: PreflightRequest = requestBody;

    // Validate required parameters to prevent UUID errors
    if (!order_id || !engineer_id || !offered_date) {
      console.error('Missing required parameters:', { order_id, engineer_id, offered_date, requestBody });
      return new Response(JSON.stringify({
        canFit: false,
        reason: 'Missing required parameters: order_id, engineer_id, or offered_date'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(order_id) || !uuidRegex.test(engineer_id)) {
      console.error('Invalid UUID format:', { order_id: order_id, engineer_id: engineer_id });
      return new Response(JSON.stringify({
        canFit: false,
        reason: 'Invalid UUID format for order_id or engineer_id'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // Get engineer details
    const { data: engineer, error: engineerError } = await supabase
      .from('engineers')
      .select(`
        *,
        engineer_availability(*)
      `)
      .eq('id', engineer_id)
      .single();

    if (engineerError || !engineer) {
      throw new Error('Engineer not found');
    }

    // Check if date is blocked by client
    const offeredDateOnly = new Date(offered_date).toISOString().split('T')[0];
    const { data: blockedDates, error: blockedDateError } = await supabase
      .from('client_blocked_dates')
      .select('*')
      .eq('client_id', order.client_id)
      .eq('blocked_date', offeredDateOnly);

    if (blockedDateError) {
      console.error('Error checking blocked dates:', blockedDateError);
    } else if (blockedDates && blockedDates.length > 0) {
      return new Response(JSON.stringify({
        canFit: false,
        reason: `Date blocked: ${blockedDates[0].reason || 'Client unavailable'}`
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check engineer availability on offered date
    const offerDate = new Date(offered_date);
    const dayOfWeek = offerDate.getDay();
    
    const workingHour = engineer.engineer_availability?.find(
      (wh: any) => wh.day_of_week === dayOfWeek && wh.is_available
    );

    if (!workingHour) {
      return new Response(JSON.stringify({
        canFit: false,
        reason: 'Engineer not available on this day of the week'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check engineer's daily capacity including existing offers and virtual orders
    const dateStr = offerDate.toISOString().split('T')[0];
    
    // Get current time commitments (with soft holds)
    const { data: currentTimeMinutes, error: timeError } = await supabase
      .rpc('get_engineer_daily_time_with_holds', {
        p_engineer_id: engineer_id,
        p_date: dateStr
      });

    if (timeError) {
      console.error('Error checking engineer time:', timeError);
      return new Response(JSON.stringify({
        canFit: false,
        reason: 'Error checking engineer availability'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate work day duration
    const startTime = workingHour.start_time.split(':').map(Number);
    const endTime = workingHour.end_time.split(':').map(Number);
    const workDayMinutes = (endTime[0] * 60 + endTime[1]) - (startTime[0] * 60 + startTime[1]);
    
    // Add estimated duration for this new job
    const jobDurationMinutes = (order.estimated_duration_hours || 3) * 60;
    
    // Add virtual orders from batch scheduling
    let virtualMinutes = 0;
    if (virtual_orders && virtual_orders.length > 0) {
      virtualMinutes = virtual_orders.reduce((total, vOrder) => {
        const duration = vOrder.estimated_duration_hours || 3;
        return total + (duration * 60);
      }, 0);
    }
    
    const totalWithNewJob = (currentTimeMinutes || 0) + jobDurationMinutes + virtualMinutes;
    
    // Allow 15 minutes leniency
    const lenienceMinutes = 15;
    const maxAllowedMinutes = workDayMinutes + lenienceMinutes;
    
    if (totalWithNewJob > maxAllowedMinutes) {
      const overage = totalWithNewJob - workDayMinutes;
      const overageHours = Math.floor(overage / 60);
      const overageMinutesRemainder = overage % 60;
      
      return new Response(JSON.stringify({
        canFit: false,
        reason: `Would exceed working hours by ${overageHours}h ${overageMinutesRemainder}m`,
        details: {
          currentMinutes: currentTimeMinutes || 0,
          virtualMinutes,
          jobMinutes: jobDurationMinutes,
          totalMinutes: totalWithNewJob,
          workDayMinutes,
          overageMinutes: overage
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check job count limit
    const { data: currentWorkload, error: workloadError } = await supabase
      .rpc('get_engineer_daily_workload_with_holds', {
        p_engineer_id: engineer_id,
        p_date: dateStr
      });

    if (workloadError) {
      console.error('Error checking engineer workload:', workloadError);
    }

    const virtualJobCount = virtual_orders ? virtual_orders.length : 0;
    const totalJobs = (currentWorkload || 0) + 1 + virtualJobCount;

    // Get admin settings for max jobs per day (default to 3 if not found)
    const { data: adminSettings } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'scheduling_config')
      .single();

    const maxJobsPerDay = adminSettings?.setting_value?.max_jobs_per_day || 3;

    if (totalJobs > maxJobsPerDay) {
      return new Response(JSON.stringify({
        canFit: false,
        reason: `Would exceed daily job limit (${totalJobs}/${maxJobsPerDay} jobs)`,
        details: {
          currentJobs: currentWorkload || 0,
          virtualJobs: virtualJobCount,
          maxJobs: maxJobsPerDay
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // All checks passed
    return new Response(JSON.stringify({
      canFit: true,
      reason: 'Capacity available',
      details: {
        currentMinutes: currentTimeMinutes || 0,
        virtualMinutes,
        jobMinutes: jobDurationMinutes,
        totalMinutes: totalWithNewJob,
        workDayMinutes,
        remainingMinutes: maxAllowedMinutes - totalWithNewJob,
        currentJobs: currentWorkload || 0,
        virtualJobs: virtualJobCount,
        totalJobs,
        maxJobs: maxJobsPerDay
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in preflight capacity check:', error);
    return new Response(JSON.stringify({
      canFit: false,
      reason: `Preflight error: ${error.message}`
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});