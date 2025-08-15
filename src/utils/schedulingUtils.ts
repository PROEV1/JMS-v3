import { supabase } from '@/integrations/supabase/client';

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
  client?: {
    full_name: string;
    email: string;
    phone?: string;
    address?: string;
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
    case 'scheduled':
      return 'bg-blue-500 text-white';
    case 'in_progress':
      return 'bg-purple-500 text-white';
    case 'completed':
      return 'bg-green-500 text-white';
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

export const getSmartEngineerRecommendations = async (order: Order, postcode?: string) => {
  try {
    console.log('Getting smart engineer recommendations for order:', order.order_number);
    
    // Get scheduling settings
    const settings = await getSchedulingSettings();
    
    if (!postcode) {
      console.log('No postcode provided for order');
      return { recommendations: [], settings };
    }

    // Get all engineers with complete settings
    const allEngineers = await getAllEngineersForScheduling();
    
    if (allEngineers.length === 0) {
      console.log('No available engineers found');
      return { recommendations: [], settings };
    }

    console.log(`Found ${allEngineers.length} engineers to evaluate`);

    // Calculate minimum booking date based on advance notice requirements
    const now = new Date();
    const minimumDate = new Date(now.getTime() + (settings.minimum_advance_hours * 60 * 60 * 1000));
    
    const recommendations = await Promise.all(
      allEngineers.map(async (engineer) => {
        try {
          // Validate engineer setup
          const setupValidation = validateEngineerSetup(engineer);
          if (!setupValidation.isComplete) {
            console.log(`Engineer ${engineer.name} setup incomplete:`, setupValidation.missingItems);
            return null;
          }

          // Check if engineer can serve this postcode
          const serviceCheck = canEngineerServePostcode(engineer, postcode);
          if (!serviceCheck.canServe) {
            console.log(`Engineer ${engineer.name} cannot serve postcode ${postcode}`);
            return null;
          }

          // Get live distance and travel time from Mapbox
          let distance = 0;
          let travelTime = serviceCheck.travelTime || 60;
          
          if (engineer.starting_postcode) {
            try {
              const distanceResult = await getLiveDistance(engineer.starting_postcode, postcode);
              distance = distanceResult.distance;
              travelTime = distanceResult.duration;
            } catch (error) {
              console.warn(`Failed to get live distance for ${engineer.name}:`, error);
              // Fallback to estimated travel time from service area
              distance = serviceCheck.travelTime ? Math.round(serviceCheck.travelTime / 2) : 25; // Rough estimate
              travelTime = serviceCheck.travelTime || 60;
            }
          }

          // Check distance limits
          if (distance > settings.max_distance_miles) {
            console.log(`Engineer ${engineer.name} too far: ${distance} miles > ${settings.max_distance_miles} limit`);
            return null;
          }

          // Find next available date
          let availableDate: Date | null = null;
          let checkDate = new Date(minimumDate);
          const maxCheckDays = 30; // Don't check beyond 30 days
          let daysChecked = 0;

          while (!availableDate && daysChecked < maxCheckDays) {
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

              availableDate = new Date(checkDate);
            } else {
              checkDate.setDate(checkDate.getDate() + 1);
              daysChecked++;
            }
          }

          if (!availableDate) {
            console.log(`Engineer ${engineer.name} has no availability within ${maxCheckDays} days`);
            return null;
          }

          // Calculate recommendation score
          const score = calculateEngineerScore(engineer, distance, travelTime, availableDate);
          
          // Generate recommendation reasons
          const reasons = generateRecommendationReasons(engineer, distance, travelTime, availableDate, minimumDate);

          return {
            engineer: engineer as Engineer,
            distance,
            travelTime,
            score,
            reasons,
            availableDate: availableDate.toISOString().split('T')[0]
          };
        } catch (error) {
          console.error(`Error evaluating engineer ${engineer.name}:`, error);
          return null;
        }
      })
    );

    // Filter out null recommendations and sort by score
    const validRecommendations = recommendations
      .filter(rec => rec !== null)
      .sort((a, b) => b!.score - a!.score);

    console.log(`Generated ${validRecommendations.length} valid recommendations`);

    return {
      recommendations: validRecommendations,
      settings
    };
  } catch (error) {
    console.error('Error getting engineer recommendations:', error);
    return {
      recommendations: [],
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
      .rpc('get_engineer_daily_workload', {
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
export async function getSchedulingSettings() {
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
      allow_weekend_bookings: false,
      allow_holiday_bookings: false,
      require_client_confirmation: true
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
      allow_weekend_bookings: false,
      allow_holiday_bookings: false,
      require_client_confirmation: true
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
  availableDate: Date
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
  minimumDate: Date
): string[] {
  const reasons: string[] = [];

  // Distance and travel time
  if (distance <= 10) {
    reasons.push(`Very close location (${distance} miles)`);
  } else if (distance <= 25) {
    reasons.push(`Reasonable distance (${distance} miles)`);
  } else {
    reasons.push(`Within service area (${distance} miles)`);
  }

  if (travelTime <= 30) {
    reasons.push(`Short travel time (${travelTime} minutes)`);
  } else if (travelTime <= 60) {
    reasons.push(`Moderate travel time (${travelTime} minutes)`);
  }

  // Availability timing
  const daysUntilAvailable = Math.ceil((availableDate.getTime() - minimumDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilAvailable === 0) {
    reasons.push('Available from earliest possible date');
  } else if (daysUntilAvailable <= 3) {
    reasons.push(`Available very soon (${daysUntilAvailable} days)`);
  } else if (daysUntilAvailable <= 7) {
    reasons.push(`Available within a week (${daysUntilAvailable} days)`);
  } else {
    reasons.push(`Next availability: ${availableDate.toLocaleDateString()}`);
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
 */
export function canEngineerServePostcode(
  engineer: EngineerSettings,
  postcode: string
): { canServe: boolean; travelTime?: number } {
  if (!engineer.service_areas || engineer.service_areas.length === 0) {
    return { canServe: false };
  }

  // Extract postcode area (e.g., "SW1A" from "SW1A 1AA")
  const postcodeArea = postcode.replace(/\s+/g, '').toUpperCase().substring(0, 3);

  // Check if engineer serves this postcode area
  for (const area of engineer.service_areas) {
    if (area.postcode_area.replace(/\s+/g, '').toUpperCase().includes(postcodeArea) ||
        postcodeArea.includes(area.postcode_area.replace(/\s+/g, '').toUpperCase())) {
      return { 
        canServe: true, 
        travelTime: area.max_travel_minutes 
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
export function validateEngineerSetup(engineer: EngineerSettings): {
  isComplete: boolean;
  missingItems: string[];
} {
  const missingItems: string[] = [];

  if (!engineer.starting_postcode) {
    missingItems.push('Starting postcode');
  }

  if (!engineer.service_areas || engineer.service_areas.length === 0) {
    missingItems.push('Service areas');
  }

  if (!engineer.working_hours || engineer.working_hours.length === 0) {
    missingItems.push('Working hours');
  }

  return {
    isComplete: missingItems.length === 0,
    missingItems
  };
}