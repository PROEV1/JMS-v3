/**
 * Matrix-based day-fit optimization for scheduling
 * Replaces multiple Directions API calls with single Matrix API call
 */

import { apiClient } from '@/lib/apiClient';
import { supabase } from '@/integrations/supabase/client';
import { Order, EngineerSettings } from './schedulingUtils';

export interface MatrixDayFitResult {
  canFit: boolean;
  totalTravelMinutes: number;
  conflicts: string[];
  schedule: Array<{
    time: string;
    location: string;
    type: 'job' | 'travel';
    duration: number;
  }>;
}

export interface EngineerJob {
  id: string;
  postcode: string;
  startTime: string;
  estimatedMinutes: number;
  orderNumber?: string;
}

/**
 * Optimized day-fit calculation using Matrix API for multiple travel legs
 */
export async function calculateDayFitMatrix(
  engineer: EngineerSettings,
  targetDate: Date,
  newJob: {
    postcode: string;
    estimatedMinutes: number;
    preferredTime?: string;
  },
  existingJobs: EngineerJob[] = [],
  maxTravelToleranceMultiplier: number = 1.0
): Promise<MatrixDayFitResult> {
  try {
    console.log(`🔧 Matrix day-fit for ${engineer.name} on ${targetDate.toISOString().split('T')[0]}`);

    // Get engineer's working hours for the date
    const dayOfWeek = targetDate.getDay();
    const workingHours = engineer.availability?.[dayOfWeek] || { start: '09:00', end: '17:00', available: true };
    
    if (!workingHours.available) {
      return {
        canFit: false,
        totalTravelMinutes: 0,
        conflicts: ['Engineer not available on this day'],
        schedule: []
      };
    }

    // Convert working hours to minutes from start of day
    const startMinutes = timeToMinutes(workingHours.start);
    const endMinutes = timeToMinutes(workingHours.end);
    const availableMinutes = endMinutes - startMinutes;

    console.log(`Working hours: ${workingHours.start}-${workingHours.end} (${availableMinutes} minutes)`);

    // Combine existing jobs with the new job
    const allJobs = [
      ...existingJobs,
      {
        id: 'new-job',
        postcode: newJob.postcode,
        startTime: newJob.preferredTime || workingHours.start,
        estimatedMinutes: newJob.estimatedMinutes,
        orderNumber: 'NEW'
      }
    ];

    // Sort jobs by start time
    allJobs.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    console.log(`Total jobs for day: ${allJobs.length}`);

    // If only one job (the new one), simple calculation
    if (allJobs.length === 1) {
      const homeToJob = await getSingleTravelTime(engineer.starting_postcode || 'M1 1AA', newJob.postcode);
      const jobToHome = await getSingleTravelTime(newJob.postcode, engineer.starting_postcode || 'M1 1AA');
      
      const totalTime = homeToJob + newJob.estimatedMinutes + jobToHome;
      const canFit = totalTime <= availableMinutes;

      return {
        canFit,
        totalTravelMinutes: homeToJob + jobToHome,
        conflicts: canFit ? [] : [`Total time (${totalTime}min) exceeds available time (${availableMinutes}min)`],
        schedule: [
          { time: workingHours.start, location: engineer.starting_postcode || 'M1 1AA', type: 'travel', duration: homeToJob },
          { time: addMinutesToTime(workingHours.start, homeToJob), location: newJob.postcode, type: 'job', duration: newJob.estimatedMinutes },
          { time: addMinutesToTime(workingHours.start, homeToJob + newJob.estimatedMinutes), location: engineer.starting_postcode || 'M1 1AA', type: 'travel', duration: jobToHome }
        ]
      };
    }

    // Multiple jobs - use Matrix API for all travel legs
    const locations = [engineer.starting_postcode || 'M1 1AA', ...allJobs.map(job => job.postcode)];
    const uniqueLocations = [...new Set(locations)];

    console.log(`Getting matrix for ${uniqueLocations.length} unique locations`);

    // Get travel matrix for all locations
    const travelMatrix = await getTravelMatrix(uniqueLocations);

    // Build schedule with travel times
    const schedule: MatrixDayFitResult['schedule'] = [];
    let currentTime = startMinutes;
    let totalTravelMinutes = 0;
    let currentLocation = engineer.starting_postcode || 'M1 1AA';

    for (let i = 0; i < allJobs.length; i++) {
      const job = allJobs[i];
      
      // Get travel time from current location to job
      const travelTime = getTravelTimeFromMatrix(travelMatrix, uniqueLocations, currentLocation, job.postcode);
      
      if (travelTime > 0) {
        schedule.push({
          time: minutesToTime(currentTime),
          location: job.postcode,
          type: 'travel',
          duration: travelTime
        });
        currentTime += travelTime;
        totalTravelMinutes += travelTime;
      }

      // Add the job
      schedule.push({
        time: minutesToTime(currentTime),
        location: job.postcode,
        type: 'job',
        duration: job.estimatedMinutes
      });
      currentTime += job.estimatedMinutes;
      currentLocation = job.postcode;
    }

    // Add final travel back home
    const finalTravelTime = getTravelTimeFromMatrix(travelMatrix, uniqueLocations, currentLocation, engineer.starting_postcode || 'M1 1AA');
    if (finalTravelTime > 0) {
    schedule.push({
      time: minutesToTime(currentTime),
      location: engineer.starting_postcode || 'M1 1AA',
      type: 'travel',
      duration: finalTravelTime
    });
      currentTime += finalTravelTime;
      totalTravelMinutes += finalTravelTime;
    }

    // Check if everything fits within working hours
    const conflicts: string[] = [];
    if (currentTime > endMinutes) {
      conflicts.push(`Schedule extends beyond working hours (${minutesToTime(currentTime)} > ${workingHours.end})`);
    }

    // Check travel tolerance
    const maxAllowedTravel = 120 * maxTravelToleranceMultiplier; // Base 2 hours, adjustable
    if (totalTravelMinutes > maxAllowedTravel) {
      conflicts.push(`Total travel time (${totalTravelMinutes}min) exceeds tolerance (${maxAllowedTravel}min)`);
    }

    const canFit = conflicts.length === 0;

    console.log(`Matrix day-fit result: ${canFit ? 'FITS' : 'NO FIT'}, ${totalTravelMinutes}min travel, ${conflicts.length} conflicts`);

    return {
      canFit,
      totalTravelMinutes,
      conflicts,
      schedule
    };

  } catch (error) {
    console.error('Matrix day-fit calculation error:', error);
    return {
      canFit: false,
      totalTravelMinutes: 0,
      conflicts: [`Calculation error: ${error.message}`],
      schedule: []
    };
  }
}

/**
 * Get travel matrix for multiple locations using single Matrix API call
 */
async function getTravelMatrix(locations: string[]): Promise<number[][]> {
  try {
    const response = await apiClient.post('/mapbox-distance', {
      origins: locations,
      destinations: locations
    });

    if (!response.ok) {
      throw new Error(`Matrix API error: ${response.error}`);
    }

    return response.data.durations; // Minutes
  } catch (error) {
    console.error('Matrix API call failed:', error);
    throw error;
  }
}

/**
 * Get single travel time for simple cases (fallback to Directions API)
 */
async function getSingleTravelTime(from: string, to: string): Promise<number> {
  if (from === to) return 0;

  try {
    const response = await apiClient.post('/mapbox-distance', {
      origins: [from],
      destinations: [to]
    });

    if (!response.ok) {
      throw new Error(`Travel time API error: ${response.error}`);
    }

    return response.data.durations[0][0] || 0;
  } catch (error) {
    console.error('Single travel time failed:', error);
    return 30; // Fallback assumption
  }
}

/**
 * Extract travel time from matrix results
 */
function getTravelTimeFromMatrix(
  matrix: number[][],
  locations: string[],
  from: string,
  to: string
): number {
  if (from === to) return 0;

  const fromIndex = locations.indexOf(from);
  const toIndex = locations.indexOf(to);

  if (fromIndex === -1 || toIndex === -1) {
    console.warn(`Location not found in matrix: ${from} -> ${to}`);
    return 30; // Fallback
  }

  return matrix[fromIndex][toIndex] || 0;
}

/**
 * Helper functions for time calculations
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function addMinutesToTime(time: string, minutesToAdd: number): string {
  const totalMinutes = timeToMinutes(time) + minutesToAdd;
  return minutesToTime(totalMinutes);
}

/**
 * Get Mapbox usage metrics for a session
 */
export async function getMapboxUsageMetrics(sessionId?: string): Promise<{
  geocoding: number;
  directions: number;
  matrix: number;
  total: number;
}> {
  try {
    const { data, error } = await supabase
      .from('mapbox_usage_tracking')
      .select('api_type, call_count')
      .eq('session_id', sessionId || 'current-session')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

    if (error) throw error;

    const metrics = data.reduce((acc, record) => {
      acc[record.api_type] = (acc[record.api_type] || 0) + record.call_count;
      return acc;
    }, { geocoding: 0, directions: 0, matrix: 0 });

    const total = metrics.geocoding + metrics.directions + metrics.matrix;

    return { ...metrics, total };
  } catch (error) {
    console.error('Failed to get usage metrics:', error);
    return { geocoding: 0, directions: 0, matrix: 0, total: 0 };
  }
}