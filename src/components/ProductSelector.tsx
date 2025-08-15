
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, X, Search, Filter } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  category: string | null;
  is_active: boolean;
  specifications: any;
  images: Array<{
    image_url: string;
    image_name: string;
    is_primary: boolean;
  }>;
  configurations: Array<{
    id: string;
    configuration_type: string;
    option_name: string;
    option_value: string;
    price_modifier: number;
    is_default: boolean;
  }>;
}

interface SelectedProduct {
  product: Product;
  quantity: number;
  configuration: Record<string, string>;
  totalPrice: number;
}

interface ProductSelectorProps {
  onSelectionChange: (selectedProducts: SelectedProduct[]) => void;
  selectedProducts: SelectedProduct[];
}

const productCategories = [
  'Core',
  'Accessories',
];

export const ProductSelector: React.FC<ProductSelectorProps> = ({ 
  onSelectionChange, 
  selectedProducts 
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [currentQuantity, setCurrentQuantity] = useState(1);
  const [currentConfiguration, setCurrentConfiguration] = useState<Record<string, string>>({});
  const [selectedCoreProduct, setSelectedCoreProduct] = useState<string>('');
  const [availableAccessories, setAvailableAccessories] = useState<Product[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, []);

  // Reset configuration when product changes
  useEffect(() => {
    const selectedProduct = products.find(p => p.id === selectedProductId);
    if (selectedProduct) {
      const defaultConfig: Record<string, string> = {};
      
      // Group configurations by type and set defaults
      const configurationTypes = selectedProduct.configurations.reduce((acc, config) => {
        if (!acc[config.configuration_type]) {
          acc[config.configuration_type] = [];
        }
        acc[config.configuration_type].push(config);
        return acc;
      }, {} as Record<string, typeof selectedProduct.configurations>);

      Object.entries(configurationTypes).forEach(([type, configs]) => {
        const defaultOption = configs.find(c => c.is_default) || configs[0];
        if (defaultOption) {
          defaultConfig[type] = defaultOption.option_value;
        }
      });

      setCurrentConfiguration(defaultConfig);
    } else {
      setCurrentConfiguration({});
    }
  }, [selectedProductId, products]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          images:product_images(*),
          configurations:product_configurations(*)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch compatible accessories when any core product is selected
  useEffect(() => {
    const coreProducts = selectedProducts.filter(sp => sp.product.category === 'Core');
    if (coreProducts.length > 0) {
      fetchCompatibleAccessoriesForSelectedCores(coreProducts.map(sp => sp.product.id));
    } else {
      setAvailableAccessories([]);
      setSelectedCoreProduct('');
    }
  }, [selectedProducts, products]);

  const fetchCompatibleAccessoriesForSelectedCores = async (coreProductIds: string[]) => {
    if (coreProductIds.length === 0) return;
    
    try {
      const { data, error } = await supabase
        .from('product_compatibility')
        .select('accessory_product_id')
        .in('core_product_id', coreProductIds);
      
      if (error) throw error;
      
      const accessoryIds = data?.map(item => item.accessory_product_id) || [];
      const accessories = products.filter(p => 
        p.category === 'Accessories' && 
        accessoryIds.includes(p.id)
      );
      
      setAvailableAccessories(accessories);
      // Set the first core product as selected for display purposes
      if (coreProductIds.length > 0) {
        setSelectedCoreProduct(coreProductIds[0]);
      }
    } catch (error) {
      console.error('Error fetching compatible accessories:', error);
    }
  };

  const filteredProducts = products.filter(product => {
    if (!selectedCategory || selectedCategory === 'all' || selectedCategory === 'all') {
      return true;
    }
    
    if (selectedCategory === 'Core') {
      return product.category === 'Core';
    }
    
    if (selectedCategory === 'Accessories') {
      // If a core product is selected, show only compatible accessories
      if (selectedCoreProduct) {
        return availableAccessories.some(acc => acc.id === product.id);
      }
      // Otherwise show all accessories
      return product.category === 'Accessories';
    }
    
    return product.category === selectedCategory;
  });

  const getCurrentProduct = () => {
    return products.find(p => p.id === selectedProductId);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const calculateTotalPrice = () => {
    const product = getCurrentProduct();
    if (!product) return 0;

    let total = product.base_price * currentQuantity;
    Object.entries(currentConfiguration).forEach(([configType, selectedValue]) => {
      const configOption = product.configurations.find(
        config => config.configuration_type === configType && config.option_value === selectedValue
      );
      if (configOption) {
        total += configOption.price_modifier * currentQuantity;
      }
    });
    return total;
  };

  const handleAddProduct = () => {
    const product = getCurrentProduct();
    if (!product) return;

    const selectedProduct: SelectedProduct = {
      product,
      quantity: currentQuantity,
      configuration: currentConfiguration,
      totalPrice: calculateTotalPrice()
    };

    // Check if product already selected
    const existingIndex = selectedProducts.findIndex(sp => sp.product.id === product.id);
    let updatedSelection;

    if (existingIndex >= 0) {
      // Update existing selection
      updatedSelection = [...selectedProducts];
      updatedSelection[existingIndex] = selectedProduct;
    } else {
      // Add new selection
      updatedSelection = [...selectedProducts, selectedProduct];
    }

    onSelectionChange(updatedSelection);
    
    console.log('Product selection updated:', {
      productName: product.name,
      action: existingIndex >= 0 ? 'updated' : 'added',
      totalSelected: updatedSelection.length
    });
    
    // If core product is selected, update the core product filter for accessories
    if (product.category === 'Core') {
      setSelectedCoreProduct(product.id);
    }
    
    // Reset form
    setSelectedProductId('');
    setCurrentQuantity(1);
    setCurrentConfiguration({});

    toast({
      title: "Success",
      description: `${product.name} ${existingIndex >= 0 ? 'updated' : 'added to'} quote`,
    });
  };

  const handleAccessoryToggle = (accessory: Product, checked: boolean) => {
    if (checked) {
      // Add accessory
      const selectedProduct: SelectedProduct = {
        product: accessory,
        quantity: 1,
        configuration: {},
        totalPrice: accessory.base_price
      };

      const updatedSelection = [...selectedProducts, selectedProduct];
      onSelectionChange(updatedSelection);

      toast({
        title: "Success",
        description: `${accessory.name} added to quote`,
      });
    } else {
      // Remove accessory
      const updatedSelection = selectedProducts.filter(sp => sp.product.id !== accessory.id);
      onSelectionChange(updatedSelection);

      toast({
        title: "Removed",
        description: `${accessory.name} removed from quote`,
      });
    }
  };

  const handleRemoveProduct = (productId: string) => {
    const updatedSelection = selectedProducts.filter(sp => sp.product.id !== productId);
    onSelectionChange(updatedSelection);
  };

  const handleConfigurationChange = (type: string, value: string) => {
    setCurrentConfiguration(prev => ({ ...prev, [type]: value }));
  };

  const currentProduct = getCurrentProduct();
  const configurationTypes = currentProduct ? 
    currentProduct.configurations.reduce((acc, config) => {
      if (!acc[config.configuration_type]) {
        acc[config.configuration_type] = [];
      }
      acc[config.configuration_type].push(config);
      return acc;
    }, {} as Record<string, typeof currentProduct.configurations>) : {};

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Product Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Category Filter and Core Product Selection */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {productCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Core Product Selection for Accessories Filter */}
            {selectedCategory === 'Accessories' && (
              <div className="flex items-center space-x-2">
                <Label htmlFor="core-product">For Core Product:</Label>
                <Select value={selectedCoreProduct} onValueChange={setSelectedCoreProduct}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select core product (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accessories</SelectItem>
                    {products.filter(p => p.category === 'Core').map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Product Dropdown */}
          <div>
            <Label htmlFor="product-select">Choose Product</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    <div className="flex flex-col">
                      <span>{product.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatCurrency(product.base_price)}
                        {product.category && ` • ${product.category}`}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Configuration (shown when product is selected) */}
          {currentProduct && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-start space-x-4">
                {currentProduct.images?.find(img => img.is_primary)?.image_url && (
                  <img
                    src={currentProduct.images.find(img => img.is_primary)?.image_url}
                    alt={currentProduct.name}
                    className="w-20 h-20 object-cover rounded-md"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold">{currentProduct.name}</h4>
                  {currentProduct.description && (
                    <p className="text-sm text-muted-foreground">{currentProduct.description}</p>
                  )}
                  {currentProduct.category && (
                    <Badge variant="outline" className="mt-1">
                      {currentProduct.category}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Configuration Options */}
              {Object.entries(configurationTypes).map(([type, configs]) => (
                <div key={type}>
                  <Label className="text-sm font-medium capitalize">
                    {type.replace('_', ' ')}
                  </Label>
                  <Select
                    value={currentConfiguration[type] || ''}
                    onValueChange={(value) => handleConfigurationChange(type, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Select ${type}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {configs.map((config) => (
                        <SelectItem key={config.id} value={config.option_value}>
                          {config.option_name}
                          {config.price_modifier !== 0 && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              ({config.price_modifier > 0 ? '+' : ''}{formatCurrency(config.price_modifier)})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {/* Quantity */}
              <div>
                <Label className="text-sm font-medium">Quantity</Label>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setCurrentQuantity(Math.max(1, currentQuantity - 1))}
                    disabled={currentQuantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={currentQuantity}
                    onChange={(e) => {
                      const value = e.target.value;
                      const parsed = parseInt(value);
                      console.log('Quantity input change:', { value, parsed, isValidInteger: Number.isInteger(parsed) });
                      setCurrentQuantity(Math.max(1, Number.isInteger(parsed) ? parsed : 1));
                    }}
                    className="w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setCurrentQuantity(currentQuantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Price Summary */}
              <div className="space-y-2 pt-2 border-t">
                <div className="flex justify-between text-sm">
                  <span>Base Price:</span>
                  <span>{formatCurrency(currentProduct.base_price)}</span>
                </div>
                {Object.entries(currentConfiguration).map(([type, value]) => {
                  const configOption = currentProduct.configurations.find(
                    config => config.configuration_type === type && config.option_value === value
                  );
                  if (configOption && configOption.price_modifier !== 0) {
                    return (
                      <div key={type} className="flex justify-between text-sm text-muted-foreground">
                        <span>{configOption.option_name}:</span>
                        <span>
                          {configOption.price_modifier > 0 ? '+' : ''}{formatCurrency(configOption.price_modifier)}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })}
                <div className="flex justify-between font-semibold">
                  <span>Total:</span>
                  <span>{formatCurrency(calculateTotalPrice())}</span>
                </div>
              </div>

              {/* Add Button */}
              <Button
                onClick={handleAddProduct}
                className="w-full"
                type="button"
              >
                {selectedProducts.find(sp => sp.product.id === currentProduct.id) ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          )}

          {filteredProducts.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              {selectedCategory ? 'No products found in this category.' : 'No products available.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Products Summary */}
      {selectedProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Products ({selectedProducts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedProducts.map((sp, index) => (
                <div key={`${sp.product.id}-${index}`} className="flex justify-between items-center p-3 border rounded">
                  <div>
                    <div className="font-medium">{sp.product.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Quantity: {sp.quantity} | Base Price: {formatCurrency(sp.product.base_price)}
                    </div>
                    {Object.entries(sp.configuration).length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {Object.entries(sp.configuration).map(([type, value]) => 
                          `${type}: ${value}`
                        ).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-semibold">
                      {formatCurrency(sp.totalPrice)}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRemoveProduct(sp.product.id)}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between items-center font-semibold text-lg">
                <span>Total:</span>
                <span>{formatCurrency(selectedProducts.reduce((sum, sp) => sum + sp.totalPrice, 0))}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compatible Accessories Section */}
      {selectedCoreProduct && availableAccessories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Compatible Accessories for {products.find(p => p.id === selectedCoreProduct)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableAccessories.map((accessory) => {
                const isSelected = selectedProducts.some(sp => sp.product.id === accessory.id);
                
                return (
                  <div key={accessory.id} className="border rounded-lg p-4 space-y-3">
                    {accessory.images?.find(img => img.is_primary)?.image_url && (
                      <div className="w-full aspect-[4/3] overflow-hidden rounded-md bg-gray-50">
                        <img
                          src={accessory.images.find(img => img.is_primary)?.image_url}
                          alt={accessory.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium">{accessory.name}</h4>
                      {accessory.description && (
                        <p className="text-sm text-muted-foreground mt-1">{accessory.description}</p>
                      )}
                      <div className="text-lg font-semibold mt-2">
                        {formatCurrency(accessory.base_price)}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`accessory-${accessory.id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleAccessoryToggle(accessory, !!checked)}
                      />
                      <Label 
                        htmlFor={`accessory-${accessory.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {isSelected ? 'Added to quote' : 'Add to quote'}
                      </Label>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
