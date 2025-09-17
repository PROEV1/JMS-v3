import { useState, useMemo } from 'react';
import { Order, Engineer } from '@/utils/schedulingUtils';

interface SearchFilters {
  searchTerm: string;
  selectedEngineers: string[];
  jobTypes: string[];
  statuses: string[];
  region: string;
  dateRange: string;
}

const DEFAULT_FILTERS: SearchFilters = {
  searchTerm: '',
  selectedEngineers: [],
  jobTypes: [],
  statuses: [],
  region: 'all',
  dateRange: 'all'
};

interface UseSchedulingFiltersReturn {
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  resetFilters: () => void;
  filteredOrders: Order[];
  filteredEngineers: Engineer[];
}

export function useSchedulingFilters(
  orders: Order[], 
  engineers: Engineer[]
): UseSchedulingFiltersReturn {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Search term filter (engineer name, client name, order number, postcode)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          order.order_number?.toLowerCase().includes(searchLower) ||
          order.client?.full_name?.toLowerCase().includes(searchLower) ||
          order.client?.postcode?.toLowerCase().includes(searchLower) ||
          order.engineer?.name?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Engineer filter
      if (filters.selectedEngineers.length > 0) {
        if (!order.engineer_id || !filters.selectedEngineers.includes(order.engineer_id)) {
          return false;
        }
      }

      // Job type filter (based on order type or inferred from status/requirements)
      if (filters.jobTypes.length > 0) {
        const orderJobType = inferJobType(order);
        if (!filters.jobTypes.includes(orderJobType)) {
          return false;
        }
      }

      // Status filter
      if (filters.statuses.length > 0) {
        if (!filters.statuses.includes(order.status_enhanced)) {
          return false;
        }
      }

      // Region filter (based on engineer region or client postcode region)
      if (filters.region !== 'all') {
        const orderRegion = order.engineer?.region || inferRegionFromPostcode(order.client?.postcode);
        if (orderRegion !== filters.region) {
          return false;
        }
      }

      // Date range filter
      if (filters.dateRange !== 'all') {
        if (!matchesDateRange(order.scheduled_install_date, filters.dateRange)) {
          return false;
        }
      }

      return true;
    });
  }, [orders, filters]);

  const filteredEngineers = useMemo(() => {
    if (filters.selectedEngineers.length === 0 && filters.region === 'all') {
      return engineers;
    }

    return engineers.filter(engineer => {
      // If specific engineers are selected, only show those
      if (filters.selectedEngineers.length > 0) {
        return filters.selectedEngineers.includes(engineer.id);
      }

      // If region filter is applied, show engineers from that region
      if (filters.region !== 'all') {
        return engineer.region === filters.region;
      }

      return true;
    });
  }, [engineers, filters]);

  return {
    filters,
    setFilters,
    resetFilters,
    filteredOrders,
    filteredEngineers
  };
}

// Helper functions
function inferJobType(order: Order): string {
  // Use existing job_type if available
  if (order.job_type) {
    return order.job_type.toLowerCase();
  }
  
  // Try to infer from status or other properties
  if (order.status_enhanced === 'completed') {
    return 'installation'; // Most completed jobs are installations
  }
  
  // Check if it might be an assessment based on survey requirement
  if (order.survey_required) {
    return 'assessment';
  }
  
  // Default to installation for most orders
  return 'installation';
}

function inferRegionFromPostcode(postcode?: string): string | null {
  if (!postcode) return null;
  
  // Simple postcode region inference (UK postcodes)
  const firstChar = postcode.charAt(0).toLowerCase();
  
  // This is a simplified mapping - you might want to use a more comprehensive one
  const regionMap: Record<string, string> = {
    'b': 'central',   // Birmingham
    'm': 'north',     // Manchester
    'l': 'north',     // Liverpool  
    'ls': 'north',    // Leeds
    'e': 'east',      // East London
    'n': 'north',     // North London
    's': 'south',     // South areas
    'w': 'west',      // West areas
    'sw': 'south',    // South West
    'se': 'south',    // South East
    'nw': 'north',    // North West
    'ne': 'north'     // North East
  };
  
  return regionMap[firstChar] || null;
}

function matchesDateRange(date: string | null, range: string): boolean {
  if (!date) return false;
  
  const orderDate = new Date(date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  switch (range) {
    case 'today':
      return orderDate >= today && orderDate < tomorrow;
    
    case 'tomorrow':
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(tomorrow.getDate() + 1);
      return orderDate >= tomorrow && orderDate < dayAfterTomorrow;
    
    case 'this_week':
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startOfWeek.setDate(today.getDate() - daysToMonday);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      
      return orderDate >= startOfWeek && orderDate < endOfWeek;
    
    case 'next_week':
      const nextWeekStart = new Date(today);
      const currentDayOfWeek = today.getDay();
      const daysToNextMonday = 7 - (currentDayOfWeek === 0 ? 7 : currentDayOfWeek - 1);
      nextWeekStart.setDate(today.getDate() + daysToNextMonday);
      
      const nextWeekEnd = new Date(nextWeekStart);
      nextWeekEnd.setDate(nextWeekStart.getDate() + 7);
      
      return orderDate >= nextWeekStart && orderDate < nextWeekEnd;
    
    case 'this_month':
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      
      return orderDate >= startOfMonth && orderDate < endOfMonth;
    
    default:
      return true;
  }
}