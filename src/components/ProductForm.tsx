
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface Product {
  id?: string;
  name: string;
  description: string | null;
  base_price: number;
  category: string | null;
  is_active: boolean;
  specifications?: any;
  min_width?: number | null;
}

interface CoreProduct {
  id: string;
  name: string;
}

interface ProductFormProps {
  product?: Product;
  onSuccess: () => void;
  onCancel: () => void;
}

const productCategories = [
  'Core',
  'Accessories',
];

export const ProductForm: React.FC<ProductFormProps> = ({ product, onSuccess, onCancel }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [coreProducts, setCoreProducts] = useState<CoreProduct[]>([]);
  const [compatibleProducts, setCompatibleProducts] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    base_price: product?.base_price || 0,
    category: product?.category || '',
    is_active: product?.is_active ?? true,
    specifications: product?.specifications || {},
    min_width: product?.min_width || '',
    max_width: product?.specifications?.max_width || '',
    best_for_stairs: product?.specifications?.best_for_stairs || '',
    sub_description: product?.specifications?.sub_description || ''
  });

  useEffect(() => {
    fetchCoreProducts();
    if (product?.id) {
      fetchCompatibleProducts();
      fetchExistingImage();
    }
  }, [product?.id]);

  const fetchExistingImage = async () => {
    if (!product?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', product.id)
        .eq('is_primary', true)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      if (data?.image_url) {
        setExistingImageUrl(data.image_url);
      }
    } catch (error) {
      console.error('Error fetching existing image:', error);
    }
  };

  const fetchCoreProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name')
        .eq('category', 'Core')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setCoreProducts(data || []);
    } catch (error) {
      console.error('Error fetching core products:', error);
    }
  };

  const fetchCompatibleProducts = async () => {
    if (!product?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('product_compatibility')
        .select('core_product_id')
        .eq('accessory_product_id', product.id);
      
      if (error) throw error;
      setCompatibleProducts(data?.map(item => item.core_product_id) || []);
    } catch (error) {
      console.error('Error fetching compatible products:', error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Error",
          description: "Image size must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Error",
          description: "Please select a valid image file",
          variant: "destructive",
        });
        return;
      }

      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!imageFile) return null;

    setUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${productId}-${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      // Save or update image record in product_images table
      if (existingImageUrl) {
        // Update existing image record
        const { error: dbError } = await supabase
          .from('product_images')
          .update({
            image_url: publicUrl,
            image_name: fileName
          })
          .eq('product_id', productId)
          .eq('is_primary', true);

        if (dbError) throw dbError;
      } else {
        // Insert new image record
        const { error: dbError } = await supabase
          .from('product_images')
          .insert({
            product_id: productId,
            image_url: publicUrl,
            image_name: fileName,
            is_primary: true
          });

        if (dbError) throw dbError;
      }

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Product name is required",
        variant: "destructive",
      });
      return;
    }

    if (formData.base_price < 0) {
      toast({
        title: "Error",
        description: "Base price must be non-negative",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        base_price: formData.base_price,
        category: formData.category || null,
        is_active: formData.is_active,
        specifications: {
          ...formData.specifications,
          ...(formData.sub_description ? { sub_description: formData.sub_description } : {}),
          ...(formData.category === 'Core' && formData.best_for_stairs
            ? { best_for_stairs: formData.best_for_stairs }
            : {}),
          ...(formData.category === 'Core' && formData.max_width
            ? { max_width: parseFloat(formData.max_width.toString()) }
            : {})
        },
        min_width: formData.category === 'Core' && formData.min_width ? parseFloat(formData.min_width.toString()) : null
      };

      let productId: string;
      let error;

      if (product?.id) {
        // Update existing product
        const result = await supabase
          .from('products')
          .update(productData)
          .eq('id', product.id);
        error = result.error;
        productId = product.id;
      } else {
        // Create new product
        const result = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();
        error = result.error;
        productId = result.data?.id;
      }

      if (error) throw error;

      // Upload image if one was selected
      if (imageFile && productId) {
        await uploadImage(productId);
      }

      // Handle compatibility relationships for accessories
      if (formData.category === 'Accessories' && productId) {
        // Remove existing compatibility relationships
        await supabase
          .from('product_compatibility')
          .delete()
          .eq('accessory_product_id', productId);

        // Add new compatibility relationships
        if (compatibleProducts.length > 0) {
          const compatibilityData = compatibleProducts.map(coreProductId => ({
            core_product_id: coreProductId,
            accessory_product_id: productId
          }));

          const { error: compatibilityError } = await supabase
            .from('product_compatibility')
            .insert(compatibilityData);

          if (compatibilityError) throw compatibilityError;
        }
      }

      toast({
        title: "Success",
        description: `Product ${product?.id ? 'updated' : 'created'} successfully`,
      });

      onSuccess();
    } catch (error) {
      console.error('Error saving product:', error);
      toast({
        title: "Error",
        description: `Failed to ${product?.id ? 'update' : 'create'} product`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Product Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter product name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter product description"
            rows={3}
          />
        </div>

        {(formData.category === 'Core' || formData.category === 'Accessories') && (
          <div className="space-y-2">
            <Label htmlFor="sub_description">Sub Description</Label>
            <Input
              id="sub_description"
              value={formData.sub_description}
              onChange={(e) => setFormData({ ...formData, sub_description: e.target.value })}
              placeholder="Enter sub description"
            />
          </div>
        )}


        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="base_price">Base Price (£) *</Label>
            <Input
              id="base_price"
              type="number"
              min="0"
              step="0.01"
              value={formData.base_price}
              onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {productCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Core-specific fields */}
        {formData.category === 'Core' && (
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min_width">Minimum Width (cm)</Label>
              <Input
                id="min_width"
                type="number"
                min="0"
                step="0.1"
                value={formData.min_width}
                onChange={(e) => setFormData({ ...formData, min_width: e.target.value })}
                placeholder="Enter minimum width in centimeters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max_width">Max Width (cm)</Label>
              <Input
                id="max_width"
                type="number"
                min="0"
                step="0.1"
                value={formData.max_width}
                onChange={(e) => setFormData({ ...formData, max_width: e.target.value })}
                placeholder="Enter maximum width in centimeters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="best_for_stairs">Staircase Type</Label>
              <Select
                value={formData.best_for_stairs}
                onValueChange={(value) => setFormData({ ...formData, best_for_stairs: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Straight Stairs">Straight Stairs</SelectItem>
                  <SelectItem value="Stairs with turn">Stairs with turn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Image Upload Section */}
        <div className="space-y-2">
          <Label>Product Image</Label>
          <Card className="border-dashed border-2 border-muted-foreground/25 hover:border-muted-foreground/50 transition-colors">
            <CardContent className="p-6">
              {(imagePreview || existingImageUrl) ? (
                <div className="space-y-4">
                  <div className="relative">
                    <img
                      src={imagePreview || existingImageUrl || ''}
                      alt={imagePreview ? "New image preview" : "Current product image"}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {!imagePreview && existingImageUrl && (
                    <p className="text-sm text-muted-foreground text-center">
                      Current product image - Upload a new image to replace it
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Image
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG, GIF up to 5MB
                    </p>
                  </div>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </CardContent>
          </Card>
        </div>

        {/* Product Compatibility (only for accessories) */}
        {formData.category === 'Accessories' && (
          <div className="space-y-3">
            <Label>Compatible with Core Products</Label>
            <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto">
              {coreProducts.map((coreProduct) => (
                <div key={coreProduct.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`compatible-${coreProduct.id}`}
                    checked={compatibleProducts.includes(coreProduct.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setCompatibleProducts([...compatibleProducts, coreProduct.id]);
                      } else {
                        setCompatibleProducts(compatibleProducts.filter(id => id !== coreProduct.id));
                      }
                    }}
                  />
                  <Label htmlFor={`compatible-${coreProduct.id}`} className="text-sm">
                    {coreProduct.name}
                  </Label>
                </div>
              ))}
            </div>
            {coreProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">No core products available</p>
            )}
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
          />
          <Label htmlFor="is_active">Active Product</Label>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || uploadingImage}>
          {loading ? 'Saving...' : uploadingImage ? 'Uploading...' : (product?.id ? 'Update Product' : 'Create Product')}
        </Button>
      </div>
    </form>
  );
};
