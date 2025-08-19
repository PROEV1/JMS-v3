import { supabase } from '@/integrations/supabase/client';
import { normalizePostcode, getBestPostcode, getOutwardCode } from './postcodeUtils';
import { calculateDayFit } from './dayFitUtils';

// Default job duration constants
export const DEFAULT_JOB_DURATION_HOURS = 3;

// Helper functions for consistent duration handling
export const getOrderEstimatedHours = (order: Order): number => {
  return order.estimated_duration_hours && order.estimated_duration_hours > 0 
    ? order.estimated_duration_hours 
    : DEFAULT_JOB_DURATION_HOURS;
};

export const getOrderEstimatedMinutes = (order: Order): number => {
  return getOrderEstimatedHours(order) * 60;
};

// Legacy interfaces for backward compatibility
export interface Order {
  id: string;
  order_number: string;
  client_id: string;
  engineer_id?: string;
  scheduled_install_date?: string;
  status: string;
  status_enhanced: string;
  job_address?: string;
  postcode?: string;
  time_window?: string;
  total_amount?: number;
  deposit_amount?: number;
  amount_paid?: number;
  estimated_duration_hours?: number;
  installation_notes?: string;
  scheduling_conflicts?: any; // Allow Json or any[]
  is_partner_job?: boolean;
  job_type?: 'installation' | 'assessment' | 'service_call'; // Updated to match enum
  client?: {
    full_name: string;
    email: string;
    phone?: string;
    address?: string;
    postcode?: string;
  };
  engineer?: {
    name: string;
    email: string;
    region?: string;
  };
}

export interface Engineer {
  id: string;
  name: string;
  email: string;
  availability: boolean;
  region?: string;
  starting_postcode?: string;
}

export interface EngineerSettings {
  id: string;
  name: string;
  email: string;
  starting_postcode: string | null;
  availability: boolean;
  service_areas: Array<{
    postcode_area: string;
    max_travel_minutes: number;
  }>;
  working_hours: Array<{
    day_of_week: number;
    start_time: string;
    end_time: string;
    is_available: boolean;
  }>;
  time_off: Array<{
    start_date: string;
    end_date: string;
    reason: string;
    status: string;
  }>;
}

// Legacy utility functions for backward compatibility
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'awaiting_payment':
      return 'bg-yellow-500 text-white';
    case 'awaiting_agreement':
      return 'bg-orange-500 text-white';
    case 'needs_scheduling':
    case 'awaiting_install_booking':
      return 'bg-orange-400 text-white';
    case 'date_offered':
      return 'bg-blue-500 text-white';
    case 'date_accepted':
    case 'scheduled':
      return 'bg-green-500 text-white';
    case 'date_rejected':
      return 'bg-red-500 text-white';
    case 'offer_expired':
      return 'bg-yellow-600 text-white';
    case 'on_hold_parts_docs':
      return 'bg-purple-500 text-white';
    case 'cancelled':
      return 'bg-gray-500 text-white';
    case 'in_progress':
      return 'bg-purple-600 text-white';
    case 'completed':
      return 'bg-green-600 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

export const formatOrderForCalendar = (order: Order) => ({
  id: order.id,
  title: `${order.order_number} - ${order.client?.full_name || 'Unknown Client'}`,
  start: order.scheduled_install_date ? new Date(order.scheduled_install_date) : new Date(),
  end: order.scheduled_install_date ? new Date(new Date(order.scheduled_install_date).getTime() + 4 * 60 * 60 * 1000) : new Date(),
  resource: {
    order: order,
    engineerId: order.engineer_id,
    status: order.status_enhanced,
    conflicts: Array.isArray(order.scheduling_conflicts) ? order.scheduling_conflicts : []
  },
  extendedProps: {
    orderId: order.id,
    orderNumber: order.order_number,
    clientName: order.client?.full_name,
    engineerName: order.engineer?.name,
    status: order.status_enhanced,
    address: order.job_address
  }
});

export const updateOrderAssignment = async (orderId: string, engineerId: string | null, scheduledDate?: Date | string) => {
  try {
    const updateData: any = { engineer_id: engineerId };
    if (scheduledDate) {
      // Handle both Date objects and strings
      const dateToUpdate = scheduledDate instanceof Date ? scheduledDate.toISOString() : scheduledDate;
      updateData.scheduled_install_date = dateToUpdate;
    }

    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating order assignment:', error);
    return false;
  }
};

export const getSmartEngineerRecommendations = async (order: Order, postcode?: string, options: { startDate?: Date } = {}) => {
  try {
    console.log('Getting smart engineer recommendations for order:', order.order_number);
    
    // Get scheduling settings
    const settings = await getSchedulingSettings();
    
    // Use the passed postcode or fallback to getBestPostcode
    let finalPostcode = postcode;
    
    if (!finalPostcode) {
      // Import getBestPostcode dynamically to avoid circular imports
      const { getBestPostcode } = await import('@/utils/postcodeUtils');
      finalPostcode = getBestPostcode(order);
    }
    
    if (!finalPostcode) {
      console.log('No postcode found for order - checked order.postcode, client.address, and order.job_address');
      return { 
        recommendations: [], 
        featured: [],
        all: [],
        settings,
        error: 'No postcode available - cannot calculate engineer recommendations without location data'
      };
    }

    console.log('Using postcode for recommendations:', finalPostcode);

    // Get client blocked dates to exclude from recommendations
    const { data: blockedDates, error: blockedDatesError } = await supabase
      .from('client_blocked_dates')
      .select('blocked_date')
      .eq('client_id', order.client_id);
      
    if (blockedDatesError) {
      console.warn('Failed to fetch client blocked dates:', blockedDatesError);
    }
    
    const blockedDateStrings = new Set(
      (blockedDates || []).map(bd => bd.blocked_date)
    );
    
    console.log(`Client has ${blockedDateStrings.size} blocked dates`);

    // Get all engineers with complete settings
    const allEngineers = await getAllEngineersForScheduling();
    
    if (allEngineers.length === 0) {
      console.log('No available engineers found');
      return { recommendations: [], featured: [], all: [], settings };
    }

    console.log(`Found ${allEngineers.length} engineers to evaluate`);
    
    // Track exclusion reasons for diagnostics
    const exclusionReasons: Record<string, string[]> = {};

    // Calculate minimum booking date based on advance notice requirements or provided start date
    const now = new Date();
    const minimumDate = options.startDate || new Date(now.getTime() + (settings.minimum_advance_hours * 60 * 60 * 1000));
    
    const recommendations = await Promise.all(
      allEngineers.map(async (engineer) => {
        try {
          // Initialize exclusion tracking for this engineer
          exclusionReasons[engineer.name] = [];
          
          // Validate engineer setup
          const setupValidation = validateEngineerSetup(engineer);
          if (!setupValidation.isComplete) {
            const reasons = setupValidation.missingItems.map(item => `Missing: ${item}`);
            exclusionReasons[engineer.name] = reasons;
            console.log(`Engineer ${engineer.name} setup incomplete:`, setupValidation.missingItems);
            return null;
          }

          // Service area check - now soft preference unless strict mode enabled
          const serviceCheck = canEngineerServePostcode(engineer, finalPostcode);
          const hasServiceAreaMatch = serviceCheck.canServe;
          
          // Only hard-exclude if strict service area matching is required
          if (settings.require_service_area_match && !hasServiceAreaMatch) {
            exclusionReasons[engineer.name].push(`No service area coverage for ${finalPostcode} (strict mode)`);
            console.log(`Engineer ${engineer.name} excluded - no service area for ${finalPostcode} (strict mode enabled)`);
            return null;
          }

          // Get live distance and travel time from Mapbox
          let distance = 0;
          let travelTime = hasServiceAreaMatch ? (serviceCheck.travelTime || 60) : 80; // Default higher if no service area match
          
           if (engineer.starting_postcode) {
             try {
               const distanceResult = await getLiveDistance(engineer.starting_postcode, finalPostcode);
               distance = distanceResult.distance;
               travelTime = distanceResult.duration;
               
                // Final check: respect engineer's travel time limits based on actual Mapbox data
                // Use service area limit if matched, otherwise use global fallback
                const maxTravelMinutes = hasServiceAreaMatch ? (serviceCheck.travelTime || 80) : (settings.max_travel_minutes_fallback || 120);
                if (travelTime > maxTravelMinutes) {
                  exclusionReasons[engineer.name].push(`Travel time ${travelTime}min exceeds limit ${maxTravelMinutes}min`);
                  console.log(`Engineer ${engineer.name} travel time ${travelTime} exceeds limit ${maxTravelMinutes}`);
                  return null;
                }
             } catch (error) {
               console.warn(`Failed to get live distance for ${engineer.name}:`, error);
               // Fallback to estimated travel time from service area
               distance = serviceCheck.travelTime ? Math.round(serviceCheck.travelTime / 2) : 25; // Rough estimate
               travelTime = serviceCheck.travelTime || 60;
             }
           }

          // Check distance limits
          if (distance > settings.max_distance_miles) {
            exclusionReasons[engineer.name].push(`Too far: ${distance} miles > ${settings.max_distance_miles} limit`);
            console.log(`Engineer ${engineer.name} too far: ${distance} miles > ${settings.max_distance_miles} limit`);
            return null;
          }

          // Find next available date - use configurable search horizon
          let availableDate: Date | null = null;
          let dailyWorkloadThatDay = 0;
          let checkDate = new Date(minimumDate);
          const maxCheckDays = settings.recommendation_search_horizon_days || 120;
          let daysChecked = 0;

           while (!availableDate && daysChecked < maxCheckDays) {
             // Skip if this date is blocked by the client
             const checkDateString = checkDate.toISOString().split('T')[0];
             if (blockedDateStrings.has(checkDateString)) {
               console.log(`  ${engineer.name}: Skipping ${checkDateString} - blocked by client`);
               checkDate.setDate(checkDate.getDate() + 1);
               daysChecked++;
               continue;
             }
             
             // Check if engineer is available on this date
             if (isEngineerAvailableOnDate(engineer, checkDate)) {
               // Check weekend restrictions
               const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;
               if (isWeekend && !settings.allow_weekend_bookings) {
                 checkDate.setDate(checkDate.getDate() + 1);
                 daysChecked++;
                 continue;
               }

                // Check daily workload
                const dailyWorkload = await getEngineerDailyWorkload(engineer.id, checkDate.toISOString().split('T')[0]);
                if (dailyWorkload >= settings.max_jobs_per_day) {
                  checkDate.setDate(checkDate.getDate() + 1);
                  daysChecked++;
                  continue;
                }

               // Check if engineer can fit all jobs in their working day
               const dayFit = await calculateDayFit(engineer, checkDate, order, settings.day_lenience_minutes);
               
               if (dayFit.canFit) {
                 availableDate = new Date(checkDate);
                 dailyWorkloadThatDay = dailyWorkload;
                 console.log(`  ${engineer.name}: Available on ${availableDate.toLocaleDateString()}, current workload: ${dailyWorkload}/${settings.max_jobs_per_day}, day fit: ${dayFit.reasons.join(', ')}`);
               } else {
                 console.log(`  ${engineer.name}: ${checkDate.toLocaleDateString()} - would exceed capacity: ${dayFit.reasons.join(', ')}`);
                 checkDate.setDate(checkDate.getDate() + 1);
                 daysChecked++;
                 continue;
               }
             } else {
               checkDate.setDate(checkDate.getDate() + 1);
               daysChecked++;
             }
           }

          // If no date found within horizon, try extended search up to 365 days
          if (!availableDate && maxCheckDays < 365) {
            const extendedMaxDays = 365;
            while (!availableDate && daysChecked < extendedMaxDays) {
              // Skip if this date is blocked by the client
              const checkDateString = checkDate.toISOString().split('T')[0];
              if (blockedDateStrings.has(checkDateString)) {
                checkDate.setDate(checkDate.getDate() + 1);
                daysChecked++;
                continue;
              }
              
              if (isEngineerAvailableOnDate(engineer, checkDate)) {
                const isWeekend = checkDate.getDay() === 0 || checkDate.getDay() === 6;
                if (isWeekend && !settings.allow_weekend_bookings) {
                  checkDate.setDate(checkDate.getDate() + 1);
                  daysChecked++;
                  continue;
                }

                 const dailyWorkload = await getEngineerDailyWorkload(engineer.id, checkDate.toISOString().split('T')[0]);
                 if (dailyWorkload >= settings.max_jobs_per_day) {
                   checkDate.setDate(checkDate.getDate() + 1);
                   daysChecked++;
                   continue;
                 }

                const dayFit = await calculateDayFit(engineer, checkDate, order, settings.day_lenience_minutes);
                if (dayFit.canFit) {
                  availableDate = new Date(checkDate);
                  dailyWorkloadThatDay = dailyWorkload;
                  break;
                }
              }
              checkDate.setDate(checkDate.getDate() + 1);
              daysChecked++;
            }
          }

          if (!availableDate) {
            exclusionReasons[engineer.name].push(`No availability within ${maxCheckDays} days (checked ${daysChecked} days)`);
            console.log(`Engineer ${engineer.name} has no availability within ${daysChecked} days`);
            return null;
          }

          // Calculate recommendation score (kept for display purposes)
          const score = calculateEngineerScore(engineer, distance, travelTime, availableDate, dailyWorkloadThatDay);
          
          // Generate recommendation reasons including workload info and service area status
          const reasons = generateRecommendationReasons(engineer, distance, travelTime, availableDate, minimumDate, dailyWorkloadThatDay, hasServiceAreaMatch);

          return {
            engineer: engineer as Engineer,
            distance,
            travelTime,
            score,
            reasons,
            availableDate: availableDate.toISOString().split('T')[0],
            dailyWorkloadThatDay
          };
        } catch (error) {
          exclusionReasons[engineer.name].push(`Evaluation error: ${error}`);
          console.error(`Error evaluating engineer ${engineer.name}:`, error);
          return null;
        }
      })
    );

    // Filter out null recommendations and sort by new priority system
    const validRecommendations = recommendations
      .filter(rec => rec !== null)
      .sort((a, b) => {
        // 1. Sort by available date (earlier first)
        const dateA = new Date(a!.availableDate).getTime();
        const dateB = new Date(b!.availableDate).getTime();
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        
        // 2. Sort by travel time (shorter first)
        if (a!.travelTime !== b!.travelTime) {
          return a!.travelTime - b!.travelTime;
        }
        
        // 3. Sort by daily workload (0 jobs preferred)
        if (a!.dailyWorkloadThatDay !== b!.dailyWorkloadThatDay) {
          return a!.dailyWorkloadThatDay - b!.dailyWorkloadThatDay;
        }
        
        // 4. Sort by distance (shorter first)
        if (a!.distance !== b!.distance) {
          return a!.distance - b!.distance;
        }
        
        // 5. Final tie-breaker by score
        return b!.score - a!.score;
      });

    console.log(`Generated ${validRecommendations.length} valid recommendations`);
    
    // Split into featured and all
    const topCount = settings.top_recommendations_count || 3;
    const featured = validRecommendations.slice(0, topCount);
    
    // Log exclusion summary for diagnostics
    const excludedEngineers = Object.entries(exclusionReasons)
      .filter(([name, reasons]) => reasons.length > 0);
    
    if (excludedEngineers.length > 0) {
      console.log('Engineer exclusion summary:');
      excludedEngineers.forEach(([name, reasons]) => {
        console.log(`  ${name}: ${reasons.join(', ')}`);
      });
    }

    return {
      recommendations: validRecommendations, // Keep for backward compatibility
      featured,
      all: validRecommendations,
      settings,
      diagnostics: {
        totalEngineers: allEngineers.length,
        excludedEngineers: excludedEngineers.length,
        exclusionReasons: Object.fromEntries(excludedEngineers)
      }
    };
  } catch (error) {
    console.error('Error getting engineer recommendations:', error);
    return {
      recommendations: [],
      featured: [],
      all: [],
      settings: await getSchedulingSettings()
    };
  }
};

// Distance cache for Mapbox API calls
let distanceCache = new Map<string, { distance: number; duration: number; timestamp: number }>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Get live distance and travel time between two postcodes using Mapbox
 */
export async function getLiveDistance(fromPostcode: string, toPostcode: string): Promise<{ distance: number; duration: number }> {
  const cacheKey = `${fromPostcode.toLowerCase()}-${toPostcode.toLowerCase()}`;
  
  // Check cache first
  const cached = distanceCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`Using cached distance for ${fromPostcode} -> ${toPostcode}:`, cached);
    return { distance: cached.distance, duration: cached.duration };
  }

  try {
    console.log(`Getting live distance from ${fromPostcode} to ${toPostcode}`);
    
    const { data, error } = await supabase.functions.invoke('mapbox-distance', {
      body: {
        origins: [fromPostcode],
        destinations: [toPostcode]
      }
    });

    if (error) throw error;

    const distance = data.distances[0][0];
    const duration = data.durations[0][0];

    // Cache the result
    distanceCache.set(cacheKey, {
      distance,
      duration,
      timestamp: Date.now()
    });

    console.log(`Live distance result: ${distance} miles, ${duration} minutes`);
    return { distance, duration };
  } catch (error) {
    console.error('Error getting live distance:', error);
    throw error;
  }
}

/**
 * Clear the distance cache
 */
export const clearDistanceCache = () => {
  distanceCache.clear();
  console.log('Distance cache cleared');
};

/**
 * Get engineer's daily workload for a specific date
 */
export async function getEngineerDailyWorkload(engineerId: string, date: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .rpc('get_engineer_daily_workload_with_holds', {
        p_engineer_id: engineerId,
        p_date: date
      });

    if (error) throw error;
    return data || 0;
  } catch (error) {
    console.error('Error getting engineer daily workload:', error);
    return 0;
  }
}

/**
 * Get scheduling settings from admin_settings
 */
export async function getSchedulingSettings(): Promise<{
  minimum_advance_hours: number;
  max_distance_miles: number;
  max_jobs_per_day: number;
  working_hours_start: string;
  working_hours_end: string;
  day_lenience_minutes: number;
  allow_weekend_bookings: boolean;
  allow_holiday_bookings: boolean;
  require_client_confirmation: boolean;
  recommendation_search_horizon_days: number;
  top_recommendations_count: number;
  require_service_area_match?: boolean;
  max_travel_minutes_fallback?: number;
}> {
  try {
    const { data: schedulingRules, error: schedulingError } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'scheduling_rules')
      .single();

    const { data: bookingRules, error: bookingError } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', 'booking_rules')
      .single();

    const defaultSettings = {
      minimum_advance_hours: 48,
      max_distance_miles: 50,
      max_jobs_per_day: 3,
      working_hours_start: "09:00",
      working_hours_end: "17:00",
      day_lenience_minutes: 15,
      allow_weekend_bookings: false,
      allow_holiday_bookings: false,
      require_client_confirmation: true,
      recommendation_search_horizon_days: 120,
      top_recommendations_count: 3,
      require_service_area_match: false,
      max_travel_minutes_fallback: 120,
    };

    // Safely merge settings, ensuring they're objects
    const schedulingSettings = (schedulingRules?.setting_value && typeof schedulingRules.setting_value === 'object') 
      ? schedulingRules.setting_value as Record<string, any> 
      : {};
    const bookingSettings = (bookingRules?.setting_value && typeof bookingRules.setting_value === 'object') 
      ? bookingRules.setting_value as Record<string, any>
      : {};

    return {
      ...defaultSettings,
      ...schedulingSettings,
      ...bookingSettings
    };
  } catch (error) {
    console.error('Error fetching scheduling settings:', error);
    return {
      minimum_advance_hours: 48,
      max_distance_miles: 50,
      max_jobs_per_day: 3,
      working_hours_start: "09:00",
      working_hours_end: "17:00",
      day_lenience_minutes: 15,
      allow_weekend_bookings: false,
      allow_holiday_bookings: false,
      require_client_confirmation: true,
      recommendation_search_horizon_days: 120,
      top_recommendations_count: 3,
      require_service_area_match: false,
      max_travel_minutes_fallback: 120,
    };
  }
}

/**
 * Calculate engineer recommendation score
 */
function calculateEngineerScore(
  engineer: EngineerSettings,
  distance: number,
  travelTime: number,
  availableDate: Date,
  dailyWorkload: number = 0
): number {
  let score = 100;

  // Distance penalty (closer is better)
  const distancePenalty = Math.min(distance * 2, 50); // Max 50 point penalty
  score -= distancePenalty;

  // Travel time penalty (shorter is better)
  const travelTimePenalty = Math.min(travelTime * 0.5, 30); // Max 30 point penalty
  score -= travelTimePenalty;

  // Availability bonus (earlier available date is better)
  const now = new Date();
  const daysUntilAvailable = Math.ceil((availableDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const availabilityBonus = Math.max(20 - daysUntilAvailable, 0); // Up to 20 point bonus
  score += availabilityBonus;

  // Workload bonus (0 jobs preferred)
  if (dailyWorkload === 0) {
    score += 8; // Small bonus for free day
  }

  // Ensure score stays within 0-100 range
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Generate human-readable reasons for engineer recommendations
 */
function generateRecommendationReasons(
  engineer: EngineerSettings,
  distance: number,
  travelTime: number,
  availableDate: Date,
  minimumDate: Date,
  dailyWorkload: number = 0,
  hasServiceAreaMatch: boolean = true
): string[] {
  const reasons: string[] = [];

  // First doable date (always first)
  reasons.push(`First available: ${availableDate.toLocaleDateString()}`);

  // Workload on that day
  if (dailyWorkload === 0) {
    reasons.push('0 jobs on that day');
  } else {
    reasons.push(`${dailyWorkload} job${dailyWorkload === 1 ? '' : 's'} on that day`);
  }

  // Distance and travel time
  if (distance <= 10 && travelTime <= 30) {
    reasons.push(`Very close (${distance.toFixed(1)}mi, ${travelTime}min)`);
  } else if (distance <= 25 && travelTime <= 60) {
    reasons.push(`Reasonable distance (${distance.toFixed(1)}mi, ${travelTime}min)`);
  } else {
    reasons.push(`${distance.toFixed(1)}mi away, ${travelTime}min travel`);
  }

  // Service area status
  if (!hasServiceAreaMatch) {
    reasons.push('Outside declared service areas (allowed by settings)');
  }

  // Engineer qualifications
  if (engineer.service_areas && engineer.service_areas.length > 1) {
    reasons.push('Covers multiple service areas');
  }

  return reasons;
}

/**
 * Fetch complete engineer settings for scheduling system integration
 */
export async function getEngineerSettings(engineerId: string): Promise<EngineerSettings | null> {
  try {
    // Fetch engineer basic info
    const { data: engineer, error: engineerError } = await supabase
      .from('engineers')
      .select('*')
      .eq('id', engineerId)
      .single();

    if (engineerError) throw engineerError;

    // Fetch service areas
    const { data: serviceAreas, error: serviceAreasError } = await supabase
      .from('engineer_service_areas')
      .select('*')
      .eq('engineer_id', engineerId);

    if (serviceAreasError) throw serviceAreasError;

    // Fetch working hours
    const { data: workingHours, error: workingHoursError } = await supabase
      .from('engineer_availability')
      .select('*')
      .eq('engineer_id', engineerId)
      .order('day_of_week');

    if (workingHoursError) throw workingHoursError;

    // Fetch time off requests
    const { data: timeOff, error: timeOffError } = await supabase
      .from('engineer_time_off')
      .select('*')
      .eq('engineer_id', engineerId)
      .eq('status', 'approved')
      .gte('end_date', new Date().toISOString().split('T')[0]); // Only future/current time off

    if (timeOffError) throw timeOffError;

    return {
      id: engineer.id,
      name: engineer.name,
      email: engineer.email,
      starting_postcode: engineer.starting_postcode,
      availability: engineer.availability,
      service_areas: serviceAreas || [],
      working_hours: workingHours || [],
      time_off: timeOff || [],
    };
  } catch (error) {
    console.error('Error fetching engineer settings:', error);
    return null;
  }
}

/**
 * Get all engineers with their complete settings for scheduling
 */
export async function getAllEngineersForScheduling(): Promise<EngineerSettings[]> {
  try {
    const { data: engineers, error } = await supabase
      .from('engineers')
      .select('id')
      .eq('availability', true);

    if (error) throw error;

    const engineerSettings = await Promise.all(
      engineers.map(engineer => getEngineerSettings(engineer.id))
    );

    return engineerSettings.filter(settings => settings !== null) as EngineerSettings[];
  } catch (error) {
    console.error('Error fetching all engineers for scheduling:', error);
    return [];
  }
}

/**
 * Check if engineer is available on a specific date
 */
export function isEngineerAvailableOnDate(
  engineer: EngineerSettings,
  date: Date
): boolean {
  // Check if engineer is generally available
  if (!engineer.availability) return false;

  // Check time off
  const dateStr = date.toISOString().split('T')[0];
  const isOnTimeOff = engineer.time_off.some(timeOff => 
    dateStr >= timeOff.start_date && dateStr <= timeOff.end_date
  );

  if (isOnTimeOff) return false;

  // Check working hours for the day of week
  const dayOfWeek = date.getDay();
  const workingHour = engineer.working_hours.find(wh => wh.day_of_week === dayOfWeek);
  
  if (!workingHour || !workingHour.is_available) return false;

  return true;
}

/**
 * Check if engineer can serve a postcode based on service areas
 * Now supports letter-only prefixes and uses soft matching for recommendations
 */
export function canEngineerServePostcode(
  engineer: EngineerSettings,
  postcode: string
): { canServe: boolean; travelTime?: number; matchType?: 'exact' | 'prefix' | 'area' } {
  if (!engineer.service_areas || engineer.service_areas.length === 0) {
    return { canServe: false };
  }

  // Extract proper outward code (e.g., "DA5" from "DA5 1BJ", "SW1A" from "SW1A 1AA")
  const jobOutwardCode = getOutwardCode(postcode);
  
  if (!jobOutwardCode) {
    return { canServe: false };
  }

  // Check if engineer serves this postcode area with flexible matching
  for (const area of engineer.service_areas) {
    const configuredArea = area.postcode_area.toUpperCase().trim();
    
    // Handle letter-only areas (e.g., "MK", "LU", "SG")
    if (/^[A-Z]{1,2}$/.test(configuredArea)) {
      const jobAreaLetters = jobOutwardCode.replace(/\d+[A-Z]?$/, ''); // Extract letters only
      if (jobAreaLetters === configuredArea) {
        return { 
          canServe: true, 
          travelTime: area.max_travel_minutes,
          matchType: 'area'
        };
      }
    }
    
    // Extract outward code from configured area for traditional matching
    const areaOutwardCode = getOutwardCode(configuredArea);
    
    // Exact match (e.g., "DA5" matches "DA5")
    if (areaOutwardCode === jobOutwardCode) {
      return { 
        canServe: true, 
        travelTime: area.max_travel_minutes,
        matchType: 'exact'
      };
    }
    
    // Partial match for same area prefix (e.g., "DA1" covers other "DA" areas)
    const jobAreaPrefix = jobOutwardCode.replace(/\d+[A-Z]?$/, ''); // Remove digits and optional letter
    const areaPrefix = areaOutwardCode.replace(/\d+[A-Z]?$/, '');
    
    if (jobAreaPrefix === areaPrefix && jobAreaPrefix.length >= 1) {
      return { 
        canServe: true, 
        travelTime: area.max_travel_minutes,
        matchType: 'prefix'
      };
    }
  }

  return { canServe: false };
}

/**
 * Get engineers who can serve a specific postcode, sorted by travel time
 */
export async function getEngineersForPostcode(postcode: string): Promise<Array<{
  engineer: EngineerSettings;
  travelTime: number;
}>> {
  const allEngineers = await getAllEngineersForScheduling();
  
  const availableEngineers = allEngineers
    .map(engineer => {
      const serviceCheck = canEngineerServePostcode(engineer, postcode);
      if (serviceCheck.canServe) {
        return {
          engineer,
          travelTime: serviceCheck.travelTime || 60
        };
      }
      return null;
    })
    .filter(item => item !== null)
    .sort((a, b) => a!.travelTime - b!.travelTime) as Array<{
      engineer: EngineerSettings;
      travelTime: number;
    }>;

  return availableEngineers;
}

/**
 * Validate engineer setup completeness
 */
/**
 * Get default working hours (Monday-Friday, 9AM-5PM)
 */
function getDefaultWorkingHours() {
  const defaultHours = [];
  // Monday (1) to Friday (5)
  for (let day = 1; day <= 5; day++) {
    defaultHours.push({
      day_of_week: day,
      start_time: '09:00',
      end_time: '17:00',
      is_available: true
    });
  }
  return defaultHours;
}

/**
 * Validate engineer setup completeness
 */
export function validateEngineerSetup(engineer: EngineerSettings): {
  isComplete: boolean;
  missingItems: string[];
} {
  const missingItems: string[] = [];

  if (!engineer.starting_postcode) {
    missingItems.push('Starting postcode');
  }

  // Service areas are now optional - engineers can be included based on Mapbox distance alone
  // if (!engineer.service_areas || engineer.service_areas.length === 0) {
  //   missingItems.push('Service areas');
  // }

  // For working hours, we'll default to Mon-Fri 9-5 if none configured
  // This allows engineers to show up in recommendations even if they haven't
  // explicitly configured their working hours yet
  if (!engineer.working_hours || engineer.working_hours.length === 0) {
    console.log(`Engineer ${engineer.name} has no working hours configured - using default Mon-Fri 9-5`);
    engineer.working_hours = getDefaultWorkingHours();
  }

  return {
    isComplete: missingItems.length === 0,
    missingItems
  };
}