import { supabase } from '@/integrations/supabase/client';
import { Order, EngineerSettings } from './schedulingUtils';
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
  lenienceMinutes: number = 15
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

    // Calculate work day duration
    const startTimeMinutes = parseTime(workingHour.start_time);
    const endTimeMinutes = parseTime(workingHour.end_time);
    const workDayMinutes = (endTimeMinutes - startTimeMinutes) + lenienceMinutes;

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

    // Include the new order if provided (convert to database format)
    const allOrders = [...(existingOrders || [])];
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
        estimated_duration_hours: newOrder.estimated_duration_hours || 2,
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
        engineer_id: newOrder.engineer_id || null
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
    return orders.reduce((total, order) => total + (order.estimated_duration_hours || 2) * 60, 0);
  }

  let totalMinutes = 0;
  let currentLocation = engineer.starting_postcode;
  let remainingOrders = [...orders];

  // Add job durations
  totalMinutes += orders.reduce((total, order) => total + (order.estimated_duration_hours || 2) * 60, 0);

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
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if adding a new order would exceed the engineer's capacity
 */
export async function wouldExceedCapacity(
  engineer: EngineerSettings,
  date: Date,
  newOrder: Order,
  lenienceMinutes: number = 15
): Promise<{ wouldExceed: boolean; reason: string }> {
  const dayFit = await calculateDayFit(engineer, date, newOrder, lenienceMinutes);
  
  return {
    wouldExceed: !dayFit.canFit,
    reason: dayFit.reasons.join(', ')
  };
}