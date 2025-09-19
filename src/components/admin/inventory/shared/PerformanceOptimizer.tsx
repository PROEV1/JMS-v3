import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter } from 'lucide-react';

interface VirtualizedListProps {
  items: any[];
  renderItem: (props: { index: number; style: any; data: any }) => React.ReactElement;
  height?: number;
  itemHeight: number;
  searchable?: boolean;
  filterable?: boolean;
}

// Simplified performance optimizer without react-window dependency
export function VirtualizedList({
  items,
  renderItem,
  height = 400,
  itemHeight,
  searchable = false,
  filterable = false
}: VirtualizedListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValue, setFilterValue] = useState('');

  const filteredItems = useMemo(() => {
    let filtered = items;

    if (searchTerm) {
      filtered = filtered.filter((item: any) => 
        JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterValue) {
      filtered = filtered.filter((item: any) => 
        item.status === filterValue || item.type === filterValue
      );
    }

    return filtered;
  }, [items, searchTerm, filterValue]);

  return (
    <Card>
      <CardContent className="p-4">
        {(searchable || filterable) && (
          <div className="flex gap-2 mb-4">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            )}
            {filterable && (
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </Button>
            )}
          </div>
        )}

        <div className="max-h-96 overflow-auto border rounded">
          {filteredItems.map((item, index) => (
            <div key={item.id || index} className="p-2 border-b last:border-b-0">
              {renderItem({ index, style: { height: itemHeight }, data: item })}
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No items found
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export for backwards compatibility
export { VirtualizedList as PerformanceOptimizer };