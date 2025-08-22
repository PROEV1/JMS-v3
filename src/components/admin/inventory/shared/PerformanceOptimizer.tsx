import React, { useMemo, useState, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter } from 'lucide-react';

interface VirtualizedListProps {
  items: any[];
  height: number;
  itemHeight: number;
  renderItem: (props: { index: number; style: React.CSSProperties; data: any[] }) => React.ReactNode;
  searchKeys?: string[];
  filterOptions?: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
}

// Virtualized list component for large datasets
export function VirtualizedInventoryList({
  items,
  height = 600,
  itemHeight = 80,
  renderItem,
  searchKeys = ['name', 'sku'],
  filterOptions = []
}: VirtualizedListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Memoized filtered items for performance
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search filter
      const matchesSearch = !searchTerm || searchKeys.some(key => 
        item[key]?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // Additional filters
      const matchesFilters = Object.entries(filters).every(([key, value]) => {
        if (!value || value === 'all') return true;
        return item[key] === value;
      });

      return matchesSearch && matchesFilters;
    });
  }, [items, searchTerm, filters, searchKeys]);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {filterOptions.map(option => (
          <select
            key={option.key}
            value={filters[option.key] || 'all'}
            onChange={(e) => handleFilterChange(option.key, e.target.value)}
            className="px-3 py-2 border rounded-md bg-background"
          >
            <option value="all">All {option.label}</option>
            {option.options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>

      {/* Results count */}
      <div className="flex justify-between items-center">
        <Badge variant="secondary">
          {filteredItems.length} of {items.length} items
        </Badge>
        {Object.keys(filters).some(key => filters[key] && filters[key] !== 'all') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({})}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Virtualized List */}
      <Card>
        <CardContent className="p-0">
          <List
            height={height}
            width="100%"
            itemCount={filteredItems.length}
            itemSize={itemHeight}
            itemData={filteredItems}
            overscanCount={5}
          >
            {renderItem}
          </List>
        </CardContent>
      </Card>
    </div>
  );
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const [renderTimes, setRenderTimes] = useState<number[]>([]);

  React.useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      setRenderTimes(prev => {
        const newTimes = [...prev, renderTime].slice(-10); // Keep last 10 renders
        
        // Log performance warnings
        const avgTime = newTimes.reduce((sum, time) => sum + time, 0) / newTimes.length;
        if (avgTime > 16) { // 60fps threshold
          console.warn(`${componentName} render time: ${avgTime.toFixed(2)}ms (target: <16ms)`);
        }
        
        return newTimes;
      });
    };
  });

  const averageRenderTime = renderTimes.length > 0 
    ? renderTimes.reduce((sum, time) => sum + time, 0) / renderTimes.length 
    : 0;

  return { averageRenderTime, renderTimes };
}

// Debounced search hook
export function useDebouncedSearch(value: string, delay: number = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Optimized image loading component
interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: string;
}

export function OptimizedImage({ src, alt, className, fallback }: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
  }, []);

  if (hasError && fallback) {
    return <img src={fallback} alt={alt} className={className} />;
  }

  return (
    <div className={`relative ${className}`}>
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        loading="lazy"
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse rounded" />
      )}
    </div>
  );
}