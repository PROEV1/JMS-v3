
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Search, Boxes, AlertTriangle, BarChart3, Hash, Trash2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { AddItemModal } from './AddItemModal';
import { StockAdjustmentModal } from './StockAdjustmentModal';
import { StockTransferModal } from './StockTransferModal';
import { ItemQuickViewDialog } from './ItemQuickViewDialog';
import { LocationInventoryModal } from './LocationInventoryModal';
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';
import { AdvancedSearchModal } from './shared/AdvancedSearchModal';
import { BulkActionsBar, inventoryBulkActions } from './shared/BulkActionsBar';
import { InventoryViewSwitcher, useInventoryView, ViewMode } from './shared/InventoryViewSwitcher';
import { MobileInventoryCard } from './shared/MobileInventoryCard';
import { NotificationBanner, createStockNotification } from './shared/NotificationBanner';
import { useInventoryEnhanced } from '@/hooks/useInventoryEnhanced';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LowStockDetailsTable } from './LowStockDetailsTable';

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
  supplier_id?: string;
  is_serialized: boolean;
  is_charger: boolean;
}

interface InventoryItemsSimpleProps {
  onSwitchTab?: (tab: string) => void;
}

export const InventoryItemsSimple: React.FC<InventoryItemsSimpleProps> = ({ onSwitchTab }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchFilters, setSearchFilters] = useState({});
  const [viewMode, setViewMode] = useInventoryView('list', 'inventory-items-view');
  
  // Modal states for actions
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showQuickView, setShowQuickView] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLocationInventory, setShowLocationInventory] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);

  const { deleteInventoryItem } = useInventoryEnhanced();

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as InventoryItem[];
    }
  });

  // Header metrics
  const { data: metrics } = useQuery({
    queryKey: ['inventory-items-metrics'],
    queryFn: async () => {
      if (!items) return null;
      
      const totalSKUs = items.length;
      const activeItems = items.filter(item => item.is_active).length;
      const lowStockItems = items.filter(item => item.reorder_point > 0).length; // Simplified
      const serializedItems = items.filter(item => item.is_serialized).length;
      
      return { totalSKUs, activeItems, lowStockItems, serializedItems };
    },
    enabled: !!items
  });

  // Enhanced filtering with advanced search
  const filteredItems = items?.filter(item => {
    // Basic search
    const matchesSearch = !searchTerm || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Advanced filters
    const matchesFilters = Object.entries(searchFilters).every(([key, value]) => {
      if (!value || value === 'all' || value === '') return true;
      
      switch (key) {
        case 'name':
          return item.name.toLowerCase().includes((value as string).toLowerCase());
        case 'sku':
          return item.sku.toLowerCase().includes((value as string).toLowerCase());
        case 'stockLevel':
          const stockLevel = 50; // Mock stock level
          if (value === 'low') return stockLevel <= item.reorder_point;
          if (value === 'normal') return stockLevel > item.reorder_point && stockLevel < item.max_level * 0.8;
          if (value === 'high') return stockLevel >= item.max_level * 0.8;
          return true;
        case 'isActive':
          return item.is_active === value;
        case 'isSerialized':
          return item.is_serialized === value;
        case 'costRange':
          const [min, max] = value as [number, number];
          return item.default_cost >= min && item.default_cost <= max;
        default:
          return true;
      }
    });
    
    return matchesSearch && matchesFilters;
  });

  // Mock notifications for low stock items
  const notifications = items?.filter(item => 50 <= item.reorder_point).map(item => 
    createStockNotification(item.name, 50, item.reorder_point)
  ) || [];

  const handleSelectAll = () => {
    setSelectedIds(filteredItems?.map(item => item.id) || []);
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleItemSelect = (itemId: string, selected: boolean) => {
    setSelectedIds(prev => 
      selected 
        ? [...prev, itemId]
        : prev.filter(id => id !== itemId)
    );
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    
    try {
      await deleteInventoryItem.mutateAsync(selectedItem.id);
      setShowDeleteDialog(false);
      setSelectedItem(null);
    } catch (error: any) {
      console.error('Delete failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading items...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <NotificationBanner 
          notifications={notifications}
          onDismiss={(id) => console.log('Dismiss:', id)}
          maxDisplay={2}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Inventory Items</h2>
          <p className="text-muted-foreground">Manage your inventory items and stock levels</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Header Metrics */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-4">
          <InventoryKpiTile
            title="Total SKUs"
            value={metrics.totalSKUs}
            icon={Hash}
            variant="info"
            subtitle="All inventory items"
          />
          <InventoryKpiTile
            title="Active"
            value={metrics.activeItems}
            icon={Boxes}
            variant="success"
            subtitle="Currently in use"
          />
          <InventoryKpiTile
            title="Low Stock"
            value={metrics.lowStockItems}
            icon={AlertTriangle}
            variant={metrics.lowStockItems > 0 ? "warning" : "success"}
            subtitle="Need reordering"
            onClick={() => onSwitchTab?.('locations')}
          />
          <InventoryKpiTile
            title="Serialized"
            value={metrics.serializedItems}
            icon={BarChart3}
            variant="neutral"
            subtitle="Track by serial"
          />
        </div>
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedIds}
        totalCount={filteredItems?.length || 0}
        onClearSelection={handleClearSelection}
        onSelectAll={handleSelectAll}
        actions={inventoryBulkActions}
      />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <AdvancedSearchModal
            filters={searchFilters}
            onFiltersChange={setSearchFilters}
            onClear={() => setSearchFilters({})}
          />
        </div>
        
        <InventoryViewSwitcher
          currentView={viewMode}
          onViewChange={setViewMode}
          itemCount={filteredItems?.length}
        />
      </div>

      {/* Items Display */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems?.map((item) => (
            <div key={item.id} className="hidden md:block">
              <Card className={`hover:shadow-md transition-shadow ${selectedIds.includes(item.id) ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.sku}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.unit}
                        </span>
                      </div>
                    </div>
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost:</span>
                      <span className="font-medium">£{item.default_cost}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min/Max:</span>
                      <span>{item.min_level}/{item.max_level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reorder:</span>
                      <span>{item.reorder_point}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <StatusChip status={item.is_active ? "active" : "inactive"}>
                      {item.is_active ? "Active" : "Inactive"}
                    </StatusChip>
                    {item.is_serialized && (
                      <Badge variant="outline" className="text-xs">
                        Serialized
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-1 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7 px-2"
                      onClick={() => {
                        setSelectedItem(item);
                        setShowLocationInventory(true);
                      }}
                      title="Manage locations"
                    >
                      <MapPin className="h-3 w-3 mr-1" />
                      Locations
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7 px-2"
                      onClick={() => {
                        setSelectedItem(item);
                        setShowQuickView(true);
                      }}
                    >
                      View
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7 px-2"
                      onClick={() => {
                        setEditItem(item);
                        setShowAddModal(true);
                      }}
                      title="Edit item"
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => {
                        setSelectedItem(item);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Mobile Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {filteredItems?.map((item) => (
            <MobileInventoryCard
              key={item.id}
              item={{
                ...item,
                current_stock: 50, // Mock stock level
                supplier_name: 'Supplier A' // Mock supplier
              }}
              isSelected={selectedIds.includes(item.id)}
              onSelect={(selected) => handleItemSelect(item.id, selected)}
              showSelection={true}
              onTransfer={() => {
                setSelectedItem(item);
                setShowTransferModal(true);
              }}
              onAdjust={() => {
                setSelectedItem(item);
                setShowAdjustModal(true);
              }}
              onView={() => {
                setSelectedItem(item);
                setShowQuickView(true);
              }}
              onEdit={() => {
                setEditItem(item);
                setShowAddModal(true);
              }}
              onDelete={() => {
                setSelectedItem(item);
                setShowDeleteDialog(true);
              }}
            />
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-2">
          {filteredItems?.map((item) => (
            <Card key={item.id} className={`hover:shadow-sm transition-shadow ${selectedIds.includes(item.id) ? 'ring-2 ring-primary' : ''}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <Package className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-sm truncate">{item.name}</h3>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {item.sku}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Unit: {item.unit}</span>
                        <span>Cost: £{item.default_cost}</span>
                        <span>Min: {item.min_level}</span>
                        <span>Max: {item.max_level}</span>
                        <span>Reorder: {item.reorder_point}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <StatusChip status={item.is_active ? "active" : "inactive"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </StatusChip>
                      {item.is_serialized && (
                        <Badge variant="outline" className="text-xs">
                          Serialized
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowLocationInventory(true);
                        }}
                        title="Manage Locations"
                      >
                        <MapPin className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowQuickView(true);
                        }}
                        title="View Details"
                      >
                        <span className="text-xs">View</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setEditItem(item);
                          setShowAddModal(true);
                        }}
                        title="Edit Item"
                      >
                        <span className="text-xs">Edit</span>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowDeleteDialog(true);
                        }}
                        title="Delete Item"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-4 font-medium text-sm">Item</th>
                    <th className="text-left p-4 font-medium text-sm">SKU</th>
                    <th className="text-left p-4 font-medium text-sm">Cost</th>
                    <th className="text-left p-4 font-medium text-sm">Stock Levels</th>
                    <th className="text-left p-4 font-medium text-sm">Status</th>
                    <th className="text-right p-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems?.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/25">
                      <td className="p-4">
                        <div>
                          <div className="font-medium text-sm">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-xs">
                          {item.sku}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">
                        £{item.default_cost}
                        <div className="text-xs text-muted-foreground">{item.unit}</div>
                      </td>
                      <td className="p-4 text-sm">
                        <div className="space-y-1">
                          <div>Min: {item.min_level} | Max: {item.max_level}</div>
                          <div className="text-xs text-muted-foreground">Reorder: {item.reorder_point}</div>
                        </div>
                      </td>
                      <td className="p-4">
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
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-xs"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowLocationInventory(true);
                            }}
                            title="Manage Locations"
                          >
                            <MapPin className="h-4 w-4 mr-1" />
                            Locations
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-xs"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowQuickView(true);
                            }}
                          >
                            View
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-2 text-xs"
                            onClick={() => {
                              setEditItem(item);
                              setShowAddModal(true);
                            }}
                            title="Edit Item"
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            onClick={() => {
                              setSelectedItem(item);
                              setShowDeleteDialog(true);
                            }}
                            title="Delete Item"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredItems?.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No items found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "Try adjusting your search terms" : "Get started by adding your first inventory item"}
            </p>
            {!searchTerm && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Item
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Low Stock Engineer Details Table */}
      <LowStockDetailsTable className="mt-6" />

      <AddItemModal
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) {
            setEditItem(null);
          }
        }}
        editItem={editItem as any}
      />
      
      <StockAdjustmentModal
        open={showAdjustModal}
        onOpenChange={setShowAdjustModal}
        itemId={selectedItem?.id}
        itemName={selectedItem?.name}
      />
      
      <StockTransferModal
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
        itemId={selectedItem?.id}
        itemName={selectedItem?.name}
      />
      
      <ItemQuickViewDialog
        open={showQuickView}
        onOpenChange={setShowQuickView}
        item={selectedItem}
      />
      
      <LocationInventoryModal
        open={showLocationInventory}
        onOpenChange={setShowLocationInventory}
        itemId={selectedItem?.id}
        itemName={selectedItem?.name}
      />
      
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedItem?.name}"?
              {selectedItem && (
                <div className="mt-2 text-sm">
                  This action cannot be undone. If this item has transaction history, 
                  it will be archived instead of permanently deleted.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteItem}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteInventoryItem.isPending}
            >
              {deleteInventoryItem.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
