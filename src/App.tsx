import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import Layout from '@/components/Layout';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';

// Import pages
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import ClientDashboard from '@/pages/ClientDashboard';
import EngineerDashboard from '@/pages/EngineerDashboard';
import Admin from '@/pages/Admin';
import AdminClients from '@/pages/AdminClients';
import AdminOrders from '@/pages/AdminOrders';
import AdminQuotes from '@/pages/AdminQuotes';
import AdminProducts from '@/pages/AdminProducts';
import AdminEngineers from '@/pages/AdminEngineers';
import AdminUsers from '@/pages/AdminUsers';
import AdminMessages from '@/pages/AdminMessages';
import AdminLeads from '@/pages/AdminLeads';
import AdminSettings from '@/pages/AdminSettings';
import AdminSchedule from '@/pages/AdminSchedule';
import AdminScheduleStatus from '@/pages/AdminScheduleStatus';
import AdminPartners from '@/pages/AdminPartners';
import AdminPartnerProfiles from '@/pages/AdminPartnerProfiles';
import ClientQuotes from '@/pages/ClientQuotes';
import ClientOrders from '@/pages/ClientOrders';
import ClientMessages from '@/pages/ClientMessages';
import ClientDocuments from '@/pages/ClientDocuments';
import ClientPayments from '@/pages/ClientPayments';
import ClientDateBlocking from '@/pages/ClientDateBlocking';
import ClientProfileSelf from '@/pages/ClientProfileSelf';
import ClientQuoteDetail from '@/pages/ClientQuoteDetail';
import AdminQuoteDetail from '@/pages/AdminQuoteDetail';
import AdminQuoteEdit from '@/pages/AdminQuoteEdit';
import AdminQuoteCreate from '@/pages/AdminQuoteCreate';
import EngineerProfile from '@/pages/EngineerProfile';
import EngineerAvailability from '@/pages/EngineerAvailability';
import EngineerJobDetail from '@/pages/EngineerJobDetail';
import NotFound from '@/pages/NotFound';
import SetupPassword from '@/pages/SetupPassword';
import AdminUserDetail from '@/pages/AdminUserDetail';
import AdminUserInvite from '@/pages/AdminUserInvite';
import AdminClientUsers from '@/pages/AdminClientUsers';
import ClientProfilePage from '@/pages/ClientProfilePage';
import PublicQuoteView from '@/pages/PublicQuoteView';
import ClientOfferView from '@/pages/ClientOfferView';
import EnhancedClientOrderView from '@/pages/EnhancedClientOrderView';
import OrderDetail from '@/pages/OrderDetail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppContent />
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { role, loading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/setup-password" element={<SetupPassword />} />
        <Route path="/quote/:shareToken" element={<PublicQuoteView />} />
        <Route path="/offers/:clientToken" element={<ClientOfferView />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        {/* Dashboard Routes */}
        <Route path="/" element={<Dashboard />} />
        
        {/* Client Routes */}
        {role === 'client' && (
          <>
            <Route path="/dashboard" element={<ClientDashboard />} />
            <Route path="/quotes" element={<ClientQuotes />} />
            <Route path="/quotes/:id" element={<ClientQuoteDetail />} />
            <Route path="/orders" element={<ClientOrders />} />
            <Route path="/orders/:id" element={<EnhancedClientOrderView />} />
            <Route path="/messages" element={<ClientMessages />} />
            <Route path="/documents" element={<ClientDocuments />} />
            <Route path="/payments" element={<ClientPayments />} />
            <Route path="/date-blocking" element={<ClientDateBlocking />} />
            <Route path="/profile" element={<ClientProfileSelf />} />
          </>
        )}

        {/* Engineer Routes */}
        {role === 'engineer' && (
          <>
            <Route path="/dashboard" element={<EngineerDashboard />} />
            <Route path="/profile" element={<EngineerProfile />} />
            <Route path="/availability" element={<EngineerAvailability />} />
            <Route path="/jobs/:id" element={<EngineerJobDetail />} />
          </>
        )}

        {/* Admin Routes */}
        {(role === 'admin' || role === 'manager') && (
          <>
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/clients" element={<AdminClients />} />
            <Route path="/admin/clients/:id" element={<ClientProfilePage />} />
            <Route path="/admin/client-users" element={<AdminClientUsers />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/order/:id" element={<OrderDetail />} />
            <Route path="/admin/quotes" element={<AdminQuotes />} />
            <Route path="/admin/quotes/new" element={<AdminQuoteCreate />} />
            <Route path="/admin/quotes/:id" element={<AdminQuoteDetail />} />
            <Route path="/admin/quotes/:id/edit" element={<AdminQuoteEdit />} />
            <Route path="/admin/products" element={<AdminProducts />} />
            <Route path="/admin/engineers" element={<AdminEngineers />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/users/invite" element={<AdminUserInvite />} />
            <Route path="/admin/users/:id" element={<AdminUserDetail />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/leads" element={<AdminLeads />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/schedule" element={<AdminSchedule />} />
            <Route path="/admin/schedule/status" element={<AdminScheduleStatus />} />
            <Route path="/admin/partners" element={<AdminPartners />} />
            <Route path="/admin/partners/:partnerId/profiles" element={<AdminPartnerProfiles />} />
          </>
        )}

        {/* Public Routes */}
        <Route path="/quote/:shareToken" element={<PublicQuoteView />} />
        <Route path="/offers/:clientToken" element={<ClientOfferView />} />
        
        {/* Catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default App;
