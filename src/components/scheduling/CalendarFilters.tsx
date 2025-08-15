import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Engineer } from '@/utils/schedulingUtils';
import { Filter } from 'lucide-react';

interface CalendarFiltersProps {
  engineers: Engineer[];
  filters: {
    engineerId: string;
    region: string;
    status: string;
  };
  onFiltersChange: (filters: any) => void;
}

export function CalendarFilters({ engineers, filters, onFiltersChange }: CalendarFiltersProps) {
  const regions = [...new Set(engineers.map(e => e.region).filter(Boolean))];
  
  const statuses = [
    { value: 'awaiting_payment', label: 'Awaiting Payment' },
    { value: 'awaiting_agreement', label: 'Awaiting Agreement' },
    { value: 'awaiting_install_booking', label: 'Awaiting Booking' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'awaiting_final_payment', label: 'Awaiting Final Payment' },
    { value: 'completed', label: 'Completed' }
  ];

  const updateFilter = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      engineerId: 'all-engineers',
      region: 'all-regions',
      status: 'all-statuses'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Calendar Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Engineer</label>
            <Select value={filters.engineerId} onValueChange={(value) => updateFilter('engineerId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Engineers" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="all-engineers">All Engineers</SelectItem>
                {engineers.map(engineer => (
                  <SelectItem key={engineer.id} value={engineer.id}>
                    {engineer.name} {engineer.region && `(${engineer.region})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-sm font-medium mb-2 block">Region</label>
            <Select value={filters.region} onValueChange={(value) => updateFilter('region', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="all-regions">All Regions</SelectItem>
                {regions.map(region => (
                  <SelectItem key={region} value={region!}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[180px]">
            <label className="text-sm font-medium mb-2 block">Status</label>
            <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent className="bg-background border border-border z-50">
                <SelectItem value="all-statuses">All Statuses</SelectItem>
                {statuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}