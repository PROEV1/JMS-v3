import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface EngineerCsvImportProps {
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
  onImportComplete: () => void;
}

export function EngineerCsvImport({ open, onOpenChange, onImportComplete }: EngineerCsvImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);
  const [updateExistingRoles, setUpdateExistingRoles] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setImportResults(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No File Selected",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('updateExistingRoles', updateExistingRoles.toString());

      const { data, error } = await supabase.functions.invoke('import-engineers', {
        body: formData,
      });

      if (error) throw error;

      setImportResults(data);
      
      toast({
        title: "Import Completed",
        description: `Successfully processed ${data.totalProcessed} engineers. ${data.created} created, ${data.updated} updated, ${data.skipped} skipped.`,
      });

      if (data.created > 0 || data.updated > 0) {
        onImportComplete();
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import engineers",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setImportResults(null);
    setUpdateExistingRoles(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Engineers from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p><strong>CSV Format Requirements:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Headers: name, email, region, starting_postcode (optional), availability (optional)</li>
                  <li>Example: "John Smith,john@example.com,North,M1 1AA,true"</li>
                  <li>Availability can be "true", "false", "1", "0", or empty (defaults to true)</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  <a href="/engineer_import_template.csv" download className="text-blue-600 hover:underline">
                    Download CSV template
                  </a>
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="mt-2"
            />
            {file && (
              <p className="text-sm text-muted-foreground mt-1">
                Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="update-existing-roles"
              checked={updateExistingRoles}
              onChange={(e) => setUpdateExistingRoles(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="update-existing-roles" className="text-sm">
              Update profile role to engineer for existing users
            </Label>
          </div>

          {updateExistingRoles && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This will update the role to 'engineer' for any existing users 
                found in the profiles table who match the email addresses in your CSV. 
                This action cannot be undone automatically.
              </AlertDescription>
            </Alert>
          )}

          {importResults && (
            <Alert className={importResults.errors?.length > 0 ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p><strong>Import Results:</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>{importResults.totalProcessed} engineers processed</li>
                    <li>{importResults.created} new engineers created</li>
                    <li>{importResults.updated} engineers updated</li>
                    <li>{importResults.skipped} engineers skipped (duplicates)</li>
                    {importResults.rolesUpdated > 0 && (
                      <li>{importResults.rolesUpdated} user profiles updated to engineer role</li>
                    )}
                  </ul>
                  
                  {importResults.errors && importResults.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium text-yellow-800">Warnings:</p>
                      <ul className="list-disc list-inside space-y-1 text-sm text-yellow-700">
                        {importResults.errors.map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              {importResults ? 'Close' : 'Cancel'}
            </Button>
            {!importResults && (
              <Button 
                onClick={handleImport} 
                disabled={!file || importing}
              >
                <Upload className="h-4 w-4 mr-2" />
                {importing ? 'Importing...' : 'Import Engineers'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
