
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, X } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  category: string | null;
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

interface ProductCardProps {
  product: Product;
  selectedProduct?: SelectedProduct;
  onSelect: (product: Product, quantity: number, configuration: Record<string, string>) => void;
  onRemove: (productId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  selectedProduct,
  onSelect,
  onRemove
}) => {
  const [quantity, setQuantity] = useState(selectedProduct?.quantity || 1);
  const [configuration, setConfiguration] = useState<Record<string, string>>(
    selectedProduct?.configuration || {}
  );

  const primaryImage = product.images?.find(img => img.is_primary)?.image_url || 
                      product.images?.[0]?.image_url;

  // Group configurations by type
  const configurationTypes = product.configurations.reduce((acc, config) => {
    if (!acc[config.configuration_type]) {
      acc[config.configuration_type] = [];
    }
    acc[config.configuration_type].push(config);
    return acc;
  }, {} as Record<string, typeof product.configurations>);

  // Set default configurations
  React.useEffect(() => {
    const defaultConfig = { ...configuration };
    Object.entries(configurationTypes).forEach(([type, configs]) => {
      if (!defaultConfig[type]) {
        const defaultOption = configs.find(c => c.is_default);
        if (defaultOption) {
          defaultConfig[type] = defaultOption.option_value;
        }
      }
    });
    if (Object.keys(defaultConfig).length !== Object.keys(configuration).length) {
      setConfiguration(defaultConfig);
    }
  }, [product.configurations]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const calculateTotalPrice = () => {
    let total = product.base_price * quantity;
    Object.entries(configuration).forEach(([configType, selectedValue]) => {
      const configOption = product.configurations.find(
        config => config.configuration_type === configType && config.option_value === selectedValue
      );
      if (configOption) {
        total += configOption.price_modifier * quantity;
      }
    });
    return total;
  };

  const handleConfigurationChange = (type: string, value: string) => {
    const newConfiguration = { ...configuration, [type]: value };
    setConfiguration(newConfiguration);
    if (selectedProduct) {
      onSelect(product, quantity, newConfiguration);
    }
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1) {
      setQuantity(newQuantity);
      if (selectedProduct) {
        onSelect(product, newQuantity, configuration);
      }
    }
  };

  const handleAddToQuote = () => {
    onSelect(product, quantity, configuration);
  };

  const handleRemoveFromQuote = () => {
    onRemove(product.id);
  };

  const isSelected = !!selectedProduct;

  return (
    <Card className={`transition-all ${isSelected ? 'ring-2 ring-primary border-primary' : ''}`}>
      <CardHeader className="pb-4">
        <div className="relative">
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={product.name}
              className="w-full h-48 object-cover rounded-md"
            />
          ) : (
            <div className="w-full h-48 bg-gray-100 rounded-md flex items-center justify-center">
              <span className="text-gray-400">No image</span>
            </div>
          )}
          {isSelected && (
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleRemoveFromQuote}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div>
          <CardTitle className="text-lg">{product.name}</CardTitle>
          {product.description && (
            <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
          )}
          {product.category && (
            <Badge variant="outline" className="mt-2">
              {product.category}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Configuration Options */}
        {Object.entries(configurationTypes).map(([type, configs]) => (
          <div key={type} className="space-y-2">
            <Label className="text-sm font-medium capitalize">
              {type.replace('_', ' ')}
            </Label>
            <Select
              value={configuration[type] || ''}
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

        {/* Quantity Selector */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quantity</Label>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuantityChange(quantity - 1)}
              disabled={quantity <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
              className="w-20 text-center"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuantityChange(quantity + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Pricing */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex justify-between text-sm">
            <span>Base Price:</span>
            <span>{formatCurrency(product.base_price)}</span>
          </div>
          {Object.entries(configuration).map(([type, value]) => {
            const configOption = product.configurations.find(
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

        {/* Add/Update Button */}
        <Button
          onClick={isSelected ? () => onSelect(product, quantity, configuration) : handleAddToQuote}
          className="w-full"
          variant={isSelected ? "outline" : "default"}
        >
          {isSelected ? 'Update Selection' : 'Add to Quote'}
        </Button>
      </CardContent>
    </Card>
  );
};
