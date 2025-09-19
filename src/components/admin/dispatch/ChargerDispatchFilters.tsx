import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, Filter, RefreshCw } from 'lucide-react';
import { useEngineersForDispatch } from '@/hooks/useChargerDispatchData';

interface DispatchFilters {
  dateFrom: string;
  dateTo: string;
  region: string;
  engineer: string;
  dispatchStatus: string;
  jobType: string;
}

interface ChargerDispatchFiltersProps {
  filters: DispatchFilters;
  onFiltersChange: (filters: DispatchFilters) => void;
}

export function ChargerDispatchFilters({ filters, onFiltersChange }: ChargerDispatchFiltersProps) {
  const { data: engineers = [] } = useEngineersForDispatch();

  const handleFilterChange = (key: keyof DispatchFilters, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      dateFrom: '',
      dateTo: '',
      region: 'all',
      engineer: 'all',
      dispatchStatus: 'all',
      jobType: 'all'
    });
  };

  const setQuickDateRange = (days: number) => {
    const today = new Date();
    const fromDate = new Date();
    fromDate.setDate(today.getDate() - 1); // Start from yesterday
    
    const toDate = new Date();
    toDate.setDate(today.getDate() + days);

    onFiltersChange({
      ...filters,
      dateFrom: fromDate.toISOString().split('T')[0],
      dateTo: toDate.toISOString().split('T')[0]
    });
  };

  // Get unique regions from engineers
  const regions = [...new Set(engineers.map(e => e.region).filter(Boolean))];

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4" />
          <Label className="text-sm font-medium">Filters</Label>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateRange(7)}
            >
              Next 7 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickDateRange(14)}
            >
              Next 14 days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearFilters}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label htmlFor="dateFrom" className="text-xs">Install Date From</Label>
            <Input
              id="dateFrom"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dateTo" className="text-xs">Install Date To</Label>
            <Input
              id="dateTo"
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>

          {/* Region */}
          <div className="space-y-2">
            <Label className="text-xs">Region</Label>
            <Select
              value={filters.region}
              onValueChange={(value) => handleFilterChange('region', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Engineer */}
          <div className="space-y-2">
            <Label className="text-xs">Engineer</Label>
            <Select
              value={filters.engineer}
              onValueChange={(value) => handleFilterChange('engineer', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Engineers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Engineers</SelectItem>
                {engineers.map((engineer) => (
                  <SelectItem key={engineer.id} value={engineer.id}>
                    {engineer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dispatch Status */}
          <div className="space-y-2">
            <Label className="text-xs">Dispatch Status</Label>
            <Select
              value={filters.dispatchStatus}
              onValueChange={(value) => handleFilterChange('dispatchStatus', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending_dispatch">Pending Dispatch</SelectItem>
                <SelectItem value="sent">Dispatched</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="issue">Issue / On Hold</SelectItem>
                <SelectItem value="not_required">Not Required</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Job Type */}
          <div className="space-y-2">
            <Label className="text-xs">Job Type</Label>
            <Select
              value={filters.jobType}
              onValueChange={(value) => handleFilterChange('jobType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="installation">Installation</SelectItem>
                <SelectItem value="assessment">Assessment</SelectItem>
                <SelectItem value="service_call">Service Call</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}