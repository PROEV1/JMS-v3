import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, ArrowLeft, Package2, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AssignedCharger {
  id: string;
  serial_number: string;
  status: string;
  notes?: string;
  created_at: string;
  charger_item: {
    name: string;
    sku: string;
    description?: string;
  };
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'assigned': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'in_transit': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'delivered': return 'bg-green-100 text-green-700 border-green-200';
    case 'installed': return 'bg-purple-100 text-purple-700 border-purple-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'assigned': return <Package2 className="h-4 w-4" />;
    case 'in_transit': return <Clock className="h-4 w-4" />;
    case 'delivered': return <CheckCircle className="h-4 w-4" />;
    case 'installed': return <Zap className="h-4 w-4" />;
    default: return <Package2 className="h-4 w-4" />;
  }
};

export default function EngineerChargers() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get engineer profile
  const { data: engineer } = useQuery({
    queryKey: ['engineer-profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get all assigned chargers
  const { data: assignedChargers, isLoading } = useQuery({
    queryKey: ['assigned-chargers', engineer?.id],
    queryFn: async () => {
      if (!engineer?.id) return [];

      const { data, error } = await supabase
        .from('charger_inventory')
        .select(`
          *,
          charger_item:inventory_items(name, sku, description)
        `)
        .eq('engineer_id', engineer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AssignedCharger[];
    },
    enabled: !!engineer?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!engineer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Engineer Profile Not Found</h3>
          <p className="text-muted-foreground">Unable to load engineer profile.</p>
        </div>
      </div>
    );
  }

  const statusCounts = assignedChargers?.reduce((acc, charger) => {
    acc[charger.status] = (acc[charger.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/engineer/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Zap className="h-7 w-7 text-purple-500" />
              Assigned Chargers
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              {assignedChargers?.length ? `You have ${assignedChargers.length} charger${assignedChargers.length === 1 ? '' : 's'} assigned` : 'No chargers assigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package2 className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assigned</p>
                <p className="text-lg font-semibold">{statusCounts.assigned || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Transit</p>
                <p className="text-lg font-semibold">{statusCounts.in_transit || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delivered</p>
                <p className="text-lg font-semibold">{statusCounts.delivered || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Zap className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Installed</p>
                <p className="text-lg font-semibold">{statusCounts.installed || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chargers List */}
      {assignedChargers && assignedChargers.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Your Chargers</h2>
          <div className="grid gap-4">
            {assignedChargers.map((charger) => (
              <Card key={charger.id} className="hover:shadow-md transition-all duration-200">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-lg">{charger.charger_item?.name || 'Unknown Charger'}</h3>
                        <Badge className={getStatusColor(charger.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(charger.status)}
                            {charger.status.charAt(0).toUpperCase() + charger.status.slice(1).replace('_', ' ')}
                          </span>
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-muted-foreground">Serial Number</p>
                          <p className="font-mono bg-muted px-2 py-1 rounded text-sm">{charger.serial_number}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground">SKU</p>
                          <p>{charger.charger_item?.sku || 'N/A'}</p>
                        </div>
                        {charger.charger_item?.description && (
                          <div className="md:col-span-2">
                            <p className="font-medium text-muted-foreground">Description</p>
                            <p className="text-sm">{charger.charger_item.description}</p>
                          </div>
                        )}
                        {charger.notes && (
                          <div className="md:col-span-2">
                            <p className="font-medium text-muted-foreground">Notes</p>
                            <p className="text-sm">{charger.notes}</p>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-muted-foreground">Assigned Date</p>
                          <p className="text-sm">{new Date(charger.created_at).toLocaleDateString('en-GB')}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="text-center py-12 bg-gradient-to-br from-purple-50 to-indigo-50">
          <CardContent>
            <Zap className="h-16 w-16 mx-auto text-purple-300 mb-4" />
            <h3 className="text-lg font-semibold text-purple-900 mb-2">No chargers assigned</h3>
            <p className="text-purple-600 mb-4">You don't have any chargers assigned to you at the moment.</p>
            <Button 
              variant="outline" 
              onClick={() => navigate('/engineer/dashboard')}
              className="border-purple-300 text-purple-600 hover:bg-purple-50"
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}