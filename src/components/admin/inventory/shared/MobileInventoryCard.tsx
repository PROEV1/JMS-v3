import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Package, 
  MoreVertical, 
  ArrowUpDown, 
  Wrench, 
  Eye,
  Edit,
  AlertTriangle,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { StatusChip } from './StatusChip';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  unit: string;
  description?: string;
  default_cost: number;
  min_level: number;
  max_level: number;
  reorder_point: number;
  is_active: boolean;
  is_serialized: boolean;
  is_charger: boolean;
  current_stock?: number;
  supplier_name?: string;
}

interface MobileInventoryCardProps {
  item: InventoryItem;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onTransfer?: () => void;
  onAdjust?: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showSelection?: boolean;
}

export function MobileInventoryCard({
  item,
  isSelected = false,
  onSelect,
  onTransfer,
  onAdjust,
  onView,
  onEdit,
  onDelete,
  showSelection = false
}: MobileInventoryCardProps) {
  const stockLevel = item.current_stock || 0;
  const isLowStock = stockLevel <= item.reorder_point;
  const stockStatus = isLowStock ? 'warning' : 'success';

  return (
    <Card className={`relative transition-all duration-200 ${isSelected ? 'ring-2 ring-primary' : ''}`}>
      <CardContent className="p-4">
        {/* Header with selection and actions */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {showSelection && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={onSelect}
                className="mt-0.5"
              />
            )}
            <div className="flex items-center gap-2 min-w-0">
              <div className={`p-2 rounded-lg ${item.is_active ? 'bg-green-50' : 'bg-gray-50'}`}>
                <Package className={`h-4 w-4 ${item.is_active ? 'text-green-600' : 'text-gray-400'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm truncate">{item.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {item.sku}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{item.unit}</span>
                </div>
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onView && (
                <DropdownMenuItem onClick={onView}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Item
                </DropdownMenuItem>
              )}
              {onTransfer && (
                <DropdownMenuItem onClick={onTransfer}>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Transfer Stock
                </DropdownMenuItem>
              )}
              {onAdjust && (
                <DropdownMenuItem onClick={onAdjust}>
                  <Wrench className="h-4 w-4 mr-2" />
                  Adjust Stock
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Item
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Description */}
        {item.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="text-center p-2 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground">Current Stock</div>
            <div className={`text-sm font-medium ${isLowStock ? 'text-orange-600' : 'text-foreground'}`}>
              {stockLevel}
              {isLowStock && <AlertTriangle className="h-3 w-3 inline ml-1" />}
            </div>
          </div>
          <div className="text-center p-2 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground">Cost</div>
            <div className="text-sm font-medium">£{item.default_cost}</div>
          </div>
        </div>

        {/* Stock levels bar */}
        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Min: {item.min_level}</span>
            <span>Reorder: {item.reorder_point}</span>
            <span>Max: {item.max_level}</span>
          </div>
          <div className="w-full bg-muted/50 rounded-full h-1.5">
            <div 
              className={`h-1.5 rounded-full transition-all ${
                isLowStock ? 'bg-orange-400' : 'bg-green-400'
              }`}
              style={{ 
                width: `${Math.min((stockLevel / item.max_level) * 100, 100)}%` 
              }}
            />
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusChip status={item.is_active ? "active" : "inactive"}>
              {item.is_active ? "Active" : "Inactive"}
            </StatusChip>
            {item.is_serialized && (
              <Badge variant="outline" className="text-xs">
                Serial
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {isLowStock ? (
              <div className="flex items-center gap-1 text-orange-600">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-xs">Low</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle className="h-3 w-3" />
                <span className="text-xs">OK</span>
              </div>
            )}
          </div>
        </div>

        {/* Supplier info */}
        {item.supplier_name && (
          <div className="mt-2 pt-2 border-t border-muted/50">
            <div className="text-xs text-muted-foreground">
              Supplier: {item.supplier_name}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}