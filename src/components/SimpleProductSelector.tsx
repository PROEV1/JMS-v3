import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  category: string | null;
}

interface SelectedProduct {
  product: Product;
  quantity: number;
  totalPrice: number;
}

interface SimpleProductSelectorProps {
  selectedProducts: SelectedProduct[];
  onSelectionChange: (products: SelectedProduct[]) => void;
}

export const SimpleProductSelector: React.FC<SimpleProductSelectorProps> = ({
  selectedProducts,
  onSelectionChange
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, base_price, category')
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

  const handleAddProduct = () => {
    if (!selectedProductId || quantity <= 0) return;

    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    // Check if product already selected
    const existingIndex = selectedProducts.findIndex(sp => sp.product.id === product.id);
    let updatedProducts;

    const newSelection: SelectedProduct = {
      product,
      quantity,
      totalPrice: product.base_price * quantity
    };

    if (existingIndex >= 0) {
      // Update existing
      updatedProducts = [...selectedProducts];
      updatedProducts[existingIndex] = newSelection;
    } else {
      // Add new
      updatedProducts = [...selectedProducts, newSelection];
    }

    onSelectionChange(updatedProducts);
    setSelectedProductId('');
    setQuantity(1);
  };

  const handleRemoveProduct = (productId: string) => {
    const updatedProducts = selectedProducts.filter(sp => sp.product.id !== productId);
    onSelectionChange(updatedProducts);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  if (loading) {
    return <div className="text-center py-4">Loading products...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Product Selection Form */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-2">
          <Label>Select Product</Label>
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a product..." />
            </SelectTrigger>
            <SelectContent>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} - {formatCurrency(product.base_price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Quantity</Label>
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
        </div>
        
        <Button onClick={handleAddProduct} disabled={!selectedProductId}>
          Add Product
        </Button>
      </div>

      {/* Selected Products List */}
      {selectedProducts.length > 0 && (
        <div className="space-y-2">
          <Label>Selected Products:</Label>
          {selectedProducts.map((selectedProduct) => (
            <Card key={selectedProduct.product.id}>
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedProduct.product.name}</span>
                      <Badge variant="outline">Qty: {selectedProduct.quantity}</Badge>
                    </div>
                    {selectedProduct.product.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedProduct.product.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(selectedProduct.totalPrice)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveProduct(selectedProduct.product.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};