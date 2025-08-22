import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowUpDown, 
  Wrench, 
  Edit, 
  Trash2, 
  Download, 
  X,
  Package,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface BulkAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  onClick: (selectedIds: string[]) => void;
  requiresConfirmation?: boolean;
  disabled?: (selectedIds: string[]) => boolean;
}

interface BulkActionsBarProps {
  selectedIds: string[];
  totalCount: number;
  onClearSelection: () => void;
  onSelectAll: () => void;
  actions: BulkAction[];
}

export function BulkActionsBar({
  selectedIds,
  totalCount,
  onClearSelection,
  onSelectAll,
  actions
}: BulkActionsBarProps) {
  const selectedCount = selectedIds.length;
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="flex items-center gap-4 p-4">
        {/* Selection Info */}
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <Badge variant="secondary" className="font-medium">
            {selectedCount} selected
          </Badge>
          {!isAllSelected && totalCount > 0 && (
            <Button
              variant="link"
              size="sm"
              onClick={onSelectAll}
              className="text-xs p-0 h-auto"
            >
              Select all {totalCount}
            </Button>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Bulk Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {actions.map((action) => {
            const Icon = action.icon;
            const isDisabled = action.disabled?.(selectedIds) || false;
            
            return (
              <Button
                key={action.id}
                variant={action.variant || 'outline'}
                size="sm"
                onClick={() => action.onClick(selectedIds)}
                disabled={isDisabled}
                className="text-xs"
              >
                <Icon className="h-3 w-3 mr-1" />
                {action.label}
              </Button>
            );
          })}
        </div>

        {/* Clear Selection */}
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

// Common bulk actions for inventory items
export const inventoryBulkActions: BulkAction[] = [
  {
    id: 'transfer',
    label: 'Transfer',
    icon: ArrowUpDown,
    variant: 'default',
    onClick: (ids) => console.log('Transfer items:', ids)
  },
  {
    id: 'adjust',
    label: 'Adjust Stock',
    icon: Wrench,
    variant: 'secondary',
    onClick: (ids) => console.log('Adjust stock:', ids)
  },
  {
    id: 'edit',
    label: 'Edit',
    icon: Edit,
    variant: 'outline',
    onClick: (ids) => console.log('Edit items:', ids),
    disabled: (ids) => ids.length > 1 // Only allow single edit
  },
  {
    id: 'activate',
    label: 'Activate',
    icon: ToggleRight,
    variant: 'outline',
    onClick: (ids) => console.log('Activate items:', ids)
  },
  {
    id: 'deactivate',
    label: 'Deactivate',
    icon: ToggleLeft,
    variant: 'outline',
    onClick: (ids) => console.log('Deactivate items:', ids)
  },
  {
    id: 'export',
    label: 'Export',
    icon: Download,
    variant: 'outline',
    onClick: (ids) => console.log('Export items:', ids)
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    variant: 'destructive',
    onClick: (ids) => console.log('Delete items:', ids),
    requiresConfirmation: true
  }
];