
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Upload, Download, FileText, AlertTriangle, CheckCircle, XCircle, Users, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Papa from 'papaparse';

interface EngineerCsvImportProps {
  onImportComplete: () => void;
}

interface ImportSummary {
  processed: number;
  created_users: number;
  created_engineers: number;
  updated_engineers: number;
  availability_upserts: number;
  service_area_upserts: number;
  errors: Array<{ row: number; error: string; email?: string }>;
}

export function EngineerCsvImport({ onImportComplete }: EngineerCsvImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [createMissingUsers, setCreateMissingUsers] = useState(false);
  const [updateExistingRoles, setUpdateExistingRoles] = useState(false);
  const [importResult, setImportResult] = useState<ImportSummary | null>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/engineer_import_template.csv';
    link.download = 'engineer_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV file.",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const processImport = async () => {
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const fileText = await file.text();
      const parseResult = Papa.parse(fileText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_')
      });

      if (parseResult.errors.length > 0) {
        toast({
          title: "CSV Parse Error",
          description: `Error parsing CSV: ${parseResult.errors[0].message}`,
          variant: "destructive",
        });
        return;
      }

      console.log('Parsed CSV data:', parseResult.data);

      const { data, error } = await supabase.functions.invoke('import-engineers', {
        body: {
          rows: parseResult.data,
          create_missing_users: createMissingUsers,
          update_existing_roles: updateExistingRoles
        }
      });

      if (error) {
        console.error('Import error:', error);
        toast({
          title: "Import Failed",
          description: error.message || "Failed to import engineers",
          variant: "destructive",
        });
        return;
      }

      setImportResult(data.summary);
      
      if (data.success) {
        toast({
          title: "Import Completed",
          description: `Successfully processed ${data.summary.processed} engineers`,
        });
        onImportComplete();
      } else {
        toast({
          title: "Import Issues",
          description: `Import completed with ${data.summary.errors.length} errors`,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Import failed:', error);
      toast({
        title: "Import Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Import Engineers from CSV</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={downloadTemplate} size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <span className="text-sm text-muted-foreground">
            Use this template to format your engineer data
          </span>
        </div>

        <div>
          <Label htmlFor="csv-file">Select CSV File</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="mt-1"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="create-users"
              checked={createMissingUsers}
              onCheckedChange={(checked) => setCreateMissingUsers(checked as boolean)}
            />
            <Label htmlFor="create-users" className="text-sm">
              Create user accounts for engineers who don't have them
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="update-roles"
              checked={updateExistingRoles}
              onCheckedChange={(checked) => setUpdateExistingRoles(checked as boolean)}
            />
            <Label htmlFor="update-roles" className="text-sm">
              Update profile role to 'engineer' for existing users
            </Label>
          </div>

          {updateExistingRoles && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Role Update Warning</p>
                  <p>This will change the profile role to 'engineer' for any existing users found in the CSV. They will be redirected to the engineer portal on their next login.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {file && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Ready to import: <strong>{file.name}</strong>
              </span>
            </div>
          </div>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              disabled={!file || importing} 
              className="w-full"
            >
              {importing ? 'Importing...' : 'Import Engineers'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Engineer Import</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to import engineers from <strong>{file?.name}</strong>.
                
                <div className="mt-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    {createMissingUsers ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-gray-400" />}
                    <span className="text-sm">Create user accounts for new engineers</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {updateExistingRoles ? <CheckCircle className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-gray-400" />}
                    <span className="text-sm">Update existing user roles to engineer</span>
                  </div>
                </div>

                <p className="mt-3 text-sm">This action cannot be undone. Please ensure your CSV data is correct.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={processImport}>
                Import Engineers
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {importResult && (
          <div className="mt-4 space-y-3">
            <h4 className="font-medium">Import Results</h4>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span>Processed: {importResult.processed}</span>
              </div>
              <div className="flex items-center space-x-2">
                <UserPlus className="h-4 w-4 text-green-600" />
                <span>Created Users: {importResult.created_users}</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Created Engineers: {importResult.created_engineers}</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span>Updated Engineers: {importResult.updated_engineers}</span>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h5 className="font-medium text-red-800 mb-2">Errors ({importResult.errors.length})</h5>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {importResult.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700">
                      Row {error.row}: {error.error} {error.email && `(${error.email})`}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
