import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Package, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SimpleMaterialsUsedProps {
  orderId: string;
  engineerId: string;
}

interface MaterialUsed {
  id: string;
  name: string;
  qty: number;
  serial?: string;
  notes?: string;
}

export function SimpleMaterialsUsed({ orderId, engineerId }: SimpleMaterialsUsedProps) {
  const { toast } = useToast();
  const [materials, setMaterials] = useState<MaterialUsed[]>([]);
  const [newMaterial, setNewMaterial] = useState({
    name: "",
    qty: 1,
    serial: "",
    notes: "",
  });

  const addMaterial = () => {
    if (!newMaterial.name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a material name",
        variant: "destructive",
      });
      return;
    }

    const material: MaterialUsed = {
      id: Date.now().toString(),
      name: newMaterial.name,
      qty: newMaterial.qty,
      serial: newMaterial.serial || undefined,
      notes: newMaterial.notes || undefined,
    };

    setMaterials(prev => [...prev, material]);
    setNewMaterial({ name: "", qty: 1, serial: "", notes: "" });

    toast({
      title: "Material Added",
      description: `${material.name} added to job materials list`,
    });
  };

  const removeMaterial = (id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Materials Used on Job
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Material Form */}
        <div className="border rounded-lg p-4 space-y-4">
          <h4 className="font-medium">Add Material</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="material-name">Material Name *</Label>
              <Input
                id="material-name"
                value={newMaterial.name}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., EV Charger, Cable (5m), Mounting Clips"
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={newMaterial.qty}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, qty: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="serial">Serial Number (if applicable)</Label>
              <Input
                id="serial"
                value={newMaterial.serial}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, serial: e.target.value }))}
                placeholder="Serial number for serialized items"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={newMaterial.notes}
                onChange={(e) => setNewMaterial(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <Button onClick={addMaterial}>
            <Plus className="h-4 w-4 mr-2" />
            Add Material
          </Button>
        </div>

        {/* Materials List */}
        {materials.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Materials Used:</h4>
            {materials.map((material) => (
              <div key={material.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium">{material.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Qty: {material.qty}
                    {material.serial && ` • Serial: ${material.serial}`}
                    {material.notes && ` • ${material.notes}`}
                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => removeMaterial(material.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Info Message */}
        <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            📋 <strong>Note:</strong> This is a simplified materials tracking system. 
            The full inventory management system will be available once the database types are regenerated. 
            For now, you can manually track materials used on this job.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}