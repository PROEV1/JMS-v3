import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X } from 'lucide-react';

interface SearchFilters {
  name?: string;
  sku?: string;
  category?: string;
  supplier?: string;
  costRange?: [number, number];
  stockLevel?: 'all' | 'low' | 'normal' | 'high';
  isActive?: boolean;
  isSerialized?: boolean;
  tags?: string[];
}

interface AdvancedSearchModalProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onClear: () => void;
}

export function AdvancedSearchModal({ filters, onFiltersChange, onClear }: AdvancedSearchModalProps) {
  const [localFilters, setLocalFilters] = useState<SearchFilters>(filters);
  const [isOpen, setIsOpen] = useState(false);

  const handleApply = () => {
    onFiltersChange(localFilters);
    setIsOpen(false);
  };

  const handleClear = () => {
    setLocalFilters({});
    onClear();
    setIsOpen(false);
  };

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  const activeFilterCount = Object.values(filters).filter(value => 
    value !== undefined && value !== '' && value !== 'all' && 
    (Array.isArray(value) ? value.length > 0 : true)
  ).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="h-4 w-4 mr-2" />
          Advanced Search
          {activeFilterCount > 0 && (
            <Badge className="ml-2 h-5 w-5 p-0 text-xs rounded-full bg-primary text-primary-foreground">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Advanced Search & Filters</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Basic Search */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name</Label>
              <Input
                id="name"
                placeholder="Search by name..."
                value={localFilters.name || ''}
                onChange={(e) => updateFilter('name', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                placeholder="Search by SKU..."
                value={localFilters.sku || ''}
                onChange={(e) => updateFilter('sku', e.target.value)}
              />
            </div>
          </div>

          {/* Category & Supplier */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={localFilters.category || ''} onValueChange={(value) => updateFilter('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  <SelectItem value="charger">Chargers</SelectItem>
                  <SelectItem value="cable">Cables</SelectItem>
                  <SelectItem value="mounting">Mounting</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="consumable">Consumables</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select value={localFilters.supplier || ''} onValueChange={(value) => updateFilter('supplier', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All suppliers</SelectItem>
                  <SelectItem value="supplier1">Supplier 1</SelectItem>
                  <SelectItem value="supplier2">Supplier 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cost Range */}
          <div className="space-y-3">
            <Label>Cost Range (£)</Label>
            <div className="px-3">
              <Slider
                value={localFilters.costRange || [0, 1000]}
                onValueChange={(value) => updateFilter('costRange', value)}
                max={1000}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground mt-1">
                <span>£{localFilters.costRange?.[0] || 0}</span>
                <span>£{localFilters.costRange?.[1] || 1000}</span>
              </div>
            </div>
          </div>

          {/* Stock Level */}
          <div className="space-y-2">
            <Label>Stock Level</Label>
            <Select value={localFilters.stockLevel || 'all'} onValueChange={(value) => updateFilter('stockLevel', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="low">Low stock</SelectItem>
                <SelectItem value="normal">Normal stock</SelectItem>
                <SelectItem value="high">High stock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Checkboxes */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={localFilters.isActive || false}
                onCheckedChange={(checked) => updateFilter('isActive', checked)}
              />
              <Label htmlFor="active">Active items only</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="serialized"
                checked={localFilters.isSerialized || false}
                onCheckedChange={(checked) => updateFilter('isSerialized', checked)}
              />
              <Label htmlFor="serialized">Serialized items only</Label>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFilterCount > 0 && (
            <div className="space-y-2">
              <Label>Active Filters</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(filters).map(([key, value]) => {
                  if (!value || value === 'all' || value === '' || 
                      (Array.isArray(value) && value.length === 0)) return null;
                  
                  return (
                    <Badge key={key} variant="secondary" className="text-xs">
                      {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
                      <button
                        onClick={() => updateFilter(key as keyof SearchFilters, undefined)}
                        className="ml-1 hover:bg-destructive/20 rounded-full"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={handleClear}>
            Clear All
          </Button>
          <div className="space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply}>
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}