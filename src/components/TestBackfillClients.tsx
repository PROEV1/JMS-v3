
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';  
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function TestBackfillClients() {
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runBackfill = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('backfill-partner-clients');
      
      if (error) {
        throw error;
      }
      
      setResult(data);
    } catch (error) {
      console.error('Backfill error:', error);
      setResult({ success: false, error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const runPartnerImport = async () => {
    setImportLoading(true);
    setResult(null);
    
    try {
      // Get the first active partner import profile for testing
      const { data: profiles, error: profileError } = await supabase
        .from('partner_import_profiles')
        .select('*')
        .eq('is_active', true)
        .limit(1);
      
      if (profileError) throw profileError;
      
      if (!profiles || profiles.length === 0) {
        throw new Error('No active partner import profiles found');
      }
      
      const profile = profiles[0];
      
      const { data, error } = await supabase.functions.invoke('partner-import', {
        body: { 
          profileId: profile.id,
          dryRun: false,
          maxRows: 50 // Limit for testing
        }
      });
      
      if (error) {
        throw error;
      }
      
      setResult({
        success: true,
        type: 'partner_import',
        profile: profile.name,
        ...data
      });
    } catch (error) {
      console.error('Partner import error:', error);
      setResult({ success: false, error: error.message, type: 'partner_import' });
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Partner Data Testing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button 
            onClick={runBackfill} 
            disabled={loading || importLoading}
            className="flex-1"
          >
            {loading ? 'Running...' : 'Run Backfill'}
          </Button>
          
          <Button 
            onClick={runPartnerImport} 
            disabled={loading || importLoading}
            variant="outline"
            className="flex-1"
          >
            {importLoading ? 'Importing...' : 'Test Partner Import'}
          </Button>
        </div>
        
        {result && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">
                {result.type === 'partner_import' ? 'Partner Import Results' : 'Backfill Results'}
              </h4>
              <div className={`px-2 py-1 rounded text-xs ${
                result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {result.success ? 'Success' : 'Error'}
              </div>
            </div>
            <pre className="text-sm whitespace-pre-wrap overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Backfill Partner Clients:</strong> Creates placeholder clients for partner orders without existing clients.</p>
          <p><strong>Test Partner Import:</strong> Re-runs the partner import with the new date parsing and status mapping logic to verify fixes.</p>
          <p className="text-orange-600"><strong>Note:</strong> The import will process up to 50 rows for testing. Check the "On Hold" bucket in the scheduling dashboard after running.</p>
        </div>
      </CardContent>
    </Card>
  );
}
