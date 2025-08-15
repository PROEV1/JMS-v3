import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus } from "lucide-react";

interface Product {
  id: string;
  name: string;
  base_price: number;
  category: string;
  description: string;
}

interface ProductLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  onProductAdded: () => void;
}

export function ProductLibraryModal({ isOpen, onClose, quoteId, onProductAdded }: ProductLibraryModalProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProducts();
    }
  }, [isOpen]);

  useEffect(() => {
    filterProducts();
  }, [products, searchTerm, categoryFilter]);

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
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    }
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    setFilteredProducts(filtered);
  };

  const getCategories = () => {
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    return categories;
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, quantity)
    }));
  };

  const addProductToQuote = async (product: Product) => {
    const quantity = quantities[product.id] || 1;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('quote_items')
        .insert({
          quote_id: quoteId,
          product_id: product.id,
          product_name: product.name,
          quantity: quantity,
          unit_price: product.base_price,
          total_price: product.base_price * quantity,
          configuration: {}
        });

      if (error) throw error;

      toast({
        title: "Product Added",
        description: `${product.name} has been added to the quote`,
      });

      onProductAdded();
      onClose();
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: "Error",
        description: "Failed to add product to quote",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Product from Library</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {getCategories().map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Products Grid */}
          <div className="overflow-y-auto max-h-[50vh] space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No products found matching your criteria
              </div>
            ) : (
              filteredProducts.map((product) => (
                <Card key={product.id} className="p-4">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{product.name}</h3>
                          {product.category && (
                            <Badge variant="outline">{product.category}</Badge>
                          )}
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mb-2">{product.description}</p>
                        )}
                        <p className="font-semibold">{formatCurrency(product.base_price)}</p>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={quantities[product.id] || 1}
                          onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                        <Button
                          onClick={() => addProductToQuote(product)}
                          disabled={loading}
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}