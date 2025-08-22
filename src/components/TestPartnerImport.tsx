import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TestPartnerImport() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testFunction = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Testing partner import function...');
      
      const { data, error } = await supabase.functions.invoke('test-partner-import', {
        body: { test: true }
      });

      console.log('Test function result:', { data, error });
      setResult({ data, error, success: !error });
      
    } catch (error: any) {
      console.error('Test failed:', error);
      setResult({ error: error.message, success: false });
    } finally {
      setLoading(false);
    }
  };

  const testRealImport = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Testing real partner import...');
      
      const { data, error } = await supabase.functions.invoke('partner-import', {
        body: { 
          profile_id: '0d0366e0-e24d-4bb4-ada3-0c6b4ff50ee1',
          dry_run: true,
          create_missing_orders: true
        }
      });

      console.log('Real import result:', { data, error });
      setResult({ data, error, success: !error });
      
    } catch (error: any) {
      console.error('Real import failed:', error);
      setResult({ error: error.message, success: false });
    } finally {
      setLoading(false);
    }
  };

  const runActualImport = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Running ACTUAL partner import (not dry run)...');
      
      const { data, error } = await supabase.functions.invoke('partner-import', {
        body: { 
          profile_id: '0d0366e0-e24d-4bb4-ada3-0c6b4ff50ee1',
          dry_run: false,  // THIS WILL ACTUALLY IMPORT DATA
          create_missing_orders: true
        }
      });

      console.log('Actual import result:', { data, error });
      setResult({ data, error, success: !error });
      
    } catch (error: any) {
      console.error('Actual import failed:', error);
      setResult({ error: error.message, success: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Partner Import Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={testFunction} disabled={loading}>
            Test Function
          </Button>
          <Button onClick={testRealImport} disabled={loading} variant="outline">
            Test Import (Dry Run)
          </Button>
          <Button onClick={runActualImport} disabled={loading} variant="destructive">
            🚨 RUN ACTUAL IMPORT 🚨
          </Button>
        </div>
        
        {loading && <div>Testing...</div>}
        
        {result && (
          <div className="mt-4">
            <h3 className="font-semibold">Result:</h3>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}