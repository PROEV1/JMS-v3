import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkImportChargerModelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CSV_TEMPLATE = `Name,Model,Power Rating,Connector Type,Description,Unit Cost,Reorder Point
Tesla Wall Connector Gen 3,Generation 3,22kW,Type 2,Tesla Wall Connector with Wi-Fi connectivity,450.00,1
myenergi Zappi V2,V2.1,7.4kW,Type 2,Smart EV charger with solar integration,899.00,2
Ohme Home Pro,Home Pro,7.4kW,Type 2,Smart charger with dynamic pricing,649.00,1`;

export function BulkImportChargerModelsModal({ open, onOpenChange }: BulkImportChargerModelsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [csvData, setCsvData] = useState('');
  const [preview, setPreview] = useState<any[]>([]);

  const parseCSV = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, {} as any);
    });

    return rows;
  };

  const handleCSVChange = (value: string) => {
    setCsvData(value);
    try {
      const parsed = parseCSV(value);
      setPreview(parsed.slice(0, 5)); // Show first 5 rows as preview
    } catch (error) {
      setPreview([]);
    }
  };

  const bulkImportMutation = useMutation({
    mutationFn: async (csvText: string) => {
      const rows = parseCSV(csvText);
      if (rows.length === 0) {
        throw new Error('No valid data found in CSV');
      }

      const results = [];
      const errors = [];

      for (const row of rows) {
        try {
          // Build description with charger-specific details
          const description = [
            row.Description?.trim(),
            row.Model ? `Model: ${row.Model}` : null,
            row['Power Rating'] ? `Power: ${row['Power Rating']}` : null,
            row['Connector Type'] ? `Connector: ${row['Connector Type']}` : null
          ].filter(Boolean).join(' | ');

          const payload = {
            name: row.Name?.trim(),
            sku: `CHARGER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            description: description || null,
            unit: 'each',
            default_cost: parseFloat(row['Unit Cost']) || 0,
            min_level: 0,
            max_level: 0,
            reorder_point: parseInt(row['Reorder Point']) || 1,
            is_serialized: true,
            is_charger: true,
            is_active: true,
            supplier_id: null
          };

          if (!payload.name) {
            errors.push(`Row ${results.length + errors.length + 1}: Name is required`);
            continue;
          }

          const { data, error } = await supabase
            .from('inventory_items')
            .insert([payload])
            .select()
            .single();

          if (error) throw error;
          results.push(data);
        } catch (error: any) {
          errors.push(`Row ${results.length + errors.length + 1}: ${error.message}`);
        }
      }

      return { results, errors };
    },
    onSuccess: ({ results, errors }) => {
      const successCount = results.length;
      const errorCount = errors.length;

      if (successCount > 0) {
        toast({
          title: "Import Complete",
          description: `Successfully imported ${successCount} charger models${errorCount > 0 ? ` (${errorCount} errors)` : ''}`,
        });
      }

      if (errorCount > 0) {
        console.error('Import errors:', errors);
        toast({
          variant: "destructive",
          title: "Some imports failed",
          description: `${errorCount} rows had errors. Check console for details.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["charger-models"] });
      queryClient.invalidateQueries({ queryKey: ["charger-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      
      if (successCount > 0) {
        onOpenChange(false);
        setCsvData('');
        setPreview([]);
      }
    },
    onError: (error: any) => {
      console.error('Error importing charger models:', error);
      toast({
        variant: "destructive",
        title: "Import Failed",
        description: error.message || "Failed to import charger models",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!csvData.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter CSV data",
      });
      return;
    }

    bulkImportMutation.mutate(csvData);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'charger-models-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Bulk Import Charger Models
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              Import multiple charger models using CSV format. Download the template below to get started.
            </AlertDescription>
          </Alert>

          <Button
            type="button"
            variant="outline"
            onClick={downloadTemplate}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download CSV Template
          </Button>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv_data">CSV Data</Label>
              <Textarea
                id="csv_data"
                value={csvData}
                onChange={(e) => handleCSVChange(e.target.value)}
                placeholder="Paste your CSV data here..."
                className="min-h-[200px] font-mono text-sm"
                required
              />
            </div>

            {preview.length > 0 && (
              <div className="space-y-2">
                <Label>Preview (First 5 rows)</Label>
                <div className="border rounded p-3 bg-muted/50 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Model</th>
                        <th className="text-left p-2">Power</th>
                        <th className="text-left p-2">Connector</th>
                        <th className="text-left p-2">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2">{row.Name}</td>
                          <td className="p-2">{row.Model}</td>
                          <td className="p-2">{row['Power Rating']}</td>
                          <td className="p-2">{row['Connector Type']}</td>
                          <td className="p-2">£{row['Unit Cost']}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  onOpenChange(false);
                  setCsvData('');
                  setPreview([]);
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={bulkImportMutation.isPending || !csvData.trim()}
              >
                {bulkImportMutation.isPending ? "Importing..." : "Import Models"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}