import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Settings, Trash2, Edit, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddChargerModelModal } from './AddChargerModelModal';
import { EditChargerModelModal } from './EditChargerModelModal';
import { BulkImportChargerModelsModal } from './BulkImportChargerModelsModal';

interface ChargerModel {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  default_cost: number;
  reorder_point: number;
  supplier_name: string | null;
  is_active: boolean;
  units_count: number;
  available_units: number;
  assigned_units: number;
  created_at: string;
}

export function ChargerModelsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ChargerModel | null>(null);

  const { data: chargerModels = [], isLoading, error: queryError } = useQuery({
    queryKey: ['charger-models'],
    queryFn: async () => {
      console.log('Fetching charger models...');
      const { data: models, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('is_charger', true)
        .order('name');

      console.log('Charger models query result:', { models, error });

      if (error) {
        console.error('Error fetching charger models:', error);
        throw error;
      }

      console.log(`Found ${models?.length || 0} charger models`);

      // Get unit counts for each model
      const modelsWithCounts = await Promise.all(
        (models || []).map(async (model) => {
          console.log('Processing model:', model.name);
          const { data: units } = await supabase
            .from('charger_inventory')
            .select('id, status')
            .eq('charger_item_id', model.id);

          console.log(`Model ${model.name} has ${units?.length || 0} units`);

          const unitsCount = units?.length || 0;
          const availableUnits = units?.filter(u => u.status === 'available').length || 0;
          const assignedUnits = units?.filter(u => u.status === 'assigned').length || 0;

          return {
            id: model.id,
            name: model.name,
            sku: model.sku,
            description: model.description,
            default_cost: model.default_cost,
            reorder_point: model.reorder_point,
            supplier_name: null, // Will be null for now since all supplier_id are null
            is_active: model.is_active,
            units_count: unitsCount,
            available_units: availableUnits,
            assigned_units: assignedUnits,
            created_at: model.created_at
          };
        })
      );

      console.log('Final models with counts:', modelsWithCounts);
      return modelsWithCounts;
    },
    staleTime: 0, // Force fresh data
    gcTime: 0 // Don't cache (was cacheTime in older versions)
  });

  console.log('ChargerModelsTab render:', { chargerModels, isLoading, queryError });

  const deleteModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      // Check if model has any units
      const { data: units } = await supabase
        .from('charger_inventory')
        .select('id')
        .eq('charger_item_id', modelId);

      if (units && units.length > 0) {
        throw new Error('Cannot delete model with existing units. Remove all units first.');
      }

      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', modelId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Charger model deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["charger-models"] });
      queryClient.invalidateQueries({ queryKey: ["charger-items"] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete charger model",
      });
    }
  });

  const filteredModels = (chargerModels || []).filter(model =>
    model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    model.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (model.description && model.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleEditModel = (model: ChargerModel) => {
    setSelectedModel(model);
    setShowEditModal(true);
  };

  const handleDeleteModel = (modelId: string) => {
    if (confirm('Are you sure you want to delete this charger model? This action cannot be undone.')) {
      deleteModelMutation.mutate(modelId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h2 className="text-2xl font-bold">Charger Models</h2>
          <p className="text-muted-foreground">Manage charger model definitions and specifications</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowBulkImportModal(true)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            Bulk Import
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Model
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 max-w-md">
        <Search className="w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search models..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Models Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Charger Models ({filteredModels.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading charger models...</div>
          ) : filteredModels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No models match your search' : 'No charger models found'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModels.map((model) => (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell className="font-mono text-sm">{model.sku}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {model.description || '-'}
                      </TableCell>
                      <TableCell>£{model.default_cost.toFixed(2)}</TableCell>
                      <TableCell>{model.supplier_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{model.units_count}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-green-600">
                          {model.available_units}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-blue-600">
                          {model.assigned_units}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={model.is_active ? "default" : "secondary"}>
                          {model.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditModel(model)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteModel(model.id)}
                            disabled={model.units_count > 0}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AddChargerModelModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />
      
      {selectedModel && (
        <EditChargerModelModal
          open={showEditModal}
          onOpenChange={setShowEditModal}
          model={selectedModel}
        />
      )}
      
      <BulkImportChargerModelsModal
        open={showBulkImportModal}
        onOpenChange={setShowBulkImportModal}
      />
    </div>
  );
}