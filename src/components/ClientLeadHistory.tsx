import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CalendarDays, Phone, Mail, Package, PoundSterling, Ruler, Palette, Star } from 'lucide-react';

interface LeadHistory {
  id: string;
  original_lead_id: string;
  lead_name: string;
  lead_email: string;
  lead_phone?: string;
  lead_notes?: string;
  product_name?: string;
  product_price?: number;
  width_cm?: number;
  lead_created_at: string;
  converted_at: string;
  source?: string;
  status?: string;
  total_price?: number;
  accessories_data?: any;
  finish?: string;
  luxe_upgrade?: boolean;
}

interface ClientLeadHistoryProps {
  clientId: string;
}

export const ClientLeadHistory = ({ clientId }: ClientLeadHistoryProps) => {
  const [leadHistory, setLeadHistory] = useState<LeadHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeadHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('lead_history')
          .select('*')
          .eq('client_id', clientId)
          .order('converted_at', { ascending: false });

        if (error) {
          console.error('Error fetching lead history:', error);
          return;
        }

        setLeadHistory(data || []);
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeadHistory();
  }, [clientId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">Loading lead history...</div>
        </CardContent>
      </Card>
    );
  }

  if (leadHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lead History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No lead history found for this client.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead History ({leadHistory.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {leadHistory.map((lead, index) => (
          <div key={lead.id}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{lead.lead_name}</h4>
                {lead.status && lead.status !== 'Unknown' && (
                  <Badge variant="secondary">{lead.status}</Badge>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{lead.lead_email}</span>
                  </div>
                  
                  {lead.lead_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{lead.lead_phone}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    <span>Lead Created: {new Date(lead.lead_created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    <span>Converted: {new Date(lead.converted_at).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {lead.product_name && (
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span>{lead.product_name}</span>
                    </div>
                  )}
                  
                  {lead.product_price && (
                    <div className="flex items-center gap-2">
                      <PoundSterling className="w-4 h-4 text-muted-foreground" />
                      <span>£{lead.product_price}</span>
                    </div>
                  )}

                  {lead.total_price && (
                    <div className="flex items-center gap-2">
                      <PoundSterling className="w-4 h-4 text-green-600" />
                      <span className="font-medium">Total: £{lead.total_price}</span>
                    </div>
                  )}
                  
                  {lead.width_cm && (
                    <div className="flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-muted-foreground" />
                      <span>{lead.width_cm}cm width</span>
                    </div>
                  )}

                  {lead.finish && (
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-muted-foreground" />
                      <span>{lead.finish}</span>
                    </div>
                  )}

                  {lead.luxe_upgrade && (
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="text-yellow-700 dark:text-yellow-400">Luxe Upgrade</span>
                    </div>
                  )}
                  
                  {lead.source && (
                    <div className="text-muted-foreground">
                      Source: {lead.source}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Accessories section */}
              {(() => {
                let accessoriesList = [];
                if (lead.accessories_data) {
                  if (typeof lead.accessories_data === 'string') {
                    try {
                      accessoriesList = JSON.parse(lead.accessories_data);
                    } catch (e) {
                      console.error('Failed to parse accessories_data:', e);
                    }
                  } else if (Array.isArray(lead.accessories_data)) {
                    accessoriesList = lead.accessories_data;
                  }
                }
                
                return accessoriesList && accessoriesList.length > 0 && (
                  <div className="mt-3 p-3 bg-muted rounded-md">
                    <h5 className="text-sm font-medium mb-2">Accessories:</h5>
                    <div className="space-y-1">
                      {accessoriesList.map((accessory: any, index: number) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                          <span>{accessory.name}</span>
                          <span className="text-green-600">+£{accessory.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {lead.lead_notes && (
                <div className="mt-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>Notes:</strong> {lead.lead_notes}
                  </p>
                </div>
              )}
            </div>
            
            {index < leadHistory.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};