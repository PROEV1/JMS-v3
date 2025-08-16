import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { Upload, Download, AlertCircle, CheckCircle, X } from 'lucide-react';

interface CsvRow {
  email: string;
  full_name?: string;
  region?: string;
  availability?: boolean;
  starting_postcode?: string;
  mon_available?: boolean;
  mon_start?: string;
  mon_end?: string;
  tue_available?: boolean;
  tue_start?: string;
  tue_end?: string;
  wed_available?: boolean;
  wed_start?: string;
  wed_end?: string;
  thu_available?: boolean;
  thu_start?: string;
  thu_end?: string;
  fri_available?: boolean;
  fri_start?: string;
  fri_end?: string;
  sat_available?: boolean;
  sat_start?: string;
  sat_end?: string;
  sun_available?: boolean;
  sun_start?: string;
  sun_end?: string;
  service_areas?: string;
  max_travel_minutes?: number;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface ImportResult {
  success: boolean;
  summary: {
    processed: number;
    created_users: number;
    created_engineers: number;
    updated_engineers: number;
    availability_upserts: number;
    service_area_upserts: number;
    errors: Array<{ row: number; error: string; email?: string }>;
  };
}

export function EngineerCsvImport({ open, onOpenChange, onImportComplete }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [createMissingUsers, setCreateMissingUsers] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const { toast } = useToast();

  const csvTemplate = `email,full_name,region,availability,starting_postcode,mon_available,mon_start,mon_end,tue_available,tue_start,tue_end,wed_available,wed_start,wed_end,thu_available,thu_start,thu_end,fri_available,fri_start,fri_end,sat_available,sat_start,sat_end,sun_available,sun_start,sun_end,service_areas,max_travel_minutes
john.doe@example.com,John Doe,London,true,SW1A 1AA,true,09:00,17:00,true,09:00,17:00,true,09:00,17:00,true,09:00,17:00,true,09:00,17:00,false,,,false,,,SW1|SW2|SW3,60
jane.smith@example.com,Jane Smith,Manchester,true,M1 1AA,true,08:00,16:00,true,08:00,16:00,true,08:00,16:00,true,08:00,16:00,true,08:00,16:00,true,10:00,14:00,false,,,M1|M2|M3,45`;

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'engineer_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      transform: (value, header) => {
        if (!value || value.trim() === '') return undefined;
        
        const headerStr = String(header);
        
        // Convert boolean fields
        if (headerStr.includes('available') || headerStr === 'availability') {
          return value.toLowerCase() === 'true' || value === '1';
        }
        
        // Convert number fields
        if (headerStr === 'max_travel_minutes') {
          const num = parseInt(value);
          return isNaN(num) ? undefined : num;
        }
        
        return value.trim();
      },
      complete: (results) => {
        const data = results.data as CsvRow[];
        setCsvData(data);
        
        // Validate data
        const errors: string[] = [];
        data.forEach((row, index) => {
          if (!row.email) {
            errors.push(`Row ${index + 1}: Email is required`);
          }
          
          // Validate time formats
          const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
          days.forEach(day => {
            const availableKey = `${day}_available` as keyof CsvRow;
            const startKey = `${day}_start` as keyof CsvRow;
            const endKey = `${day}_end` as keyof CsvRow;
            
            if (row[availableKey] && row[startKey] && row[endKey]) {
              const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
              if (!timeRegex.test(row[startKey] as string)) {
                errors.push(`Row ${index + 1}: Invalid ${day}_start time format (use HH:MM)`);
              }
              if (!timeRegex.test(row[endKey] as string)) {
                errors.push(`Row ${index + 1}: Invalid ${day}_end time format (use HH:MM)`);
              }
            }
          });
        });
        
        setValidationErrors(errors);
      },
      error: (error) => {
        toast({
          title: "CSV Parse Error",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleImport = async () => {
    if (!csvData.length) {
      toast({
        title: "No Data",
        description: "Please select and parse a CSV file first",
        variant: "destructive",
      });
      return;
    }

    if (validationErrors.length > 0) {
      toast({
        title: "Validation Errors",
        description: "Please fix validation errors before importing",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const progressInterval = setInterval(() => {
        setImportProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const { data, error } = await supabase.functions.invoke('import-engineers', {
        body: {
          rows: csvData,
          create_missing_users: createMissingUsers
        }
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      if (error) {
        throw new Error(error.message);
      }

      setImportResult(data);
      
      if (data.success) {
        toast({
          title: "Import Completed",
          description: `Successfully processed ${data.summary.processed} engineers`,
        });
        onImportComplete();
      } else {
        toast({
          title: "Import Failed",
          description: "Check the results for details",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setCsvData([]);
    setValidationErrors([]);
    setImportResult(null);
    setImportProgress(0);
    setIsImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Engineers from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to import engineer data, schedules, and service areas into the system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <h3 className="font-medium">CSV Template</h3>
              <p className="text-sm text-muted-foreground">
                Download the template to see the required format and example data
              </p>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isImporting}
            />
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="create-users"
              checked={createMissingUsers}
              onCheckedChange={(checked) => setCreateMissingUsers(!!checked)}
              disabled={isImporting}
            />
            <Label htmlFor="create-users">
              Create user accounts for engineers that don't have one
            </Label>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Validation Errors:</p>
                  {validationErrors.slice(0, 5).map((error, index) => (
                    <p key={index} className="text-sm">{error}</p>
                  ))}
                  {validationErrors.length > 5 && (
                    <p className="text-sm">...and {validationErrors.length - 5} more errors</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Data Preview */}
          {csvData.length > 0 && validationErrors.length === 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Data Preview ({csvData.length} rows)</h3>
              <div className="border rounded-lg max-h-60 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Postcode</TableHead>
                      <TableHead>Service Areas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 5).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">{row.email}</TableCell>
                        <TableCell>{row.full_name || 'N/A'}</TableCell>
                        <TableCell>{row.region || 'N/A'}</TableCell>
                        <TableCell>{row.starting_postcode || 'N/A'}</TableCell>
                        <TableCell>{row.service_areas || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {csvData.length > 5 && (
                  <div className="p-2 text-center text-sm text-muted-foreground border-t">
                    ...and {csvData.length - 5} more rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import Progress */}
          {isImporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Importing engineers...</span>
                <span className="text-sm">{importProgress}%</span>
              </div>
              <Progress value={importProgress} className="w-full" />
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                {importResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <X className="h-5 w-5 text-red-600" />
                )}
                <h3 className="font-medium">
                  Import {importResult.success ? 'Completed' : 'Failed'}
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold">{importResult.summary.processed}</div>
                  <div className="text-sm text-muted-foreground">Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.summary.created_users}</div>
                  <div className="text-sm text-muted-foreground">Users Created</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{importResult.summary.created_engineers}</div>
                  <div className="text-sm text-muted-foreground">Engineers Created</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{importResult.summary.updated_engineers}</div>
                  <div className="text-sm text-muted-foreground">Engineers Updated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{importResult.summary.availability_upserts}</div>
                  <div className="text-sm text-muted-foreground">Schedule Updates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-600">{importResult.summary.service_area_upserts}</div>
                  <div className="text-sm text-muted-foreground">Service Areas</div>
                </div>
              </div>

              {importResult.summary.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p className="font-medium">{importResult.summary.errors.length} Errors:</p>
                      {importResult.summary.errors.slice(0, 5).map((error, index) => (
                        <p key={index} className="text-sm">
                          Row {error.row}: {error.error} {error.email && `(${error.email})`}
                        </p>
                      ))}
                      {importResult.summary.errors.length > 5 && (
                        <p className="text-sm">...and {importResult.summary.errors.length - 5} more errors</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={resetImport} disabled={isImporting}>
              Reset
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!csvData.length || validationErrors.length > 0 || isImporting}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? 'Importing...' : 'Import Engineers'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}