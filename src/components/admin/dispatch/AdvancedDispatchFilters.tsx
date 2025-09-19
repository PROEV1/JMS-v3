import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Search, Filter, Save, Download, X } from 'lucide-react';
import { useEngineersForDispatch } from '@/hooks/useChargerDispatchData';

interface AdvancedFilters {
  search: string;
  dateRange: 'today' | 'week' | 'month' | 'custom';
  customDateFrom: string;
  customDateTo: string;
  urgencyLevels: string[];
  clientPostcodes: string[];
  installerRegions: string[];
  jobTypes: string[];
  excludeServiceCalls: boolean;
  onlyOverdue: boolean;
  savedFilterName: string;
}

interface AdvancedDispatchFiltersProps {
  onApplyFilters: (filters: AdvancedFilters) => void;
  onExportData: (filters: AdvancedFilters) => void;
  className?: string;
}

const URGENCY_LEVELS = [
  { value: 'urgent', label: 'Urgent (≤2 days)', color: 'destructive' },
  { value: 'warning', label: 'Warning (≤5 days)', color: 'secondary' },
  { value: 'normal', label: 'Normal (>5 days)', color: 'outline' }
];

const JOB_TYPES = [
  { value: 'new_install', label: 'New Installation' },
  { value: 'service_call', label: 'Service Call' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'upgrade', label: 'Upgrade' }
];

export function AdvancedDispatchFilters({ 
  onApplyFilters, 
  onExportData,
  className 
}: AdvancedDispatchFiltersProps) {
  const { data: engineers } = useEngineersForDispatch();
  const [filters, setFilters] = useState<AdvancedFilters>({
    search: '',
    dateRange: 'week',
    customDateFrom: '',
    customDateTo: '',
    urgencyLevels: [],
    clientPostcodes: [],
    installerRegions: [],
    jobTypes: [],
    excludeServiceCalls: false,
    onlyOverdue: false,
    savedFilterName: ''
  });

  const [savedFilters, setSavedFilters] = useState<Array<{ name: string; filters: AdvancedFilters }>>([]);

  const uniqueRegions = [...new Set(engineers?.map(e => e.region).filter(Boolean))];

  const handleFilterChange = (key: keyof AdvancedFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayFilter = (key: 'urgencyLevels' | 'clientPostcodes' | 'installerRegions' | 'jobTypes', value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value) 
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value]
    }));
  };

  const saveCurrentFilter = () => {
    if (!filters.savedFilterName.trim()) return;
    
    setSavedFilters(prev => [
      ...prev.filter(f => f.name !== filters.savedFilterName),
      { name: filters.savedFilterName, filters: { ...filters } }
    ]);
    
    // Store in localStorage
    const saved = JSON.parse(localStorage.getItem('dispatch-saved-filters') || '[]');
    const updated = [
      ...saved.filter((f: any) => f.name !== filters.savedFilterName),
      { name: filters.savedFilterName, filters: { ...filters } }
    ];
    localStorage.setItem('dispatch-saved-filters', JSON.stringify(updated));
  };

  const loadSavedFilter = (savedFilter: { name: string; filters: AdvancedFilters }) => {
    setFilters(savedFilter.filters);
    onApplyFilters(savedFilter.filters);
  };

  const clearAllFilters = () => {
    const clearedFilters: AdvancedFilters = {
      search: '',
      dateRange: 'week',
      customDateFrom: '',
      customDateTo: '',
      urgencyLevels: [],
      clientPostcodes: [],
      installerRegions: [],
      jobTypes: [],
      excludeServiceCalls: false,
      onlyOverdue: false,
      savedFilterName: ''
    };
    setFilters(clearedFilters);
    onApplyFilters(clearedFilters);
  };

  // Load saved filters on mount
  React.useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('dispatch-saved-filters') || '[]');
    setSavedFilters(saved);
  }, []);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Advanced Filters
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="space-y-2">
          <Label>Search Orders</Label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Order number, client name, postcode..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Date Range */}
        <div className="space-y-3">
          <Label>Date Range</Label>
          <Select
            value={filters.dateRange}
            onValueChange={(value) => handleFilterChange('dateRange', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Next 7 Days</SelectItem>
              <SelectItem value="month">Next 30 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          
          {filters.dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <Input
                  type="date"
                  value={filters.customDateFrom}
                  onChange={(e) => handleFilterChange('customDateFrom', e.target.value)}
                />
              </div>
              <div>
                <Label>To</Label>
                <Input
                  type="date"
                  value={filters.customDateTo}
                  onChange={(e) => handleFilterChange('customDateTo', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Urgency Levels */}
        <div className="space-y-3">
          <Label>Urgency Levels</Label>
          <div className="flex flex-wrap gap-2">
            {URGENCY_LEVELS.map(level => (
              <Badge
                key={level.value}
                variant={filters.urgencyLevels.includes(level.value) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleArrayFilter('urgencyLevels', level.value)}
              >
                {level.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Job Types */}
        <div className="space-y-3">
          <Label>Job Types</Label>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map(type => (
              <Badge
                key={type.value}
                variant={filters.jobTypes.includes(type.value) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleArrayFilter('jobTypes', type.value)}
              >
                {type.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Regions */}
        <div className="space-y-3">
          <Label>Installer Regions</Label>
          <div className="flex flex-wrap gap-2">
            {uniqueRegions.map(region => (
              <Badge
                key={region}
                variant={filters.installerRegions.includes(region) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleArrayFilter('installerRegions', region)}
              >
                {region}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Quick Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Exclude Service Calls</Label>
            <Switch
              checked={filters.excludeServiceCalls}
              onCheckedChange={(checked) => handleFilterChange('excludeServiceCalls', checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Only Overdue Dispatches</Label>
            <Switch
              checked={filters.onlyOverdue}
              onCheckedChange={(checked) => handleFilterChange('onlyOverdue', checked)}
            />
          </div>
        </div>

        <Separator />

        {/* Save Filter */}
        <div className="space-y-3">
          <Label>Save Current Filter</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Filter name..."
              value={filters.savedFilterName}
              onChange={(e) => handleFilterChange('savedFilterName', e.target.value)}
              className="flex-1"
            />
            <Button onClick={saveCurrentFilter} size="sm">
              <Save className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <div className="space-y-3">
            <Label>Saved Filters</Label>
            <div className="flex flex-wrap gap-2">
              {savedFilters.map(savedFilter => (
                <Badge
                  key={savedFilter.name}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => loadSavedFilter(savedFilter)}
                >
                  {savedFilter.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4">
          <Button onClick={() => onApplyFilters(filters)} className="flex-1">
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
          <Button onClick={() => onExportData(filters)} variant="outline" className="flex-1">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button onClick={clearAllFilters} variant="outline" size="sm">
            <X className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}