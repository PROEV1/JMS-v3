import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type DbOrder = Database['public']['Tables']['orders']['Row'];
type DbClient = Database['public']['Tables']['clients']['Row'];
type DbEngineer = Database['public']['Tables']['engineers']['Row'];

export interface Order extends DbOrder {
  client?: DbClient;
  engineer?: DbEngineer;
}

export interface Engineer extends DbEngineer {}

export interface ClientBlockedDate {
  id: string;
  client_id: string;
  blocked_date: string;
  reason?: string;
}

export interface SchedulingConflict {
  type: 'double_booking' | 'client_blocked' | 'outside_hours' | 'travel_conflict';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface EngineerSuggestion {
  engineer: Engineer;
  isAvailable: boolean;
  availableDate?: string;
  distance: number;
  travelTime: number;
  score: number;
  reasons: string[];
}

// Get scheduling settings from admin configuration
export const getSchedulingSettings = async () => {
  const { data, error } = await supabase
    .rpc('get_scheduling_settings');
  
  if (error) {
    console.error('Error fetching scheduling settings:', error);
    return {
      hours_advance_notice: 48,
      max_distance_miles: 90,
      max_jobs_per_day: 3,
      allow_weekend_bookings: false,
      working_hours_start: '08:00',
      working_hours_end: '18:00'
    };
  }
  
  return data[0] || {
    hours_advance_notice: 48,
    max_distance_miles: 90,
    max_jobs_per_day: 3,
    allow_weekend_bookings: false,
    working_hours_start: '08:00',
    working_hours_end: '18:00'
  };
};

// Cache for distance calculations to avoid repeated API calls
const distanceCache = new Map<string, { distance: number; duration: number; timestamp: number; method: string }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Clear cache function for debugging
export const clearDistanceCache = () => {
  distanceCache.clear();
  console.log('Distance cache cleared');
};

// Enhanced distance calculation using Mapbox API - no fallback
export const calculateDistance = async (postcode1?: string, postcode2?: string): Promise<number> => {
  if (!postcode1 || !postcode2) {
    console.error('❌ Missing postcode(s):', { postcode1, postcode2 });
    throw new Error('Both postcodes are required for distance calculation');
  }
  
  const cleanPostcode1 = postcode1.trim().toUpperCase();
  const cleanPostcode2 = postcode2.trim().toUpperCase();
  
  console.log(`🚀 === DISTANCE CALCULATION START ===`);
  console.log(`📍 From: "${cleanPostcode1}" | To: "${cleanPostcode2}"`);
  
  // Check cache first
  const cacheKey = `${cleanPostcode1}-${cleanPostcode2}`;
  const reverseKey = `${cleanPostcode2}-${cleanPostcode1}`;
  const cached = distanceCache.get(cacheKey) || distanceCache.get(reverseKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    console.log(`🗂️ Using cached result: ${cached.distance} miles (${cached.method})`);
    return cached.distance;
  }
  
  // Check for exact match (same postcode should be very close)
  if (cleanPostcode1 === cleanPostcode2) {
    console.log('✅ Same postcodes - returning 0.5 miles');
    return 0.5;
  }
  
  console.log('📡 Calling Mapbox API edge function...');
  console.log('🔗 Function URL: https://jttogvpjfeegbkpturey.supabase.co/functions/v1/mapbox-distance');
  console.log('📦 Request payload:', JSON.stringify({
    origins: [cleanPostcode1],
    destinations: [cleanPostcode2]
  }, null, 2));
  
  console.log('🚀 About to call supabase.functions.invoke...');
  
  try {
    console.log('🎯 Calling invoke with data:', {
      functionName: 'mapbox-distance',
      body: {
        origins: [cleanPostcode1],
        destinations: [cleanPostcode2]
      }
    });
    
    const { data, error } = await supabase.functions.invoke('mapbox-distance', {
      body: {
        origins: [cleanPostcode1],
        destinations: [cleanPostcode2]
      }
    });
    
    console.log('🎉 Invoke completed successfully!');
    
    console.log('📨 Raw Mapbox response:', { data, error });
    console.log('📊 Response status:', data ? 'data received' : 'no data');
    console.log('🔍 Error details:', error ? JSON.stringify(error, null, 2) : 'no error');
    
    if (error) {
      console.error('❌ Mapbox function error:', error);
      throw new Error(`Mapbox API error: ${JSON.stringify(error)}`);
    }
    
    if (!data) {
      console.error('❌ No data returned from Mapbox function');
      throw new Error('No data returned from Mapbox API');
    }
    
    if (!data.distances || !Array.isArray(data.distances)) {
      console.error('❌ Invalid distances structure:', data);
      throw new Error(`Invalid response structure: ${JSON.stringify(data)}`);
    }
    
    if (!data.distances[0] || data.distances[0][0] === undefined) {
      console.error('❌ Missing distance value:', data.distances);
      throw new Error(`Missing distance value in response: ${JSON.stringify(data.distances)}`);
    }
    
    const distance = data.distances[0][0];
    const duration = data.durations?.[0]?.[0] || Math.round(distance * 2.5);
    
    console.log(`✅ SUCCESS: ${distance} miles, ${duration} minutes`);
    console.log(`🏁 === DISTANCE CALCULATION END ===`);
    
    // Cache the result
    distanceCache.set(cacheKey, { 
      distance, 
      duration, 
      timestamp: Date.now(),
      method: 'mapbox'
    });
    
    return distance;
    
  } catch (invokeError) {
    console.error('💥 Function invoke failed:', invokeError);
    console.error('🔧 Invoke error details:', {
      message: invokeError.message,
      stack: invokeError.stack,
      name: invokeError.name
    });
    throw new Error(`Failed to call Mapbox function: ${invokeError.message}`);
  }
};

// Calculate travel time based on distance
export const calculateTravelTime = (distance: number): number => {
  // Assuming average speed of 30 mph including traffic and stops
  return Math.round(distance * 2);
};

// Get engineer availability for a specific date
export const getEngineerAvailability = async (engineerId: string, date: string) => {
  const { data: engineer } = await supabase
    .from('engineers')
    .select('*, engineer_time_off(*)')
    .eq('id', engineerId)
    .single();

  if (!engineer) return false;

  // Check if engineer is generally available
  if (!engineer.availability) return false;

  // Check if engineer is on time off
  const timeOff = engineer.engineer_time_off?.find((timeOff: any) => {
    const startDate = new Date(timeOff.start_date);
    const endDate = new Date(timeOff.end_date);
    const checkDate = new Date(date);
    return checkDate >= startDate && checkDate <= endDate && timeOff.status === 'approved';
  });

  return !timeOff;
};

// Get client blocked dates
export const getClientBlockedDates = async (clientId: string) => {
  const { data } = await supabase
    .from('client_blocked_dates')
    .select('blocked_date')
    .eq('client_id', clientId);

  return data?.map(item => item.blocked_date) || [];
};

// Detect scheduling conflicts for an order
export const detectConflicts = async (orderId: string): Promise<SchedulingConflict[]> => {
  const { data, error } = await supabase.rpc('detect_scheduling_conflicts', {
    p_order_id: orderId
  });

  if (error) {
    console.error('Error detecting conflicts:', error);
    return [];
  }

  return (data as unknown as SchedulingConflict[]) || [];
};

// Get engineer workload for a specific date
export const getEngineerWorkload = async (engineerId: string, date: string): Promise<number> => {
  const { data, error } = await supabase.rpc('get_engineer_daily_workload', {
    p_engineer_id: engineerId,
    p_date: date
  });

  if (error) {
    console.error('Error getting engineer workload:', error);
    return 0;
  }

  return data || 0;
};

// Get status color based on order status
export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'quote_sent': 'bg-blue-100 text-blue-800',
    'quote_accepted': 'bg-green-100 text-green-800',
    'awaiting_payment': 'bg-yellow-100 text-yellow-800',
    'awaiting_agreement': 'bg-orange-100 text-orange-800',
    'awaiting_install_booking': 'bg-purple-100 text-purple-800',
    'scheduled': 'bg-indigo-100 text-indigo-800',
    'in_progress': 'bg-blue-100 text-blue-800',
    'awaiting_final_payment': 'bg-yellow-100 text-yellow-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800'
  };
  
  return statusColors[status] || 'bg-gray-100 text-gray-800';
};

// Format order for calendar display
export const formatOrderForCalendar = (order: Order) => {
  return {
    id: order.id,
    title: `${order.order_number} - ${order.client?.full_name || 'Unknown Client'}`,
    start: new Date(order.scheduled_install_date!),
    end: new Date(new Date(order.scheduled_install_date!).getTime() + 4 * 60 * 60 * 1000), // 4 hours
    resource: {
      order,
      engineerId: order.engineer_id,
      status: order.status_enhanced || order.status,
      conflicts: []
    }
  };
};

// Find first available slot for engineers
export const findFirstAvailableSlot = async (
  engineerIds: string[],
  clientPostcode: string,
  estimatedHours: number = 2,
  clientId?: string
) => {
  const { data, error } = await supabase.rpc('find_first_available_slot', {
    p_engineer_ids: engineerIds,
    p_client_postcode: clientPostcode,
    p_estimated_hours: estimatedHours,
    p_client_id: clientId
  });

  if (error) {
    console.error('Error finding available slot:', error);
    return [];
  }

  return data || [];
};

// Smart engineer recommendations
export const getSmartEngineerRecommendations = async (
  order: Order,
  availableEngineers: Engineer[]
): Promise<{
  recommendations: EngineerSuggestion[];
  settings: any;
}> => {
  console.log('🧠 === SMART RECOMMENDATIONS START ===');
  console.log(`📋 Order: ${order.order_number} | Location: ${order.postcode}`);
  console.log(`👥 Available engineers: ${availableEngineers.length}`);
  
  if (!order.postcode) {
    console.error('❌ No postcode available for recommendations');
    return { recommendations: [], settings: {} };
  }

  const settings = await getSchedulingSettings();
  const recommendations: EngineerSuggestion[] = [];
  
  console.log('⚙️ Scheduling settings:', settings);
  
  for (const engineer of availableEngineers) {
    try {
      console.log(`\n🔍 === ANALYZING ENGINEER: ${engineer.name} ===`);
      console.log(`📍 Engineer location: ${engineer.starting_postcode}`);
      
      // Calculate distance using Mapbox API
      let distance: number;
      let travelTime: number;
      
      try {
        console.log(`📏 Calculating distance: ${engineer.starting_postcode} → ${order.postcode}`);
        distance = await calculateDistance(engineer.starting_postcode, order.postcode);
        travelTime = calculateTravelTime(distance);
        console.log(`✅ Distance calculated: ${distance} miles, ${travelTime} min travel`);
      } catch (distanceError) {
        console.error(`❌ Distance calculation failed for ${engineer.name}:`, distanceError);
        continue; // Skip this engineer if distance calculation fails
      }
      
      // Calculate base score
      let score = 100;
      const reasons: string[] = [];
      
      // Distance penalty
      if (distance > settings.max_distance_miles) {
        console.log(`❌ Engineer too far: ${distance} miles > ${settings.max_distance_miles} miles`);
        continue; // Skip engineers that are too far
      }
      
      const distancePenalty = Math.min(distance * 0.5, 30);
      score -= distancePenalty;
      console.log(`📏 Distance penalty: -${distancePenalty.toFixed(1)} (${distance} miles)`);
      
      if (distance <= 10) {
        reasons.push('Very close location');
      } else if (distance <= 25) {
        reasons.push('Reasonable distance');
      } else {
        reasons.push('Longer travel required');
      }
      
      const finalScore = Math.max(score, 10);
      console.log(`🎯 Final score for ${engineer.name}: ${finalScore.toFixed(1)}`);
      
      // Calculate proper available date with advance notice
      const advanceNoticeMs = settings.hours_advance_notice * 60 * 60 * 1000;
      const earliestDate = new Date(Date.now() + advanceNoticeMs);
      
      recommendations.push({
        engineer,
        isAvailable: true,
        availableDate: earliestDate.toISOString(),
        distance,
        travelTime,
        score: finalScore,
        reasons
      });
      
    } catch (error) {
      console.error(`💥 Error processing engineer ${engineer.name}:`, error);
    }
  }
  
  // Sort by score (highest first)
  recommendations.sort((a, b) => b.score - a.score);
  
  console.log('\n📊 === FINAL RECOMMENDATIONS ===');
  recommendations.forEach((rec, index) => {
    console.log(`${index + 1}. ${rec.engineer.name}: ${rec.score.toFixed(1)} pts, ${rec.distance} miles`);
  });
  console.log('🏁 === SMART RECOMMENDATIONS END ===\n');
  
  return { recommendations, settings };
};

// Update order assignment
export const updateOrderAssignment = async (
  orderId: string,
  engineerId: string | null,
  scheduledDate?: string
) => {
  const updates: any = { engineer_id: engineerId };
  
  if (scheduledDate) {
    updates.scheduled_install_date = scheduledDate;
  }
  
  const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select()
    .single();
    
  if (error) {
    console.error('Error updating order assignment:', error);
    throw error;
  }
  
  return data;
};