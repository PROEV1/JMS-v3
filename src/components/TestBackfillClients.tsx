import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';  
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function TestBackfillClients() {
  const [loading, setLoading] = useState(false);
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

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Backfill Partner Clients</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runBackfill} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Running...' : 'Run Backfill'}
        </Button>
        
        {result && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <pre className="text-sm whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}