import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Scan, 
  Package, 
  PackageCheck, 
  RotateCcw,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ScanMode = 'receive' | 'consume' | 'return';

export function EngineerScan() {
  const [scanMode, setScanMode] = useState<ScanMode>('receive');
  const [scannedCode, setScannedCode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();

  const scanModes = [
    {
      value: 'receive' as ScanMode,
      label: 'Receive Stock',
      icon: Package,
      description: 'Scan items being delivered to your van',
      color: 'text-green-600'
    },
    {
      value: 'consume' as ScanMode,
      label: 'Install/Consume',
      icon: PackageCheck,
      description: 'Scan items used on jobs',
      color: 'text-blue-600'
    },
    {
      value: 'return' as ScanMode,
      label: 'Return Stock',
      icon: RotateCcw,
      description: 'Scan items being returned to warehouse',
      color: 'text-orange-600'
    }
  ];

  const currentMode = scanModes.find(mode => mode.value === scanMode);

  const handleScan = () => {
    if (!scannedCode.trim()) {
      toast({
        title: "No code entered",
        description: "Please enter or scan a barcode",
        variant: "destructive"
      });
      return;
    }

    // TODO: Implement actual scanning logic
    toast({
      title: "Item scanned successfully",
      description: `${currentMode?.label}: ${scannedCode} (${quantity} units)`,
    });

    // Reset form
    setScannedCode('');
    setQuantity('1');
    setNotes('');
  };

  const handleQuickScan = (code: string) => {
    setScannedCode(code);
  };

  // Mock recent scans for demo
  const recentScans = [
    { code: 'CHG-T2-001', name: 'EV Charger Type 2', action: 'Consumed', time: '10:30 AM' },
    { code: 'CBL-32A-002', name: 'Charging Cable 32A', action: 'Received', time: '09:15 AM' },
    { code: 'MNT-KIT-001', name: 'Mounting Kit', action: 'Consumed', time: '08:45 AM' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Scan Items</h1>
        <p className="text-muted-foreground">
          Scan barcodes to track inventory movements
        </p>
      </div>

      {/* Mode Selection */}
      <div className="grid gap-4 md:grid-cols-3">
        {scanModes.map((mode) => {
          const IconComponent = mode.icon;
          return (
            <Card 
              key={mode.value}
              className={`cursor-pointer transition-all ${
                scanMode === mode.value 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:bg-muted/30'
              }`}
              onClick={() => setScanMode(mode.value)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <IconComponent className={`h-5 w-5 ${mode.color}`} />
                  <span className="font-medium">{mode.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {mode.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Scan Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            {currentMode?.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode / Serial Number</Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                placeholder="Scan or type barcode..."
                className="flex-1"
              />
              <Button onClick={() => {/* TODO: Open camera scanner */}} variant="outline">
                <Scan className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            {scanMode === 'consume' && (
              <div className="space-y-2">
                <Label htmlFor="order">Order (optional)</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order1">ORD-2024-001</SelectItem>
                    <SelectItem value="order2">ORD-2024-002</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
            />
          </div>

          <Button onClick={handleScan} className="w-full">
            {currentMode?.label}
          </Button>
        </CardContent>
      </Card>

      {/* Quick Scan Options */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Scan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => handleQuickScan('CHG-T2-001')}
              className="justify-start"
            >
              CHG-T2-001 - EV Charger Type 2
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickScan('CBL-32A-002')}
              className="justify-start"
            >
              CBL-32A-002 - Charging Cable 32A
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickScan('MNT-KIT-001')}
              className="justify-start"
            >
              MNT-KIT-001 - Mounting Kit
            </Button>
            <Button
              variant="outline"
              onClick={() => handleQuickScan('FUS-20A-001')}
              className="justify-start"
            >
              FUS-20A-001 - 20A Fuse
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Scans */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
        </CardHeader>
        <CardContent>
          {recentScans.length > 0 ? (
            <div className="space-y-3">
              {recentScans.map((scan, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{scan.name}</div>
                    <div className="text-xs text-muted-foreground">{scan.code}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-xs mb-1">
                      {scan.action}
                    </Badge>
                    <div className="text-xs text-muted-foreground">{scan.time}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              No recent scans
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}