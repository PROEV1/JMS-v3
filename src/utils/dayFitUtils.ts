import { supabase } from '@/integrations/supabase/client';
import { Order, EngineerSettings, getOrderEstimatedHours, getOrderEstimatedMinutes } from './schedulingUtils';
import { getLiveDistance } from './schedulingUtils';

export interface DayFitResult {
  canFit: boolean;
  totalMinutes: number;
  workDayMinutes: number;
  overageMinutes: number;
  reasons: string[];
}

/**
 * Calculate if an engineer can fit all jobs and travel within their working day
 */
export async function calculateDayFit(
  engineer: EngineerSettings,
  date: Date,
  newOrder?: Order,
  lenienceMinutes: number = 15,
  additionalVirtualOrders: Order[] = [],
  enforceJobCount: boolean = true,
  jobCountLimitOverfill: number = 0
): Promise<DayFitResult> {
  try {
    // Get engineer's working hours for this day
    const dayOfWeek = date.getDay();
    const workingHour = engineer.working_hours.find(wh => wh.day_of_week === dayOfWeek);
    
    if (!workingHour || !workingHour.is_available) {
      return {
        canFit: false,
        totalMinutes: 0,
        workDayMinutes: 0,
        overageMinutes: 0,
        reasons: ['Engineer not available on this day']
      };
    }

    // Calculate work day duration - use 24 hours for subcontractors with ignore_working_hours
    let workDayMinutes: number;
    if (engineer.ignore_working_hours && engineer.is_subcontractor) {
      workDayMinutes = 24 * 60; // 24 hours for subcontractors ignoring working hours
    } else {
      const startTimeMinutes = parseTime(workingHour.start_time);
      const endTimeMinutes = parseTime(workingHour.end_time);
      workDayMinutes = (endTimeMinutes - startTimeMinutes) + lenienceMinutes;
    }

  // Get existing orders for this engineer on this date
  const dateStr = date.toISOString().split('T')[0];
  const { data: existingOrders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('engineer_id', engineer.id)
    .gte('scheduled_install_date', `${dateStr}T00:00:00`)
    .lt('scheduled_install_date', `${dateStr}T23:59:59`)
    .neq('status_enhanced', 'completed');

  if (error) throw error;

  // Get active job offers for this engineer on this date (soft holds)
  const { data: jobOffers, error: offersError } = await supabase
    .from('job_offers')
    .select(`
      *,
      orders!job_offers_order_id_fkey(*)
    `)
    .eq('engineer_id', engineer.id)
    .gte('offered_date', `${dateStr}T00:00:00`)
    .lt('offered_date', `${dateStr}T23:59:59`)
    .in('status', ['pending', 'accepted']);

  if (offersError) throw offersError;

  // Filter valid offers (pending non-expired or accepted non-scheduled)
  const validOffers = (jobOffers || []).filter(offer => {
    if (offer.status === 'pending' && new Date(offer.expires_at) > new Date()) return true;
    if (offer.status === 'accepted') {
      const order = offer.orders;
      return !order?.scheduled_install_date || new Date(order.scheduled_install_date).toDateString() !== date.toDateString();
    }
    return false;
  });

  // Include the new order if provided (convert to database format)
  const allOrders = [...(existingOrders || [])];
  
  // Add orders from valid job offers (soft holds)
  validOffers.forEach(offer => {
    const offerOrder = offer.orders;
    if (offerOrder && !allOrders.find(o => o.id === offerOrder.id)) {
      allOrders.push(offerOrder);
    }
  });

  // Add virtual orders from batch scheduling (for capacity simulation)
  additionalVirtualOrders.forEach(virtualOrder => {
    if (!allOrders.find(o => o.id === virtualOrder.id)) {
      // Convert virtual Order to database format
      const dbVirtualOrder = {
        ...virtualOrder,
        admin_qa_notes: null,
        agreement_document_url: null,
        agreement_signed_at: null,
        created_at: new Date().toISOString(),
        engineer_notes: null,
        engineer_signature_data: null,
        engineer_signed_off_at: null,
        installation_date: null,
        installation_notes: null,
        internal_install_notes: null,
        job_address: virtualOrder.job_address || null,
        manual_status_notes: null,
        manual_status_override: false,
        order_number: virtualOrder.order_number || 'VIRTUAL',
        quote_id: 'virtual-quote-id', // Not in Order interface but required by DB
        scheduling_conflicts: virtualOrder.scheduling_conflicts || [],
        travel_time_minutes: null,
        updated_at: new Date().toISOString(),
        estimated_duration_hours: getOrderEstimatedHours(virtualOrder),
        time_window: virtualOrder.time_window || null,
        postcode: virtualOrder.postcode || '',
        is_partner_job: virtualOrder.is_partner_job || false,
        // Ensure required fields are present
        status: virtualOrder.status || 'awaiting_payment',
        status_enhanced: (virtualOrder.status_enhanced || 'quote_accepted') as any,
        total_amount: virtualOrder.total_amount || 0,
        deposit_amount: virtualOrder.deposit_amount || 0,
        amount_paid: virtualOrder.amount_paid || 0,
        scheduled_install_date: null,
        engineer_id: virtualOrder.engineer_id || null,
        // Partner-related fields
        external_confirmation_source: null,
        partner_confirmed_at: null,
        partner_confirmed_externally: false,
        partner_external_id: null,
        partner_id: null,
        partner_job_reference: null,
        partner_status: null,
        partner_sub_contractor: null,
        scheduling_suppressed: false,
        partner_external_url: null,
        partner_metadata: null,
        partner_status_raw: null,
        scheduling_suppressed_reason: null,
        sub_partner: null,
        survey_required: true,
        survey_token: null,
        survey_token_expires_at: null,
        job_type: 'installation' as any // Default value for mock orders
      };
      allOrders.push(dbVirtualOrder);
    }
  });

  if (newOrder && (!newOrder.id || !allOrders.find(o => o.id === newOrder.id))) {
      // Convert the Order interface to match database schema
      const dbOrder = {
        ...newOrder,
        admin_qa_notes: null,
        agreement_document_url: null,
        agreement_signed_at: null,
        created_at: new Date().toISOString(),
        engineer_notes: null,
        engineer_signature_data: null,
        engineer_signed_off_at: null,
        installation_date: null,
        installation_notes: null,
        internal_install_notes: null,
        job_address: newOrder.job_address || null,
        manual_status_notes: null,
        manual_status_override: false,
        order_number: newOrder.order_number || 'TEMP',
        quote_id: 'temp-quote-id',
        scheduling_conflicts: newOrder.scheduling_conflicts || [],
        travel_time_minutes: null,
        updated_at: new Date().toISOString(),
        estimated_duration_hours: getOrderEstimatedHours(newOrder),
        time_window: newOrder.time_window || null,
        postcode: newOrder.postcode || '',
        is_partner_job: newOrder.is_partner_job || false,
        // Ensure required fields are present
        status: newOrder.status || 'awaiting_payment',
        status_enhanced: (newOrder.status_enhanced || 'quote_accepted') as any,
        total_amount: newOrder.total_amount || 0,
        deposit_amount: newOrder.deposit_amount || 0,
        amount_paid: newOrder.amount_paid || 0,
        scheduled_install_date: null,
        engineer_id: newOrder.engineer_id || null,
        // Partner-related fields
        external_confirmation_source: null,
        partner_confirmed_at: null,
        partner_confirmed_externally: false,
        partner_external_id: null,
        partner_id: null,
        partner_job_reference: null,
        partner_status: null,
        partner_sub_contractor: null,
        scheduling_suppressed: false,
        partner_external_url: null,
        partner_metadata: null,
        partner_status_raw: null,
        scheduling_suppressed_reason: null,
        sub_partner: null,
        survey_required: newOrder.survey_required ?? true,
        survey_token: null,
        survey_token_expires_at: null,
        job_type: (newOrder.job_type as any) || 'installation' // Preserve job_type if present
      };
      allOrders.push(dbOrder);
    }

    if (allOrders.length === 0) {
      return {
        canFit: true,
        totalMinutes: 0,
        workDayMinutes,
        overageMinutes: 0,
        reasons: ['No jobs scheduled']
      };
    }

    // Calculate total day time including travel
    const totalMinutes = await calculateTotalDayTime(engineer, allOrders);
    const overageMinutes = Math.max(0, totalMinutes - workDayMinutes);
    const canFit = overageMinutes === 0;

    const reasons = [];
    if (canFit) {
      reasons.push(`Fits within ${Math.floor(workDayMinutes / 60)}h ${workDayMinutes % 60}m work day`);
    } else {
      reasons.push(`Exceeds work day by ${Math.floor(overageMinutes / 60)}h ${overageMinutes % 60}m`);
    }
    
    reasons.push(`${allOrders.length} job${allOrders.length === 1 ? '' : 's'}, ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m total`);

    return {
      canFit,
      totalMinutes,
      workDayMinutes,
      overageMinutes,
      reasons
    };
  } catch (error) {
    console.error('Error calculating day fit:', error);
    return {
      canFit: false,
      totalMinutes: 0,
      workDayMinutes: 0,
      overageMinutes: 0,
      reasons: ['Error calculating day fit']
    };
  }
}

/**
 * Calculate total time needed for all jobs and travel using nearest-neighbor heuristic
 */
async function calculateTotalDayTime(engineer: EngineerSettings, orders: any[]): Promise<number> {
  if (!engineer.starting_postcode || orders.length === 0) {
    // Just sum job durations if no starting postcode
    return orders.reduce((total, order) => total + getOrderEstimatedMinutes(order), 0);
  }

  let totalMinutes = 0;
  let currentLocation = engineer.starting_postcode;
  let remainingOrders = [...orders];

  // Add job durations
  totalMinutes += orders.reduce((total, order) => total + getOrderEstimatedMinutes(order), 0);

    // Calculate travel time using nearest-neighbor approximation
    while (remainingOrders.length > 0) {
      let nearestOrder: any | null = null;
      let shortestTravelTime = Infinity;

      // Find nearest remaining order
      for (const order of remainingOrders) {
        if (!order.postcode) continue;
        
        try {
          const { duration } = await getLiveDistance(currentLocation, order.postcode);
          if (duration < shortestTravelTime) {
            shortestTravelTime = duration;
            nearestOrder = order;
          }
        } catch (error) {
          // Use estimated travel time if Mapbox fails
          const estimatedTime = 30; // 30 minutes default
          if (estimatedTime < shortestTravelTime) {
            shortestTravelTime = estimatedTime;
            nearestOrder = order;
          }
        }
      }

      if (nearestOrder) {
        totalMinutes += shortestTravelTime;
        currentLocation = nearestOrder.postcode || currentLocation;
        const index = remainingOrders.indexOf(nearestOrder);
        remainingOrders.splice(index, 1);
      } else {
        break;
      }
    }

  // Add travel time back to starting location at end of day from the actual last visited location
  if (orders.length > 0 && currentLocation !== engineer.starting_postcode) {
    try {
      const { duration } = await getLiveDistance(currentLocation, engineer.starting_postcode);
      totalMinutes += duration;
    } catch {
      totalMinutes += 30; // Default return travel time
    }
  }

  return totalMinutes;
}

/**
 * Check if adding a new order would exceed the engineer's capacity
 */
export async function wouldExceedCapacity(
  engineer: EngineerSettings,
  date: Date,
  newOrder: Order,
  lenienceMinutes: number = 15,
  additionalVirtualOrders: Order[] = [],
  enforceJobCount: boolean = true,
  jobCountLimitOverfill: number = 0
): Promise<{ wouldExceed: boolean; reason: string }> {
  const dayFit = await calculateDayFit(engineer, date, newOrder, lenienceMinutes, additionalVirtualOrders, enforceJobCount, jobCountLimitOverfill);
  
  return {
    wouldExceed: !dayFit.canFit,
    reason: dayFit.reasons.join(', ')
  };
}

/**
 * Calculate working day duration and remaining minutes for quick pre-filtering
 */
export function getWorkingDayInfo(engineer: EngineerSettings, date: Date): { workDayMinutes: number; hasWorkingHours: boolean } {
  // Subcontractors with ignore_working_hours can work 24 hours
  if (engineer.ignore_working_hours && engineer.is_subcontractor) {
    return { workDayMinutes: 24 * 60, hasWorkingHours: true };
  }

  const dayOfWeek = date.getDay();
  const workingHour = engineer.working_hours.find(wh => wh.day_of_week === dayOfWeek);
  
  if (!workingHour || !workingHour.is_available) {
    return { workDayMinutes: 0, hasWorkingHours: false };
  }

  const startTimeMinutes = parseTime(workingHour.start_time);
  const endTimeMinutes = parseTime(workingHour.end_time);
  const workDayMinutes = endTimeMinutes - startTimeMinutes;

  return { workDayMinutes, hasWorkingHours: true };
}

/**
 * Parse time string (HH:MM) to minutes since midnight (exported helper)
 */
export function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}