import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Grid3X3, List, Table2 } from 'lucide-react';

export type ViewMode = 'grid' | 'list' | 'table';

interface InventoryViewSwitcherProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  itemCount?: number;
  className?: string;
}

export function InventoryViewSwitcher({
  currentView,
  onViewChange,
  itemCount,
  className = ''
}: InventoryViewSwitcherProps) {
  const views = [
    { 
      id: 'grid' as ViewMode, 
      icon: Grid3X3, 
      label: 'Grid',
      description: 'Card view with visual details'
    },
    { 
      id: 'list' as ViewMode, 
      icon: List, 
      label: 'List',
      description: 'Compact list view'
    },
    { 
      id: 'table' as ViewMode, 
      icon: Table2, 
      label: 'Table',
      description: 'Detailed table view'
    }
  ];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center rounded-lg border bg-background p-1">
        {views.map((view) => {
          const Icon = view.icon;
          const isActive = currentView === view.id;
          
          return (
            <Button
              key={view.id}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange(view.id)}
              className={`h-8 px-3 ${
                isActive 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'hover:bg-muted'
              }`}
              title={view.description}
            >
              <Icon className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">{view.label}</span>
            </Button>
          );
        })}
      </div>
      
      {itemCount !== undefined && (
        <Badge variant="secondary" className="text-xs">
          {itemCount} items
        </Badge>
      )}
    </div>
  );
}

// Hook for managing view mode with localStorage persistence
export function useInventoryView(defaultView: ViewMode = 'grid', storageKey = 'inventory-view') {
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      return (stored as ViewMode) || defaultView;
    }
    return defaultView;
  });

  const handleViewChange = (view: ViewMode) => {
    setViewMode(view);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, view);
    }
  };

  return [viewMode, handleViewChange] as const;
}