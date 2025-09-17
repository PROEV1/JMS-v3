import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, Filter, X, RefreshCw, ChevronDown, Users, Briefcase, Activity } from 'lucide-react';
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
  const [isEngineersOpen, setIsEngineersOpen] = useState(false);
  const [isJobTypesOpen, setIsJobTypesOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);

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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Search & Filters
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="flex items-center gap-1 h-8 px-2 text-xs"
            >
              <RefreshCw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search engineers, clients, orders, postcodes..."
            value={filters.searchTerm}
            onChange={(e) => updateFilters({ searchTerm: e.target.value })}
            className="pl-10 h-9"
          />
        </div>

        {/* Quick Filters Row */}
        <div className="flex flex-wrap gap-2">
          {/* Engineers Collapsible */}
          <Collapsible open={isEngineersOpen} onOpenChange={setIsEngineersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1 h-8">
                <Users className="h-3 w-3" />
                Engineers ({filters.selectedEngineers.length})
                <ChevronDown className={`h-3 w-3 transition-transform ${isEngineersOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="absolute z-[60] mt-1 bg-background border rounded-md shadow-lg p-2 max-w-xs max-h-48 overflow-y-auto min-w-[200px]">
              <div className="grid grid-cols-1 gap-1">
                {engineers.slice(0, 10).map((engineer) => (
                  <div key={engineer.id} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={engineer.id}
                      checked={filters.selectedEngineers.includes(engineer.id)}
                      onCheckedChange={() => toggleEngineer(engineer.id)}
                      className="h-3 w-3"
                    />
                    <Label htmlFor={engineer.id} className="text-xs cursor-pointer flex-1">
                      {engineer.name}
                    </Label>
                  </div>
                ))}
                {engineers.length > 10 && (
                  <div className="text-xs text-muted-foreground px-1 py-1">
                    +{engineers.length - 10} more...
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Job Types Collapsible */}
          <Collapsible open={isJobTypesOpen} onOpenChange={setIsJobTypesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1 h-8">
                <Briefcase className="h-3 w-3" />
                Job Types ({filters.jobTypes.length})
                <ChevronDown className={`h-3 w-3 transition-transform ${isJobTypesOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="absolute z-[60] mt-1 bg-background border rounded-md shadow-lg p-2 max-w-xs min-w-[180px]">
              <div className="grid grid-cols-1 gap-1">
                {JOB_TYPES.map((type) => (
                  <div key={type} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={type}
                      checked={filters.jobTypes.includes(type)}
                      onCheckedChange={() => toggleJobType(type)}
                      className="h-3 w-3"
                    />
                    <Label htmlFor={type} className="text-xs cursor-pointer flex-1 capitalize">
                      {type.replace('_', ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Status Collapsible */}
          <Collapsible open={isStatusOpen} onOpenChange={setIsStatusOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1 h-8">
                <Activity className="h-3 w-3" />
                Status ({filters.statuses.length})
                <ChevronDown className={`h-3 w-3 transition-transform ${isStatusOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="absolute z-[60] mt-1 bg-background border rounded-md shadow-lg p-2 max-w-xs max-h-48 overflow-y-auto min-w-[180px]">
              <div className="grid grid-cols-1 gap-1">
                {ORDER_STATUSES.map((status) => (
                  <div key={status} className="flex items-center space-x-2 py-1">
                    <Checkbox
                      id={status}
                      checked={filters.statuses.includes(status)}
                      onCheckedChange={() => toggleStatus(status)}
                      className="h-3 w-3"
                    />
                    <Label htmlFor={status} className="text-xs cursor-pointer flex-1 capitalize">
                      {status.replace('_', ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Region Select */}
          <Select value={filters.region} onValueChange={(value) => updateFilters({ region: value })}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent className="z-[60] bg-background border shadow-lg">
              <SelectItem value="all">All Regions</SelectItem>
              {REGIONS.map((region) => (
                <SelectItem key={region} value={region}>
                  {region.charAt(0).toUpperCase() + region.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range Select */}
          <Select value={filters.dateRange} onValueChange={(value) => updateFilters({ dateRange: value })}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent className="z-[60] bg-background border shadow-lg">
              <SelectItem value="all">All Dates</SelectItem>
              {DATE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {filters.searchTerm && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs px-2 py-0.5">
                  {filters.searchTerm}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:bg-muted rounded" 
                    onClick={() => updateFilters({ searchTerm: '' })}
                  />
                </Badge>
              )}
              {filters.selectedEngineers.map((engineerId) => {
                const engineer = engineers.find(e => e.id === engineerId);
                return engineer ? (
                  <Badge key={engineerId} variant="secondary" className="flex items-center gap-1 text-xs px-2 py-0.5">
                    {engineer.name}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:bg-muted rounded" 
                      onClick={() => toggleEngineer(engineerId)}
                    />
                  </Badge>
                ) : null;
              })}
              {filters.jobTypes.map((type) => (
                <Badge key={type} variant="secondary" className="flex items-center gap-1 text-xs px-2 py-0.5 capitalize">
                  {type.replace('_', ' ')}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:bg-muted rounded" 
                    onClick={() => toggleJobType(type)}
                  />
                </Badge>
              ))}
              {filters.statuses.map((status) => (
                <Badge key={status} variant="secondary" className="flex items-center gap-1 text-xs px-2 py-0.5 capitalize">
                  {status.replace('_', ' ')}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:bg-muted rounded" 
                    onClick={() => toggleStatus(status)}
                  />
                </Badge>
              ))}
              {filters.region !== 'all' && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs px-2 py-0.5 capitalize">
                  {filters.region}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:bg-muted rounded" 
                    onClick={() => updateFilters({ region: 'all' })}
                  />
                </Badge>
              )}
              {filters.dateRange !== 'all' && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs px-2 py-0.5">
                  {DATE_RANGES.find(r => r.value === filters.dateRange)?.label || filters.dateRange}
                  <X 
                    className="h-3 w-3 cursor-pointer hover:bg-muted rounded" 
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