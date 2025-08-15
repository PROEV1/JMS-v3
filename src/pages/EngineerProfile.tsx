import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { BrandPage, BrandContainer, BrandHeading1, BrandLoading } from '@/components/brand';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { User, MapPin, Mail, CheckCircle, XCircle } from 'lucide-react';

interface EngineerInfo {
  id: string;
  name: string;
  email: string;
  region: string | null;
  availability: boolean;
  created_at: string;
}

export default function EngineerProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [engineerInfo, setEngineerInfo] = useState<EngineerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    region: ''
  });

  useEffect(() => {
    if (user?.id) {
      fetchEngineerProfile();
    }
  }, [user?.id]);

  const fetchEngineerProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      
      setEngineerInfo(data);
      setFormData({
        name: data.name,
        email: data.email,
        region: data.region || ''
      });
    } catch (error) {
      console.error('Error fetching engineer profile:', error);
      toast({
        title: "Error",
        description: "Failed to load profile information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('engineers')
        .update({
          name: formData.name,
          email: formData.email,
          region: formData.region || null
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully",
      });

      setEditing(false);
      fetchEngineerProfile();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  if (loading) return <BrandLoading />;

  if (!engineerInfo) {
    return (
      <BrandPage>
        <BrandContainer>
          <div className="text-center py-8">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Engineer profile not found</p>
          </div>
        </BrandContainer>
      </BrandPage>
    );
  }

  return (
    <BrandPage>
      <BrandContainer>
        <div className="flex items-center justify-between mb-8">
          <BrandHeading1>Engineer Profile</BrandHeading1>
          {!editing && (
            <Button onClick={() => setEditing(true)}>
              Edit Profile
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      placeholder="Enter your region"
                    />
                  </div>
                  <div className="flex space-x-2 pt-4">
                    <Button onClick={handleSave}>Save Changes</Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{engineerInfo.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{engineerInfo.email}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{engineerInfo.region || 'Not specified'}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status Information */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                {engineerInfo.availability ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span>Availability:</span>
                <Badge 
                  variant={engineerInfo.availability ? "default" : "secondary"}
                  className={engineerInfo.availability ? "bg-green-100 text-green-800" : ""}
                >
                  {engineerInfo.availability ? 'Available' : 'Unavailable'}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Member since: {new Date(engineerInfo.created_at).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </BrandContainer>
    </BrandPage>
  );
}