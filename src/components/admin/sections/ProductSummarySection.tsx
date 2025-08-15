import { useState, useEffect } from "react";
import { OrderSection } from "../OrderSectionLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProductLibraryModal } from "../ProductLibraryModal";
import { 
  Package, 
  Edit3,
  Plus,
  Trash2,
  Calculator
} from "lucide-react";

interface ProductSummaryProps {
  order: {
    id: string;
    total_amount: number;
    quote: {
      id: string;
      quote_items: Array<{
        id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
        total_price: number;
        configuration: Record<string, string>;
      }>;
    };
  };
  onUpdate: () => void;
}

interface Product {
  id: string;
  name: string;
  base_price: number;
  category: string;
  description: string;
}

export function ProductSummarySection({ order, onUpdate }: ProductSummaryProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showProductLibrary, setShowProductLibrary] = useState(false);

  useEffect(() => {
    if (isEditing) {
      fetchProducts();
    }
  }, [isEditing]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const formatConfiguration = (config: Record<string, string>) => {
    if (!config || Object.keys(config).length === 0) return null;
    
    return Object.entries(config)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  const calculateOrderTotal = () => {
    return order.quote.quote_items.reduce((total, item) => total + item.total_price, 0);
  };

  const handleRecalculateOrder = async () => {
    setIsLoading(true);
    try {
      const newTotal = calculateOrderTotal();
      
      // Update the order total
      const { error: orderError } = await supabase
        .from('orders')
        .update({ total_amount: newTotal })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Update the quote total
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({ total_cost: newTotal })
        .eq('id', order.quote.id);

      if (quoteError) throw quoteError;

      toast({
        title: "Order Updated",
        description: `Order total recalculated to ${formatCurrency(newTotal)}`,
      });

      onUpdate();
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Error",
        description: "Failed to update order totals",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this item from the order?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('quote_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Item Removed",
        description: "Product has been removed from the order",
      });

      onUpdate();
    } catch (error) {
      console.error('Error removing item:', error);
      toast({
        title: "Error",
        description: "Failed to remove item",
        variant: "destructive",
      });
    }
  };

  return (
    <OrderSection 
      id="products" 
      title="Product Summary" 
      icon={Package} 
      defaultOpen={true}
    >
      <div className="space-y-4">
        {/* Header with edit toggle */}
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Order Items ({order.quote.quote_items.length})</h4>
          <div className="flex gap-2">
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Products
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleRecalculateOrder} disabled={isLoading}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Recalculate
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Product Items */}
        <div className="space-y-3">
          {order.quote.quote_items.map((item, index) => (
            <Card key={item.id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h5 className="font-medium">{item.product_name}</h5>
                      <Badge variant="outline">Qty: {item.quantity}</Badge>
                    </div>
                    
                    {formatConfiguration(item.configuration) && (
                      <div className="text-sm text-muted-foreground mb-2">
                        {formatConfiguration(item.configuration)}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Unit Price: {formatCurrency(item.unit_price)}
                      </span>
                      <span className="font-semibold">
                        Total: {formatCurrency(item.total_price)}
                      </span>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add New Product */}
        {isEditing && (
          <div className="pt-4 border-t">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowProductLibrary(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Product from Library
            </Button>
          </div>
        )}

        <ProductLibraryModal
          isOpen={showProductLibrary}
          onClose={() => setShowProductLibrary(false)}
          quoteId={order.quote.id}
          onProductAdded={onUpdate}
        />

        {/* Order Total */}
        <div className="pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="font-medium">Order Total</span>
            <span className="text-xl font-bold">{formatCurrency(order.total_amount)}</span>
          </div>
          
          {calculateOrderTotal() !== order.total_amount && (
            <div className="text-sm text-orange-600 mt-1">
              ⚠️ Item total ({formatCurrency(calculateOrderTotal())}) doesn't match order total. 
              Click "Recalculate" to update.
            </div>
          )}
        </div>
      </div>
    </OrderSection>
  );
}