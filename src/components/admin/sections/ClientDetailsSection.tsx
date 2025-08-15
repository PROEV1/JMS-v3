import { useState } from "react";
import { OrderSection } from "../OrderSectionLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Edit3,
  Check,
  X,
  Save
} from "lucide-react";

interface ClientDetailsProps {
  order: {
    id: string;
    client: {
      id: string;
      full_name: string;
      email: string;
      phone?: string | null;
      address: string | null;
    };
  };
  onUpdate: () => void;
}

export function ClientDetailsSection({ order, onUpdate }: ClientDetailsProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // Parse address into components for better editing
  const parseAddress = (address: string | null) => {
    if (!address) return { street: '', city: '', postcode: '' };
    
    // Simple parsing - you might want to make this more sophisticated
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      return {
        street: parts.slice(0, -2).join(', '),
        city: parts[parts.length - 2],
        postcode: parts[parts.length - 1]
      };
    }
    return { street: address, city: '', postcode: '' };
  };

  const [editData, setEditData] = useState({
    full_name: order.client.full_name,
    email: order.client.email,
    phone: order.client.phone || '',
    address: order.client.address || ''
  });

  // Separate state for address components during editing
  const [addressComponents, setAddressComponents] = useState(() => 
    parseAddress(order.client.address)
  );

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Reconstruct address from components
      const reconstructedAddress = [
        addressComponents.street, 
        addressComponents.city, 
        addressComponents.postcode
      ].filter(p => p && p.trim()).join(', ');

      const { error } = await supabase
        .from('clients')
        .update({
          full_name: editData.full_name,
          email: editData.email,
          phone: editData.phone || null,
          address: reconstructedAddress || null
        })
        .eq('id', order.client.id);

      if (error) throw error;

      toast({
        title: "Client Updated",
        description: "Client information has been updated successfully.",
      });

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating client:', error);
      toast({
        title: "Error",
        description: "Failed to update client information",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditData({
      full_name: order.client.full_name,
      email: order.client.email,
      phone: order.client.phone || '',
      address: order.client.address || ''
    });
    setAddressComponents(parseAddress(order.client.address));
    setIsEditing(false);
  };

  const updateAddressComponent = (field: string, value: string) => {
    setAddressComponents(prev => ({ ...prev, [field]: value }));
  };

  return (
    <OrderSection 
      id="client-details" 
      title="Client Information" 
      icon={User} 
      defaultOpen={true}
    >
      <div className="space-y-4">
        {/* Header with edit toggle */}
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Contact Details
          </h4>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Client
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isLoading}>
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="text-sm font-medium">Full Name</label>
              <Input
                value={editData.full_name}
                onChange={(e) => setEditData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Client full name"
              />
            </div>

            {/* Email */}
            <div>
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                value={editData.email}
                onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="client@example.com"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                type="tel"
                value={editData.phone}
                onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="01234 567890"
              />
            </div>

            {/* Address Fields */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Address</label>
              <Input
                value={addressComponents.street}
                onChange={(e) => updateAddressComponent('street', e.target.value)}
                placeholder="Street address"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={addressComponents.city}
                  onChange={(e) => updateAddressComponent('city', e.target.value)}
                  placeholder="City"
                />
                <Input
                  value={addressComponents.postcode}
                  onChange={(e) => updateAddressComponent('postcode', e.target.value)}
                  placeholder="Postcode"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Display Mode */}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{order.client.full_name}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a 
                href={`mailto:${order.client.email}`}
                className="text-primary hover:underline"
              >
                {order.client.email}
              </a>
            </div>
            
            {order.client.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={`tel:${order.client.phone}`}
                  className="text-primary hover:underline"
                >
                  {order.client.phone}
                </a>
              </div>
            )}
            
            {order.client.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-sm">{order.client.address}</span>
              </div>
            )}

            {/* Quick Actions */}
            <div className="pt-4 border-t">
              <h5 className="font-medium text-sm mb-3">Quick Actions</h5>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(`mailto:${order.client.email}`, '_blank')}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                {order.client.phone && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(`tel:${order.client.phone}`, '_blank')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </OrderSection>
  );
}