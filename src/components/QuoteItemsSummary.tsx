
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface SelectedProduct {
  product: {
    id: string;
    name: string;
    description: string | null;
    base_price: number;
    category: string | null;
    images: Array<{
      image_url: string;
      image_name: string;
      is_primary: boolean;
    }>;
  };
  quantity: number;
  configuration: Record<string, string>;
  totalPrice: number;
}

interface QuoteItemsSummaryProps {
  selectedProducts: SelectedProduct[];
}

export const QuoteItemsSummary: React.FC<QuoteItemsSummaryProps> = ({ selectedProducts }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const getTotalMaterialsCost = () => {
    return selectedProducts.reduce((total, item) => total + item.totalPrice, 0);
  };

  if (selectedProducts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">No products selected</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quote Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedProducts.map((item, index) => {
          const primaryImage = item.product.images?.find(img => img.is_primary)?.image_url || 
                              item.product.images?.[0]?.image_url;

          return (
            <div key={index} className="space-y-3">
              <div className="flex space-x-3">
                {primaryImage && (
                  <img
                    src={primaryImage}
                    alt={item.product.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium">{item.product.name}</h4>
                  {item.product.category && (
                    <Badge variant="outline" className="mt-1">
                      {item.product.category}
                    </Badge>
                  )}
                  
                  {/* Configuration Details */}
                  {Object.keys(item.configuration).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(item.configuration).map(([key, value]) => (
                        <div key={key} className="text-sm text-muted-foreground">
                          <span className="capitalize">{key.replace('_', ' ')}: </span>
                          <span>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-muted-foreground">
                      Quantity: {item.quantity}
                    </span>
                    <span className="font-medium">
                      {formatCurrency(item.totalPrice)}
                    </span>
                  </div>
                </div>
              </div>
              {index < selectedProducts.length - 1 && <Separator />}
            </div>
          );
        })}
        
        <Separator />
        
        <div className="flex justify-between items-center font-semibold text-lg">
          <span>Materials Total:</span>
          <span>{formatCurrency(getTotalMaterialsCost())}</span>
        </div>
      </CardContent>
    </Card>
  );
};
