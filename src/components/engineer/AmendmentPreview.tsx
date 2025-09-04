import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/currency';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AmendmentItem {
  item_id: string;
  item_name: string;
  item_sku: string;
  old_quantity: number;
  new_quantity: number;
  unit_cost: number;
  old_line_total: number;
  new_line_total: number;
}

interface AmendmentPreviewProps {
  items: AmendmentItem[];
  oldTotal: number;
  newTotal: number;
  poNumber: string;
}

export const AmendmentPreview: React.FC<AmendmentPreviewProps> = ({
  items,
  oldTotal,
  newTotal,
  poNumber
}) => {
  const totalDifference = newTotal - oldTotal;
  const isIncrease = totalDifference > 0;
  const isDecrease = totalDifference < 0;

  const getQuantityChangeIcon = (oldQty: number, newQty: number) => {
    if (newQty > oldQty) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (newQty < oldQty) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getQuantityChangeBadge = (oldQty: number, newQty: number) => {
    const diff = newQty - oldQty;
    if (diff === 0) return null;
    
    return (
      <Badge 
        variant={diff > 0 ? "default" : "destructive"}
        className="ml-2"
      >
        {diff > 0 ? '+' : ''}{diff}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Amendment Preview - {poNumber}</span>
          <div className="flex items-center gap-2">
            {isIncrease && <TrendingUp className="h-5 w-5 text-green-600" />}
            {isDecrease && <TrendingDown className="h-5 w-5 text-red-600" />}
            <span className={`font-bold ${isIncrease ? 'text-green-600' : isDecrease ? 'text-red-600' : 'text-gray-600'}`}>
              {totalDifference !== 0 ? (totalDifference > 0 ? '+' : '') + formatCurrency(totalDifference) : 'No change'}
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Items Changes */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-700">Item Changes</h4>
          {items.map((item) => (
            <div key={item.item_id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {getQuantityChangeIcon(item.old_quantity, item.new_quantity)}
                  <div>
                    <p className="font-medium text-sm">{item.item_name}</p>
                    <p className="text-xs text-gray-500">{item.item_sku}</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Quantity: </span>
                    <span className={item.old_quantity !== item.new_quantity ? 'line-through text-gray-400' : ''}>
                      {item.old_quantity}
                    </span>
                    {item.old_quantity !== item.new_quantity && (
                      <span className="ml-2 font-medium">{item.new_quantity}</span>
                    )}
                    {getQuantityChangeBadge(item.old_quantity, item.new_quantity)}
                  </div>
                  <div>
                    <span className="text-gray-500">Unit Cost: </span>
                    <span className="font-medium">{formatCurrency(item.unit_cost)}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm">
                  {item.old_line_total !== item.new_line_total ? (
                    <>
                      <span className="line-through text-gray-400">{formatCurrency(item.old_line_total)}</span>
                      <br />
                      <span className="font-medium">{formatCurrency(item.new_line_total)}</span>
                    </>
                  ) : (
                    <span className="font-medium">{formatCurrency(item.new_line_total)}</span>
                  )}
                </div>
                {item.old_line_total !== item.new_line_total && (
                  <div className={`text-xs mt-1 ${item.new_line_total > item.old_line_total ? 'text-green-600' : 'text-red-600'}`}>
                    {item.new_line_total > item.old_line_total ? '+' : ''}
                    {formatCurrency(item.new_line_total - item.old_line_total)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        {/* Total Summary */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Current Total:</span>
            <span className={oldTotal !== newTotal ? 'line-through text-gray-400' : 'font-medium'}>
              {formatCurrency(oldTotal)}
            </span>
          </div>
          
          {oldTotal !== newTotal && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">New Total:</span>
              <span className="font-bold text-lg">{formatCurrency(newTotal)}</span>
            </div>
          )}
          
          {totalDifference !== 0 && (
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-medium">Net Change:</span>
              <span className={`font-bold text-lg ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                {isIncrease ? '+' : ''}{formatCurrency(totalDifference)}
              </span>
            </div>
          )}
        </div>

        {/* Warning for significant changes */}
        {Math.abs(totalDifference) > 100 && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Significant Cost Change:</strong> This amendment will {isIncrease ? 'increase' : 'decrease'} the 
              PO total by {formatCurrency(Math.abs(totalDifference))}. Admin approval will be required.
            </p>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Unit costs are preserved from existing PO lines or fetched from inventory defaults</p>
          <p>• Stock adjustments will be created automatically for your van inventory</p>
          <p>• All amendments require admin review before processing</p>
        </div>
      </CardContent>
    </Card>
  );
};