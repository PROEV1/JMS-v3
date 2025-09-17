import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, RefreshCw } from 'lucide-react';
import { Engineer } from '@/utils/schedulingUtils';

interface SearchFilters {
  searchTerm: string;
  selectedEngineers: string[];
  jobTypes: string[];
  statuses: string[];
  region: string;
  dateRange: string;
}

interface SearchAndFilterPanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  engineers: Engineer[];
  onReset: () => void;
  className?: string;
}

const JOB_TYPES = [
  'installation',
  'assessment',
  'service_call',
  'maintenance',
  'repair',
  'survey'
];

const ORDER_STATUSES = [
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'date_offered',
  'date_accepted',
  'date_rejected'
];

const REGIONS = [
  'north',
  'south',
  'east',
  'west',
  'central'
];

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'This Week' },
  { value: 'next_week', label: 'Next Week' },
  { value: 'this_month', label: 'This Month' }
];

export function SearchAndFilterPanel({
  filters,
  onFiltersChange,
  engineers,
  onReset,
  className = ''
}: SearchAndFilterPanelProps) {
  const updateFilters = (updates: Partial<SearchFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const toggleEngineer = (engineerId: string) => {
    const isSelected = filters.selectedEngineers.includes(engineerId);
    const newSelection = isSelected
      ? filters.selectedEngineers.filter(id => id !== engineerId)
      : [...filters.selectedEngineers, engineerId];
    
    updateFilters({ selectedEngineers: newSelection });
  };

  const toggleJobType = (jobType: string) => {
    const isSelected = filters.jobTypes.includes(jobType);
    const newSelection = isSelected
      ? filters.jobTypes.filter(type => type !== jobType)
      : [...filters.jobTypes, jobType];
    
    updateFilters({ jobTypes: newSelection });
  };

  const toggleStatus = (status: string) => {
    const isSelected = filters.statuses.includes(status);
    const newSelection = isSelected
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status];
    
    updateFilters({ statuses: newSelection });
  };

  const hasActiveFilters = 
    filters.searchTerm ||
    filters.selectedEngineers.length > 0 ||
    filters.jobTypes.length > 0 ||
    filters.statuses.length > 0 ||
    filters.region !== 'all' ||
    filters.dateRange !== 'all';

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Search & Filters
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by engineer, client, order number, or postcode..."
              value={filters.searchTerm}
              onChange={(e) => updateFilters({ searchTerm: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Engineers Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Engineers ({filters.selectedEngineers.length} selected)
            </Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
              {engineers.map((engineer) => (
                <div key={engineer.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={engineer.id}
                    checked={filters.selectedEngineers.includes(engineer.id)}
                    onCheckedChange={() => toggleEngineer(engineer.id)}
                  />
                  <Label
                    htmlFor={engineer.id}
                    className="text-sm cursor-pointer flex-1"
                  >
                    {engineer.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Job Types Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Job Types ({filters.jobTypes.length} selected)
            </Label>
            <div className="space-y-2 border rounded-md p-2">
              {JOB_TYPES.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <Checkbox
                    id={type}
                    checked={filters.jobTypes.includes(type)}
                    onCheckedChange={() => toggleJobType(type)}
                  />
                  <Label
                    htmlFor={type}
                    className="text-sm cursor-pointer flex-1 capitalize"
                  >
                    {type}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Status ({filters.statuses.length} selected)
            </Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
              {ORDER_STATUSES.map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={status}
                    checked={filters.statuses.includes(status)}
                    onCheckedChange={() => toggleStatus(status)}
                  />
                  <Label
                    htmlFor={status}
                    className="text-sm cursor-pointer flex-1 capitalize"
                  >
                    {status.replace('_', ' ')}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Region and Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Region</Label>
            <Select value={filters.region} onValueChange={(value) => updateFilters({ region: value })}>
              <SelectTrigger>
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {REGIONS.map((region) => (
                  <SelectItem key={region} value={region}>
                    {region.charAt(0).toUpperCase() + region.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Date Range</Label>
            <Select value={filters.dateRange} onValueChange={(value) => updateFilters({ dateRange: value })}>
              <SelectTrigger>
                <SelectValue placeholder="All Dates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                {DATE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active Filters:</Label>
            <div className="flex flex-wrap gap-2">
              {filters.searchTerm && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Search: {filters.searchTerm}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => updateFilters({ searchTerm: '' })}
                  />
                </Badge>
              )}
              {filters.selectedEngineers.map((engineerId) => {
                const engineer = engineers.find(e => e.id === engineerId);
                return engineer ? (
                  <Badge key={engineerId} variant="secondary" className="flex items-center gap-1">
                    {engineer.name}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => toggleEngineer(engineerId)}
                    />
                  </Badge>
                ) : null;
              })}
              {filters.jobTypes.map((type) => (
                <Badge key={type} variant="secondary" className="flex items-center gap-1 capitalize">
                  {type}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => toggleJobType(type)}
                  />
                </Badge>
              ))}
              {filters.statuses.map((status) => (
                <Badge key={status} variant="secondary" className="flex items-center gap-1 capitalize">
                  {status.replace('_', ' ')}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => toggleStatus(status)}
                  />
                </Badge>
              ))}
              {filters.region !== 'all' && (
                <Badge variant="secondary" className="flex items-center gap-1 capitalize">
                  Region: {filters.region}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => updateFilters({ region: 'all' })}
                  />
                </Badge>
              )}
              {filters.dateRange !== 'all' && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  {DATE_RANGES.find(r => r.value === filters.dateRange)?.label || filters.dateRange}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => updateFilters({ dateRange: 'all' })}
                  />
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}