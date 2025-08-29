import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Download, ArrowUpRight, ArrowDownRight, RotateCcw, TrendingUp, Calendar, User } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';

interface Transaction {
  id: string;
  item_id: string;
  location_id: string;
  direction: 'in' | 'out' | 'adjust';
  qty: number;
  reference: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  inventory_items: {
    name: string;
    sku: string;
  };
  inventory_locations: {
    name: string;
  };
}

const directionIcons = {
  in: ArrowDownRight,
  out: ArrowUpRight,
  adjust: RotateCcw
};

const directionColors = {
  in: 'approved' as const,
  out: 'cancelled' as const,
  adjust: 'submitted' as const
};

export function TransactionsListV2() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case '7': return { start: subDays(now, 7), end: now };
      case '30': return { start: subDays(now, 30), end: now };
      case '90': return { start: subDays(now, 90), end: now };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      default: return { start: subDays(now, 30), end: now };
    }
  };

  const { start: startDate, end: endDate } = getDateRange();

  // Fetch transactions
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['inventory-transactions', searchTerm, typeFilter, locationFilter, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('inventory_txns')
        .select(`
          *,
          inventory_items(name, sku),
          inventory_locations(name)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (typeFilter !== 'all') {
        query = query.eq('direction', typeFilter);
      }

      if (locationFilter !== 'all') {
        query = query.eq('location_id', locationFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Transaction[];
    }
  });

  // Fetch locations for filter
  const { data: locations } = useQuery({
    queryKey: ['inventory-locations-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_locations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  // Calculate metrics
  const { data: metrics } = useQuery({
    queryKey: ['transaction-metrics', dateRange],
    queryFn: async () => {
      if (!transactions) return null;

      const totalTransactions = transactions.length;
      const inbound = transactions.filter(t => t.direction === 'in').length;
      const outbound = transactions.filter(t => t.direction === 'out').length;
      const adjustments = transactions.filter(t => t.direction === 'adjust').length;
      
      // Calculate total value moved (simplified)
      const totalValue = transactions.reduce((sum, t) => sum + Math.abs(t.qty), 0);

      return {
        totalTransactions,
        inbound,
        outbound,
        adjustments,
        totalValue
      };
    },
    enabled: !!transactions
  });

  const filteredTransactions = transactions?.filter(transaction => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      transaction.inventory_items.name.toLowerCase().includes(searchLower) ||
      transaction.inventory_items.sku.toLowerCase().includes(searchLower) ||
      transaction.inventory_locations.name.toLowerCase().includes(searchLower) ||
      transaction.reference?.toLowerCase().includes(searchLower) ||
      transaction.notes?.toLowerCase().includes(searchLower)
    );
  });

  const handleExportCSV = () => {
    if (!filteredTransactions?.length) return;

    const headers = ['Date', 'Type', 'Item', 'SKU', 'Location', 'Quantity', 'Reference', 'Notes', 'User'];
    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(t => [
        format(new Date(t.created_at), 'yyyy-MM-dd HH:mm'),
        t.direction,
        `"${t.inventory_items.name}"`,
        t.inventory_items.sku,
        `"${t.inventory_locations.name}"`,
        t.direction === 'out' ? -t.qty : t.qty,
        `"${t.reference || ''}"`,
        `"${t.notes || ''}"`,
        t.created_by || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_transactions_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Inventory Transactions</h2>
          <p className="text-muted-foreground">
            Track all inventory movements and adjustments
          </p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-5">
          <InventoryKpiTile
            title="Total Transactions"
            value={metrics.totalTransactions}
            icon={TrendingUp}
            variant="info"
            subtitle={`Last ${dateRange} days`}
          />
          <InventoryKpiTile
            title="Inbound"
            value={metrics.inbound}
            icon={ArrowDownRight}
            variant="success"
            subtitle="Stock received"
          />
          <InventoryKpiTile
            title="Outbound"
            value={metrics.outbound}
            icon={ArrowUpRight}
            variant="danger"
            subtitle="Stock consumed"
          />
          <InventoryKpiTile
            title="Adjustments"
            value={metrics.adjustments}
            icon={RotateCcw}
            variant="warning"
            subtitle="Stock corrections"
          />
          <InventoryKpiTile
            title="Total Units"
            value={metrics.totalValue}
            icon={TrendingUp}
            variant="neutral"
            subtitle="Units moved"
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="month">This month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="in">Inbound</SelectItem>
                  <SelectItem value="out">Outbound</SelectItem>
                  <SelectItem value="adjust">Adjustments</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Location</label>
              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations?.map(location => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                {filteredTransactions?.length || 0} transactions
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions?.map((transaction) => {
                const DirectionIcon = directionIcons[transaction.direction];
                const signedQty = transaction.direction === 'out' ? -transaction.qty : transaction.qty;
                
                return (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(transaction.created_at), 'MMM d, yyyy')}
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(transaction.created_at), 'HH:mm')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={directionColors[transaction.direction]}>
                        <DirectionIcon className="h-3 w-3 mr-1" />
                        {transaction.direction}
                      </StatusChip>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{transaction.inventory_items.name}</div>
                        <div className="text-xs text-muted-foreground">{transaction.inventory_items.sku}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {transaction.inventory_locations.name}
                    </TableCell>
                    <TableCell>
                      <span className={`font-medium ${
                        transaction.direction === 'out' ? 'text-red-600' : 
                        transaction.direction === 'in' ? 'text-green-600' : 
                        'text-blue-600'
                      }`}>
                        {signedQty > 0 ? '+' : ''}{signedQty}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.reference || '-'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.notes || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <User className="h-3 w-3" />
                        {transaction.created_by || 'System'}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filteredTransactions?.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No transactions found</h3>
              <p className="text-sm">
                {searchTerm || typeFilter !== 'all' || locationFilter !== 'all'
                  ? "Try adjusting your search criteria"
                  : "No transactions in the selected date range"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}