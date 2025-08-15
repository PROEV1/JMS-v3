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
  // Simple implementation - return available engineers with required properties
  try {
    const { data: engineers, error } = await supabase
      .from('engineers')
      .select('*')
      .eq('availability', true);

    if (error) throw error;

    const recommendations = (engineers || []).map(engineer => ({
      engineer: engineer as Engineer,
      score: Math.random() * 100, // Placeholder scoring
      reasons: ['Available engineer'],
      distance: Math.floor(Math.random() * 50), // Placeholder distance in miles
      travelTime: Math.floor(Math.random() * 60) + 15, // Placeholder travel time in minutes
      availableDate: new Date().toISOString().split('T')[0] // Today as placeholder
    }));

    return {
      recommendations,
      settings: null // Placeholder
    };
  } catch (error) {
    console.error('Error getting engineer recommendations:', error);
    return {
      recommendations: [],
      settings: null
    };
  }
};

export const clearDistanceCache = () => {
  // Placeholder for distance cache clearing
  console.log('Distance cache cleared');
};

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