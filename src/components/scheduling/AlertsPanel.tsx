import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, Calendar, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AlertsPanelProps {
  expiringOffers: number;
  unassignedJobs: number;
}

export function AlertsPanel({ expiringOffers, unassignedJobs }: AlertsPanelProps) {
  const navigate = useNavigate();
  
  const hasAlerts = expiringOffers > 0 || unassignedJobs > 5; // Consider 5+ unassigned as urgent

  if (!hasAlerts) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-green-900">All systems running smoothly</p>
              <p className="text-sm text-green-700">No urgent scheduling issues detected</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-red-900">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          Urgent Scheduling Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {expiringOffers > 0 && (
          <div className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-red-200">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-red-600" />
              <div>
                <p className="font-medium text-red-900">
                  {expiringOffers} offer{expiringOffers !== 1 ? 's' : ''} expiring soon
                </p>
                <p className="text-sm text-red-700">Within the next 24 hours</p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => navigate('/admin/schedule/status/date-offered')}
            >
              Review
            </Button>
          </div>
        )}

        {unassignedJobs > 5 && (
          <div className="flex items-center justify-between p-3 bg-white/60 rounded-lg border border-red-200">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-red-600" />
              <div>
                <p className="font-medium text-red-900">
                  {unassignedJobs} jobs awaiting assignment
                </p>
                <p className="text-sm text-red-700">High backlog detected</p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => navigate('/admin/schedule/status/needs-scheduling')}
            >
              Assign
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}