
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  category: string | null;
  is_active: boolean;
  specifications: any;
}

interface ProductConfiguration {
  id: string;
  configuration_type: string;
  option_name: string;
  option_value: string;
  price_modifier: number;
  is_default: boolean;
}

interface ProductCompatibility {
  id: string;
  core_product_id: string;
  accessory_product_id: string;
  compatibility_type: string;
  notes: string | null;
}

interface ProductFormProps {
  product?: Product;
  onSave?: (product: Product) => void;
  onSuccess?: () => void;
  onCancel: () => void;
}

export const ProductForm: React.FC<ProductFormProps> = ({ product, onSave, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    base_price: product?.base_price || 0,
    category: product?.category || '',
    is_active: product?.is_active !== false,
    specifications: product?.specifications || {}
  });
  
  const [configurations, setConfigurations] = useState<ProductConfiguration[]>([]);
  const [compatibilities, setCompatibilities] = useState<ProductCompatibility[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [newConfig, setNewConfig] = useState({
    configuration_type: '',
    option_name: '',
    option_value: '',
    price_modifier: 0,
    is_default: false
  });
  
  const [newCompatibility, setNewCompatibility] = useState({
    accessory_product_id: '',
    compatibility_type: 'optional',
    notes: ''
  });

  const { toast } = useToast();

  useEffect(() => {
    if (product?.id) {
      fetchConfigurations();
      fetchCompatibilities();
    }
    fetchAvailableProducts();
  }, [product?.id]);

  const fetchConfigurations = async () => {
    if (!product?.id) return;
    
    const { data, error } = await supabase
      .from('product_configurations')
      .select('*')
      .eq('product_id', product.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch product configurations",
        variant: "destructive",
      });
      return;
    }

    setConfigurations(data || []);
  };

  const fetchCompatibilities = async () => {
    if (!product?.id) return;
    
    const { data, error } = await supabase
      .from('product_compatibility')
      .select('*')
      .eq('core_product_id', product.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch product compatibilities",
        variant: "destructive",
      });
      return;
    }

    setCompatibilities(data || []);
  };

  const fetchAvailableProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .neq('id', product?.id || '');

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch available products",
        variant: "destructive",
      });
      return;
    }

    setAvailableProducts(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let savedProduct;
      
      if (product?.id) {
        const { data, error } = await supabase
          .from('products')
          .update(formData)
          .eq('id', product.id)
          .select()
          .single();

        if (error) throw error;
        savedProduct = data;
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert([formData])
          .select()
          .single();

        if (error) throw error;
        savedProduct = data;
      }

      toast({
        title: "Success",
        description: `Product ${product?.id ? 'updated' : 'created'} successfully`,
      });

      if (onSave) {
        onSave(savedProduct);
      }
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: "Error",
        description: "Failed to save product",
        variant: "destructive",
      });
    }
  };

  const addConfiguration = async () => {
    if (!product?.id || !newConfig.configuration_type || !newConfig.option_name || !newConfig.option_value) {
      toast({
        title: "Error",
        description: "Please fill in all configuration fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('product_configurations')
        .insert([{
          product_id: product.id,
          ...newConfig
        }])
        .select()
        .single();

      if (error) throw error;

      setConfigurations([...configurations, data]);
      setNewConfig({
        configuration_type: '',
        option_name: '',
        option_value: '',
        price_modifier: 0,
        is_default: false
      });

      toast({
        title: "Success",
        description: "Configuration added successfully",
      });
    } catch (error) {
      console.error('Error adding configuration:', error);
      toast({
        title: "Error",
        description: "Failed to add configuration",
        variant: "destructive",
      });
    }
  };

  const deleteConfiguration = async (configId: string) => {
    try {
      const { error } = await supabase
        .from('product_configurations')
        .delete()
        .eq('id', configId);

      if (error) throw error;

      setConfigurations(configurations.filter(config => config.id !== configId));
      toast({
        title: "Success",
        description: "Configuration deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting configuration:', error);
      toast({
        title: "Error",
        description: "Failed to delete configuration",
        variant: "destructive",
      });
    }
  };

  const addCompatibility = async () => {
    if (!product?.id || !newCompatibility.accessory_product_id) {
      toast({
        title: "Error",
        description: "Please select an accessory product",
        variant: "destructive",
      });
      return;
    }

    try {
      const compatibilityData = {
        core_product_id: product.id,
        accessory_product_id: newCompatibility.accessory_product_id,
        compatibility_type: newCompatibility.compatibility_type,
        notes: newCompatibility.notes || null
      };

      const { data, error } = await supabase
        .from('product_compatibility')
        .insert([compatibilityData])
        .select()
        .single();

      if (error) throw error;

      setCompatibilities([...compatibilities, data]);
      setNewCompatibility({
        accessory_product_id: '',
        compatibility_type: 'optional',
        notes: ''
      });

      toast({
        title: "Success",
        description: "Compatibility added successfully",
      });
    } catch (error) {
      console.error('Error adding compatibility:', error);
      toast({
        title: "Error",
        description: "Failed to add compatibility",
        variant: "destructive",
      });
    }
  };

  const deleteCompatibility = async (compatibilityId: string) => {
    try {
      const { error } = await supabase
        .from('product_compatibility')
        .delete()
        .eq('id', compatibilityId);

      if (error) throw error;

      setCompatibilities(compatibilities.filter(comp => comp.id !== compatibilityId));
      toast({
        title: "Success",
        description: "Compatibility deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting compatibility:', error);
      toast({
        title: "Error",
        description: "Failed to delete compatibility",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{product?.id ? 'Edit Product' : 'Create Product'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Product Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="base_price">Base Price (£)</Label>
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex space-x-2">
              <Button type="submit">
                {product?.id ? 'Update Product' : 'Create Product'}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {product?.id && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Product Configurations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                  <Input
                    placeholder="Configuration Type"
                    value={newConfig.configuration_type}
                    onChange={(e) => setNewConfig({ ...newConfig, configuration_type: e.target.value })}
                  />
                  <Input
                    placeholder="Option Name"
                    value={newConfig.option_name}
                    onChange={(e) => setNewConfig({ ...newConfig, option_name: e.target.value })}
                  />
                  <Input
                    placeholder="Option Value"
                    value={newConfig.option_value}
                    onChange={(e) => setNewConfig({ ...newConfig, option_value: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Price Modifier"
                    value={newConfig.price_modifier}
                    onChange={(e) => setNewConfig({ ...newConfig, price_modifier: parseFloat(e.target.value) || 0 })}
                  />
                  <Button onClick={addConfiguration}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {configurations.map((config) => (
                    <div key={config.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{config.configuration_type}</Badge>
                        <span>{config.option_name}: {config.option_value}</span>
                        {config.price_modifier !== 0 && (
                          <span className="text-sm text-muted-foreground">
                            (£{config.price_modifier > 0 ? '+' : ''}{config.price_modifier})
                          </span>
                        )}
                        {config.is_default && <Badge>Default</Badge>}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteConfiguration(config.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Product Compatibility</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <Select
                    value={newCompatibility.accessory_product_id}
                    onValueChange={(value) => setNewCompatibility({ ...newCompatibility, accessory_product_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select accessory product" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select
                    value={newCompatibility.compatibility_type}
                    onValueChange={(value) => setNewCompatibility({ ...newCompatibility, compatibility_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="required">Required</SelectItem>
                      <SelectItem value="optional">Optional</SelectItem>
                      <SelectItem value="recommended">Recommended</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Notes"
                    value={newCompatibility.notes}
                    onChange={(e) => setNewCompatibility({ ...newCompatibility, notes: e.target.value })}
                  />
                  
                  <Button onClick={addCompatibility}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {compatibilities.map((compatibility) => {
                    const accessoryProduct = availableProducts.find(p => p.id === compatibility.accessory_product_id);
                    return (
                      <div key={compatibility.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center space-x-2">
                          <span>{accessoryProduct?.name || 'Unknown Product'}</span>
                          <Badge variant="outline">{compatibility.compatibility_type}</Badge>
                          {compatibility.notes && (
                            <span className="text-sm text-muted-foreground">({compatibility.notes})</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteCompatibility(compatibility.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
