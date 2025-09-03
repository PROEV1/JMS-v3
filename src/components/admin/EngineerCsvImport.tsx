import React, { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, AlertTriangle, CheckCircle, Info, Download } from 'lucide-react';

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
  const [createMissingUsers, setCreateMissingUsers] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
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
      
      // Parse CSV file
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        transform: (value, field) => {
          // Normalize boolean values
          if (typeof field === 'string' && (field.includes('available') || field === 'is_subcontractor' || field === 'ignore_working_hours')) {
            return value.toLowerCase() === 'true' || value === '1' || value.toLowerCase() === 'yes';
          }
          // Normalize numbers
          if (field === 'max_travel_minutes' || field === 'max_installs_per_day') {
            const num = parseInt(value, 10);
            return isNaN(num) ? undefined : num;
          }
          return value?.trim() || undefined;
        },
        complete: (results) => {
          if (results.errors.length > 0) {
            toast({
              title: "CSV Parse Warning",
              description: `Found ${results.errors.length} parsing issues. Check the data carefully.`,
              variant: "destructive",
            });
          }
          setCsvData(results.data as any[]);
          console.log('Parsed CSV data:', results.data);
        },
        error: (error) => {
          toast({
            title: "CSV Parse Error",
            description: error.message,
            variant: "destructive",
          });
        }
      });
    }
  };

  const handleImport = async () => {
    if (!file || csvData.length === 0) {
      toast({
        title: "No Data to Import",
        description: "Please select and parse a CSV file first",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    const invalidRows = csvData.filter((row, index) => {
      const email = row.email?.trim();
      if (!email) return true;
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return true;
      
      return false;
    });

    if (invalidRows.length > 0) {
      toast({
        title: "Invalid Data",
        description: `Found ${invalidRows.length} rows with missing or invalid email addresses`,
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-engineers', {
        body: {
          rows: csvData,
          create_missing_users: createMissingUsers,
          update_existing_roles: updateExistingRoles
        },
      });

      if (error) throw error;

      setImportResults(data);
      
      const { summary } = data;
      toast({
        title: "Import Completed",
        description: `Processed ${summary.processed} engineers. Created: ${summary.created_engineers}, Updated: ${summary.updated_engineers}, Errors: ${summary.errors.length}`,
      });

      if (summary.created_engineers > 0 || summary.updated_engineers > 0) {
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

  const downloadErrorsCsv = () => {
    if (!importResults?.summary?.errors) return;

    const csvContent = Papa.unparse([
      ['Row', 'Email', 'Error'],
      ...importResults.summary.errors.map((err: any) => [
        err.row,
        err.email || 'N/A',
        err.error
      ])
    ]);

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `engineer-import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setImportResults(null);
    setUpdateExistingRoles(false);
    setCreateMissingUsers(false);
    setCsvData([]);
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
                  <li><strong>Required:</strong> email, full_name</li>
                  <li><strong>Optional:</strong> region, starting_postcode, availability, service_areas, max_travel_minutes</li>
                  <li><strong>Subcontractor fields:</strong> is_subcontractor, ignore_working_hours, max_installs_per_day</li>
                  <li><strong>Daily schedule:</strong> mon_available, mon_start, mon_end (repeat for tue, wed, thu, fri, sat, sun)</li>
                  <li><strong>Availability values:</strong> TRUE/FALSE, 1/0, yes/no</li>
                  <li><strong>Time format:</strong> HH:MM (e.g., 08:00, 17:30)</li>
                  <li><strong>Service areas:</strong> Pipe or comma-separated (e.g., "SW1|E1|N1" or "SW1, E1, N1")</li>
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
              <div className="text-sm text-muted-foreground mt-1 space-y-1">
                <p>Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                {csvData.length > 0 && (
                  <p>Parsed {csvData.length} rows ready for import</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="create-missing-users"
                checked={createMissingUsers}
                onChange={(e) => setCreateMissingUsers(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="create-missing-users" className="text-sm">
                Create new users for engineers without existing accounts
              </Label>
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
          </div>

          {createMissingUsers && (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> New user accounts will be created for email addresses 
                that don't exist in the system. They'll receive an email to set their password.
              </AlertDescription>
            </Alert>
          )}

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
            <Alert className={importResults.summary?.errors?.length > 0 ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-4">
                  <p><strong>Import Results:</strong></p>
                  
                  <Tabs defaultValue="summary" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      <TabsTrigger value="errors" disabled={!importResults.summary?.errors?.length}>
                        Errors ({importResults.summary?.errors?.length || 0})
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="summary" className="space-y-2">
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>{importResults.summary.processed} engineers processed</li>
                        <li>{importResults.summary.created_engineers} new engineers created</li>
                        <li>{importResults.summary.updated_engineers} engineers updated</li>
                        <li>{importResults.summary.created_users} new users created</li>
                        <li>{importResults.summary.role_updates} user roles updated</li>
                        <li>{importResults.summary.availability_upserts} availability records updated</li>
                        <li>{importResults.summary.service_area_upserts} service areas updated</li>
                      </ul>
                    </TabsContent>
                    
                    <TabsContent value="errors" className="space-y-2">
                      {importResults.summary?.errors?.length > 0 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-red-800">Import Errors:</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={downloadErrorsCsv}
                              className="h-7"
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download CSV
                            </Button>
                          </div>
                          <div className="max-h-40 overflow-y-auto border rounded p-2 bg-white">
                            {importResults.summary.errors.map((error: any, index: number) => (
                              <div key={index} className="text-sm py-1 border-b last:border-b-0">
                                <span className="font-medium">Row {error.row}:</span> {error.error}
                                {error.email && <span className="text-muted-foreground"> ({error.email})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
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
                disabled={!file || importing || csvData.length === 0}
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
