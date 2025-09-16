import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Package, Zap, Trash2, Calendar, MapPin, FileText, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Material {
  id: string;
  item_name: string;
  quantity: number;
  serial_number: string | null;
  notes: string | null;
  used_at: string;
  location_id: string | null;
  item_id: string | null;
  charger_inventory_id: string | null;
  inventory_items: {
    name: string;
    sku: string;
    is_charger: boolean;
  } | null;
  inventory_locations: {
    name: string;
    code: string;
  } | null;
}

interface EngineerMaterialsSectionProps {
  orderId: string;
  engineerId?: string | null;
  onUpdate?: () => void;
}

export function EngineerMaterialsSection({ orderId, engineerId, onUpdate }: EngineerMaterialsSectionProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [chargers, setChargers] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (orderId) {
      fetchMaterialsAndChargers();
    }
  }, [orderId]);

  const fetchMaterialsAndChargers = async () => {
    try {
      setLoading(true);
      
      // Fetch all materials used (including chargers)
      const { data, error } = await supabase
        .from('engineer_materials_used')
        .select(`
          *,
          inventory_items(name, sku, is_charger),
          inventory_locations(name, code)
        `)
        .eq('order_id', orderId)
        .order('used_at', { ascending: false });

      if (error) throw error;

      // Separate materials and chargers
      const allMaterials = data || [];
      const materialsList = allMaterials.filter(item => 
        !item.serial_number || 
        (item.inventory_items && !item.inventory_items.is_charger)
      );
      const chargersList = allMaterials.filter(item => 
        item.serial_number && 
        (!item.inventory_items || item.inventory_items.is_charger || item.item_name.toLowerCase().includes('charger'))
      );

      setMaterials(materialsList);
      setChargers(chargersList);
    } catch (error) {
      console.error('Error fetching materials and chargers:', error);
      toast({
        title: "Error",
        description: "Failed to load materials and chargers used",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    try {
      setDeleting(materialId);
      
      const { error } = await supabase.rpc('revoke_material_usage', {
        p_usage_id: materialId,
        p_restore_stock: false // Admin deletion doesn't restore stock by default
      });

      if (error) throw error;

      toast({
        title: "Material Removed",
        description: "Material usage record has been deleted",
      });

      fetchMaterialsAndChargers();
      onUpdate?.();
    } catch (error) {
      console.error('Error deleting material:', error);
      toast({
        title: "Error",
        description: "Failed to remove material usage record",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'PPp');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Materials & Equipment Used
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = materials.length > 0 || chargers.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Materials & Equipment Used
        </CardTitle>
        {hasData && (
          <p className="text-sm text-muted-foreground">
            Complete log of materials and chargers used by the engineer on this installation
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {!hasData ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">No Materials Recorded</h3>
            <p className="text-sm text-muted-foreground">
              No materials or equipment have been logged for this job yet.
            </p>
          </div>
        ) : (
          <>
            {/* Chargers Section */}
            {chargers.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Zap className="h-4 w-4 text-primary" />
                  <h3 className="font-medium">Chargers Used ({chargers.length})</h3>
                </div>
                <div className="space-y-3">
                  {chargers.map((charger) => (
                    <div key={charger.id} className="flex items-start justify-between p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <Zap className="h-5 w-5 text-primary mt-0.5" />
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{charger.item_name}</h4>
                              {charger.serial_number && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  S/N: {charger.serial_number}
                                </Badge>
                              )}
                            </div>
                            
                            {charger.inventory_items && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Package className="h-3 w-3" />
                                <span>{charger.inventory_items.name}</span>
                                {charger.inventory_items.sku && (
                                  <Badge variant="outline" className="text-xs">
                                    {charger.inventory_items.sku}
                                  </Badge>
                                )}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Used: {formatDateTime(charger.used_at)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                <span>Qty: {charger.quantity}</span>
                              </div>
                            </div>
                            
                            {charger.notes && (
                              <div className="flex items-start gap-1 text-sm">
                                <FileText className="h-3 w-3 mt-0.5 text-muted-foreground" />
                                <span className="text-muted-foreground">{charger.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deleting === charger.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Charger Usage</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove this charger usage record? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteMaterial(charger.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Materials Section */}
            {materials.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Package className="h-4 w-4 text-primary" />
                  <h3 className="font-medium">Materials Used ({materials.length})</h3>
                </div>
                <div className="space-y-3">
                  {materials.map((material) => (
                    <div key={material.id} className="flex items-start justify-between p-4 bg-muted/20 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{material.item_name}</h4>
                              <Badge variant="outline" className="text-xs">
                                Qty: {material.quantity}
                              </Badge>
                            </div>
                            
                            {material.inventory_items && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span>{material.inventory_items.name}</span>
                                {material.inventory_items.sku && (
                                  <Badge variant="outline" className="text-xs">
                                    {material.inventory_items.sku}
                                  </Badge>
                                )}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                <span>Used: {formatDateTime(material.used_at)}</span>
                              </div>
                              {material.inventory_locations && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>From: {material.inventory_locations.name}</span>
                                </div>
                              )}
                            </div>
                            
                            {material.serial_number && (
                              <div className="flex items-center gap-1 text-sm">
                                <Badge variant="secondary" className="font-mono text-xs">
                                  S/N: {material.serial_number}
                                </Badge>
                              </div>
                            )}
                            
                            {material.notes && (
                              <div className="flex items-start gap-1 text-sm">
                                <FileText className="h-3 w-3 mt-0.5 text-muted-foreground" />
                                <span className="text-muted-foreground">{material.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deleting === material.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Material Usage</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove this material usage record? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteMaterial(material.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        
        {hasData && (
          <div className="bg-muted/20 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Material Tracking Information</p>
                <p>This is a complete log of all materials and equipment used by the engineer on this installation. Records include timestamps, quantities, source locations, and any notes provided by the engineer.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}