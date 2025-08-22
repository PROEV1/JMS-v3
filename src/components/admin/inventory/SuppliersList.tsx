import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Building, AlertCircle, Edit, Mail, Phone, TrendingUp, Clock, Star } from "lucide-react";
import { AddSupplierModal } from "./AddSupplierModal";
import { EditSupplierModal } from './EditSupplierModal';
import { InventoryKpiTile } from './shared/InventoryKpiTile';
import { StatusChip } from './shared/StatusChip';

interface Supplier {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  contact_name?: string;
}

export function SuppliersList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('inventory_suppliers') // Updated table name
        .select('*')
        .order('name');

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,contact_email.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Supplier[];
    },
  });

  // Header metrics
  const { data: metrics } = useQuery({
    queryKey: ['supplier-metrics'],
    queryFn: async () => {
      if (!suppliers) return null;
      
      const totalSuppliers = suppliers.length;
      const activeSuppliers = suppliers.filter(s => s.is_active).length;
      const openPOs = 0; // Placeholder
      const avgLeadTime = 7; // Placeholder - days
      const otifPercentage = 95; // Placeholder - On-Time In-Full %
      
      return { totalSuppliers, activeSuppliers, openPOs, avgLeadTime, otifPercentage };
    },
    enabled: !!suppliers
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading suppliers...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Suppliers</h2>
          <p className="text-muted-foreground">Manage your supplier relationships and performance</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Supplier
        </Button>
      </div>

      {/* Header Metrics */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-5">
          <InventoryKpiTile
            title="Total Suppliers"
            value={metrics.totalSuppliers}
            icon={Building}
            variant="info"
            subtitle="All suppliers"
          />
          <InventoryKpiTile
            title="Active"
            value={metrics.activeSuppliers}
            icon={Star}
            variant="success"
            subtitle="Currently used"
          />
          <InventoryKpiTile
            title="Open POs"
            value={metrics.openPOs}
            icon={AlertCircle}
            variant="neutral"
            subtitle="Purchase orders"
          />
          <InventoryKpiTile
            title="Avg Lead Time"
            value={metrics.avgLeadTime}
            icon={Clock}
            variant="info"
            subtitle="Days to delivery"
          />
          <InventoryKpiTile
            title="OTIF%"
            value={metrics.otifPercentage}
            icon={TrendingUp}
            variant={metrics.otifPercentage >= 95 ? "success" : "warning"}
            subtitle="On-time in-full"
            percentage={`${metrics.otifPercentage}%`}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Suppliers ({suppliers?.length || 0})
            </CardTitle>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!suppliers || suppliers.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No suppliers found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm ? 'No suppliers match your search criteria.' : 'Get started by adding your first supplier.'}
              </p>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Supplier
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Open POs</TableHead>
                  <TableHead>Avg Lead Time</TableHead>
                  <TableHead>OTIF% (90d)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((supplier) => (
                  <TableRow key={supplier.id}>
                    <TableCell className="font-medium">{supplier.name}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {supplier.contact_email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {supplier.contact_email}
                          </div>
                        )}
                        {supplier.contact_phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {supplier.contact_phone}
                          </div>
                        )}
                        {!supplier.contact_email && !supplier.contact_phone && (
                          <span className="text-muted-foreground text-sm">No contact info</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{supplier.address || "N/A"}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">0</div>
                      <div className="text-xs text-muted-foreground">POs open</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">7 days</div>
                      <div className="text-xs text-muted-foreground">Average</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">95%</div>
                      <div className="text-xs text-muted-foreground">Last 90 days</div>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={supplier.is_active ? "active" : "inactive"}>
                        {supplier.is_active ? "Active" : "Inactive"}
                      </StatusChip>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedSupplier(supplier);
                          setShowEditModal(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddSupplierModal 
        open={showAddModal} 
        onOpenChange={setShowAddModal} 
      />
      
      <EditSupplierModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        supplier={selectedSupplier}
      />
    </div>
  );
}