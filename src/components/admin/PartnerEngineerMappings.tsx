import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface PartnerEngineerMapping {
  id: string;
  partner_engineer_name: string;
  engineer_id: string;
  is_active: boolean;
  engineers: {
    name: string;
  };
}

interface PartnerEngineerMappingsProps {
  partnerId: string;
  partnerName: string;
}

export const PartnerEngineerMappings = ({ partnerId, partnerName }: PartnerEngineerMappingsProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [partnerEngineerName, setPartnerEngineerName] = useState('');
  const [selectedEngineerId, setSelectedEngineerId] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch partner engineer mappings
  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ['partner-engineer-mappings', partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_engineer_mappings')
        .select(`
          id,
          partner_engineer_name,
          engineer_id,
          is_active,
          engineers (name)
        `)
        .eq('partner_id', partnerId)
        .order('partner_engineer_name');
        
      if (error) throw error;
      return data as PartnerEngineerMapping[];
    }
  });

  // Fetch available engineers
  const { data: engineers = [] } = useQuery({
    queryKey: ['engineers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineers')
        .select('id, name')
        .eq('availability', true)
        .order('name');
        
      if (error) throw error;
      return data;
    }
  });

  // Create mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async ({ partnerEngineerName, engineerId }: { partnerEngineerName: string; engineerId: string }) => {
      const { data, error } = await supabase
        .from('partner_engineer_mappings')
        .insert({
          partner_id: partnerId,
          partner_engineer_name: partnerEngineerName,
          engineer_id: engineerId,
          is_active: true
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-engineer-mappings', partnerId] });
      setPartnerEngineerName('');
      setSelectedEngineerId('');
      setShowDialog(false);
      toast.success('Engineer mapping created');
    },
    onError: (error) => {
      toast.error(`Failed to create mapping: ${error.message}`);
    }
  });

  // Delete mapping mutation
  const deleteMappingMutation = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from('partner_engineer_mappings')
        .delete()
        .eq('id', mappingId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-engineer-mappings', partnerId] });
      toast.success('Engineer mapping deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete mapping: ${error.message}`);
    }
  });

  const handleCreateMapping = () => {
    if (!partnerEngineerName.trim() || !selectedEngineerId) {
      toast.error('Please fill in all fields');
      return;
    }

    createMappingMutation.mutate({
      partnerEngineerName: partnerEngineerName.trim(),
      engineerId: selectedEngineerId
    });
  };

  const handleDelete = (mappingId: string) => {
    if (confirm('Are you sure you want to delete this engineer mapping?')) {
      deleteMappingMutation.mutate(mappingId);
    }
  };

  if (loadingMappings) {
    return <div>Loading engineer mappings...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Engineer Mappings - {partnerName}</CardTitle>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Mapping
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Engineer Mapping</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="partner-engineer-name">Partner Engineer Name</Label>
                <Input
                  id="partner-engineer-name"
                  value={partnerEngineerName}
                  onChange={(e) => setPartnerEngineerName(e.target.value)}
                  placeholder="Enter partner's engineer name"
                />
              </div>
              <div>
                <Label htmlFor="engineer-select">Internal Engineer</Label>
                <Select value={selectedEngineerId} onValueChange={setSelectedEngineerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an engineer" />
                  </SelectTrigger>
                  <SelectContent>
                    {engineers.map((engineer) => (
                      <SelectItem key={engineer.id} value={engineer.id}>
                        {engineer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateMapping}
                  disabled={createMappingMutation.isPending}
                >
                  {createMappingMutation.isPending ? 'Creating...' : 'Create Mapping'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No engineer mappings configured yet. Add mappings to automatically assign engineers during import.
          </div>
        ) : (
          <div className="space-y-2">
            {mappings.map((mapping) => (
              <div key={mapping.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div>
                    <div className="font-medium">{mapping.partner_engineer_name}</div>
                    <div className="text-sm text-muted-foreground">
                      Maps to: {mapping.engineers.name}
                    </div>
                  </div>
                  <Badge variant={mapping.is_active ? "default" : "secondary"}>
                    {mapping.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(mapping.id)}
                  disabled={deleteMappingMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};