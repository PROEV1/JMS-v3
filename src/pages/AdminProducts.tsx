
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Edit, Trash2, Eye, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ProductForm } from '@/components/ProductForm';
import { ProSpacesLogo } from '@/components/ProSpacesLogo';

interface Product {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  category: string | null;
  is_active: boolean;
  created_at: string;
  specifications: any;
}

export default function AdminProducts() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleProductStatus = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Product ${product.is_active ? 'deactivated' : 'activated'} successfully`,
      });

      loadProducts();
    } catch (error) {
      console.error('Error updating product status:', error);
      toast({
        title: "Error",
        description: "Failed to update product status",
        variant: "destructive",
      });
    }
  };

  const deleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete "${product.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deleted successfully",
      });

      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (product.category && product.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <ProSpacesLogo variant="main" size="lg" />
        <div className="text-right">
          <p className="text-sm text-muted-foreground">ProSpaces Admin Portal</p>
          <p className="text-xs text-muted-foreground">Product Management</p>
        </div>
      </div>

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl heading-large">Product Management</h1>
          <p className="text-muted-foreground body-text">Manage your product catalog</p>
        </div>
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Product</DialogTitle>
              <DialogDescription>Add a new product to your catalog</DialogDescription>
            </DialogHeader>
            <ProductForm
              onSuccess={() => {
                setShowCreateModal(false);
                loadProducts();
              }}
              onCancel={() => setShowCreateModal(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Card */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-secondary/20 rounded-full border border-secondary/30">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-semibold heading-semibold">{products.length}</p>
              <p className="text-sm text-muted-foreground body-text">
                Total Products ({products.filter(p => p.is_active).length} active)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Products Table */}
      <Card className="border-border">
        <CardHeader className="bg-muted/30">
          <CardTitle className="heading-semibold">Products</CardTitle>
          <CardDescription className="body-text">Manage your product catalog</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.category ? (
                      <Badge variant="outline">{product.category}</Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{formatCurrency(product.base_price)}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={product.is_active ? "default" : "secondary"}
                      className={product.is_active ? "bg-green-500" : ""}
                    >
                      {product.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(product.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingProduct(product)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleProductStatus(product)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {product.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteProduct(product)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {searchTerm ? 'No products found matching your search.' : 'No products found. Create your first product to get started.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Product Modal */}
      {editingProduct && (
        <Dialog open={!!editingProduct} onOpenChange={() => setEditingProduct(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Product</DialogTitle>
              <DialogDescription>Update product information</DialogDescription>
            </DialogHeader>
            <ProductForm
              product={editingProduct}
              onSuccess={() => {
                setEditingProduct(null);
                loadProducts();
              }}
              onCancel={() => setEditingProduct(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
