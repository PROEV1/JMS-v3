
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Filter, X } from 'lucide-react';

interface PartnerQuoteFiltersProps {
  filters: {
    region: string;
    job_type: string;
    date_range: string;
    assigned_user: string;
    quote_value_min: string;
    quote_value_max: string;
  };
  onFiltersChange: (filters: any) => void;
}

export function PartnerQuoteFilters({ filters, onFiltersChange }: PartnerQuoteFiltersProps) {
  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      region: '',
      job_type: '',
      date_range: '',
      assigned_user: '',
      quote_value_min: '',
      quote_value_max: ''
    });
  };

  const hasActiveFilters = Object.values(filters).some(value => value !== '');

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters</span>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Input
            placeholder="Region/Postcode..."
            value={filters.region}
            onChange={(e) => handleFilterChange('region', e.target.value)}
          />

          <Select value={filters.job_type} onValueChange={(value) => handleFilterChange('job_type', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Job Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="installation">Installation</SelectItem>
              <SelectItem value="assessment">Assessment</SelectItem>
              <SelectItem value="service_call">Service Call</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.date_range} onValueChange={(value) => handleFilterChange('date_range', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Assigned User..."
            value={filters.assigned_user}
            onChange={(e) => handleFilterChange('assigned_user', e.target.value)}
          />

          <Input
            placeholder="Min £"
            type="number"
            value={filters.quote_value_min}
            onChange={(e) => handleFilterChange('quote_value_min', e.target.value)}
          />

          <Input
            placeholder="Max £"
            type="number"
            value={filters.quote_value_max}
            onChange={(e) => handleFilterChange('quote_value_max', e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
