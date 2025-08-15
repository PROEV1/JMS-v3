
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Upload, Star, StarOff, ArrowUp, ArrowDown } from 'lucide-react';
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

interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  image_name: string;
  is_primary: boolean;
  sort_order: number;
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
  const [images, setImages] = useState<ProductImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [newSpec, setNewSpec] = useState({ key: '', value: '' });
  
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
      fetchImages();
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
    let query = supabase
      .from('products')
      .select('*')
      .eq('is_active', true);
    
    if (product?.id) {
      query = query.neq('id', product.id);
    }

    const { data, error } = await query;

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

  const fetchImages = async () => {
    if (!product?.id) return;
    
    const { data, error } = await supabase
      .from('product_images')
      .select('*')
      .eq('product_id', product.id)
      .order('sort_order');

    if (error) {
      toast({
        title: "Error",
        description: "Failed to fetch product images",
        variant: "destructive",
      });
      return;
    }

    setImages(data || []);
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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !product?.id) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${product.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      const { data, error } = await supabase
        .from('product_images')
        .insert([{
          product_id: product.id,
          image_url: publicUrl,
          image_name: file.name,
          is_primary: images.length === 0,
          sort_order: images.length
        }])
        .select()
        .single();

      if (error) throw error;

      setImages([...images, data]);
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Error",
        description: "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const deleteImage = async (imageId: string, imageUrl: string) => {
    try {
      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      // Extract file path from URL for storage deletion
      const urlParts = imageUrl.split('/');
      const fileName = `${product?.id}/${urlParts[urlParts.length - 1]}`;
      
      await supabase.storage
        .from('product-images')
        .remove([fileName]);

      setImages(images.filter(img => img.id !== imageId));
      toast({
        title: "Success",
        description: "Image deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting image:', error);
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive",
      });
    }
  };

  const setPrimaryImage = async (imageId: string) => {
    try {
      // First, unset all primary flags
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', product?.id);

      // Then set the selected image as primary
      const { error } = await supabase
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      if (error) throw error;

      setImages(images.map(img => ({ ...img, is_primary: img.id === imageId })));
      toast({
        title: "Success",
        description: "Primary image updated",
      });
    } catch (error) {
      console.error('Error setting primary image:', error);
      toast({
        title: "Error",
        description: "Failed to set primary image",
        variant: "destructive",
      });
    }
  };

  const addSpecification = () => {
    if (!newSpec.key || !newSpec.value) {
      toast({
        title: "Error",
        description: "Please enter both key and value",
        variant: "destructive",
      });
      return;
    }

    const updatedSpecs = { ...formData.specifications, [newSpec.key]: newSpec.value };
    setFormData({ ...formData, specifications: updatedSpecs });
    setNewSpec({ key: '', value: '' });
  };

  const removeSpecification = (key: string) => {
    const updatedSpecs = { ...formData.specifications };
    delete updatedSpecs[key];
    setFormData({ ...formData, specifications: updatedSpecs });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        <Card>
          <CardHeader>
            <CardTitle>{product?.id ? 'Edit Product' : 'Create Product'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
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
            </div>
          </CardContent>
        </Card>

      <Card>
        <CardHeader>
          <CardTitle>Specifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                placeholder="Specification Key"
                value={newSpec.key}
                onChange={(e) => setNewSpec({ ...newSpec, key: e.target.value })}
              />
              <Input
                placeholder="Specification Value"
                value={newSpec.value}
                onChange={(e) => setNewSpec({ ...newSpec, value: e.target.value })}
              />
              <Button type="button" onClick={addSpecification}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {Object.entries(formData.specifications || {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <strong>{key}:</strong> {value as string}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => removeSpecification(key)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {!product?.id && (
        <Card>
          <CardHeader>
            <CardTitle>Product Images</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Images can be added after creating the product. Save the product first, then edit it to upload images.
            </p>
          </CardContent>
        </Card>
      )}

      {product?.id && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Product Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="image-upload">Upload Image</Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                  />
                  {uploadingImage && <p className="text-sm text-muted-foreground mt-1">Uploading...</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {images.map((image) => (
                    <div key={image.id} className="relative border rounded-lg p-2">
                      <img
                        src={image.image_url}
                        alt={image.image_name}
                        className="w-full h-32 object-cover rounded"
                      />
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <Button
                          size="sm"
                          variant={image.is_primary ? "default" : "outline"}
                          onClick={() => setPrimaryImage(image.id)}
                        >
                          {image.is_primary ? <Star className="h-3 w-3" /> : <StarOff className="h-3 w-3" />}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteImage(image.id, image.image_url)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs mt-1 truncate">{image.image_name}</p>
                      {image.is_primary && <Badge className="mt-1">Primary</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

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
      
      {/* Sticky Footer with Buttons */}
      <div className="flex-shrink-0 border-t pt-4 mt-6">
        <div className="flex space-x-2 justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {product?.id ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </div>
    </form>
  );
};
