import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { apiClient, buildFunctionUrl } from '@/lib/apiClient';
import { toast } from '@/hooks/use-toast';

interface HealthStatus {
  function: string;
  status: 'success' | 'error' | 'pending';
  responseTime?: number;
  requestId?: string;
  error?: string;
}

const CORE_FUNCTIONS = [
  'survey-lookup',
  'offer-lookup', 
  'offer-respond',
  'partner-import',
  'send-offer',
  'create-user'
];

export function AdminHealthCheck() {
  const [healthStatuses, setHealthStatuses] = useState<HealthStatus[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runHealthCheck = async () => {
    setIsRunning(true);
    setHealthStatuses(CORE_FUNCTIONS.map(fn => ({ function: fn, status: 'pending' })));

    const results = await Promise.allSettled(
      CORE_FUNCTIONS.map(async (functionName) => {
        const startTime = Date.now();
        try {
          const url = buildFunctionUrl(functionName, { test: '1' });
          const response = await apiClient.get(url);
          const responseTime = Date.now() - startTime;
          
          return {
            function: functionName,
            status: 'success' as const,
            responseTime,
            requestId: response.requestId
          };
        } catch (error: any) {
          return {
            function: functionName,
            status: 'error' as const,
            responseTime: Date.now() - startTime,
            error: error.message || 'Health check failed'
          };
        }
      })
    );

    const finalStatuses = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          function: CORE_FUNCTIONS[index],
          status: 'error' as const,
          error: 'Promise rejected'
        };
      }
    });

    setHealthStatuses(finalStatuses);
    setIsRunning(false);

    const successCount = finalStatuses.filter(s => s.status === 'success').length;
    const totalCount = finalStatuses.length;

    if (successCount === totalCount) {
      toast({
        title: "Health Check Complete",
        description: `All ${totalCount} functions are healthy`,
      });
    } else {
      toast({
        title: "Health Check Complete",
        description: `${successCount}/${totalCount} functions are healthy`,
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: HealthStatus['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: HealthStatus['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Healthy</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      case 'pending':
        return <Badge variant="secondary">Checking...</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Edge Functions Health Check
        </CardTitle>
        <CardDescription>
          Test core Supabase Edge Functions with standardized health endpoints
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runHealthCheck} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? 'Running Health Check...' : 'Run Health Check'}
        </Button>

        {healthStatuses.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-muted-foreground">Function Status</h4>
            {healthStatuses.map((status) => (
              <div 
                key={status.function}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(status.status)}
                  <div>
                    <div className="font-medium text-sm">{status.function}</div>
                    {status.error && (
                      <div className="text-xs text-muted-foreground text-red-500">
                        {status.error}
                      </div>
                    )}
                    {status.requestId && (
                      <div className="text-xs text-muted-foreground">
                        Request ID: {status.requestId}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {status.responseTime && (
                    <span className="text-xs text-muted-foreground">
                      {status.responseTime}ms
                    </span>
                  )}
                  {getStatusBadge(status.status)}
                </div>
              </div>
            ))}
          </div>
        )}

        {healthStatuses.length > 0 && (
          <div className="pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Summary: {healthStatuses.filter(s => s.status === 'success').length} / {healthStatuses.length} functions healthy
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}