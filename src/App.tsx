import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/useAuth';

// Existing pages
import Dashboard from '@/pages/Dashboard';
import Admin from '@/pages/Admin';
import AdminClientUsers from '@/pages/AdminClientUsers';
import AdminClients from '@/pages/AdminClients';
import AdminEngineers from '@/pages/AdminEngineers';
import AdminLeads from '@/pages/AdminLeads';
import AdminMessages from '@/pages/AdminMessages';
import AdminOrders from '@/pages/AdminOrders';
import AdminProducts from '@/pages/AdminProducts';
import AdminQuoteCreate from '@/pages/AdminQuoteCreate';
import AdminQuoteDetail from '@/pages/AdminQuoteDetail';
import AdminQuoteEdit from '@/pages/AdminQuoteEdit';
import AdminQuotes from '@/pages/AdminQuotes';
import AdminSchedule from '@/pages/AdminSchedule';
import AdminScheduleStatus from '@/pages/AdminScheduleStatus';
import AdminSettings from '@/pages/AdminSettings';
import AdminUserDetail from '@/pages/AdminUserDetail';
import AdminUserInvite from '@/pages/AdminUserInvite';
import AdminUsers from '@/pages/AdminUsers';
import Auth from '@/pages/Auth';
import ClientDashboard from '@/pages/ClientDashboard';
import ClientDateBlocking from '@/pages/ClientDateBlocking';
import ClientDocuments from '@/pages/ClientDocuments';
import ClientMessages from '@/pages/ClientMessages';
import ClientOfferView from '@/pages/ClientOfferView';
import ClientOrders from '@/pages/ClientOrders';
import ClientPayments from '@/pages/ClientPayments';
import ClientProfilePage from '@/pages/ClientProfilePage';
import ClientProfileSelf from '@/pages/ClientProfileSelf';
import ClientQuoteDetail from '@/pages/ClientQuoteDetail';
import ClientQuotes from '@/pages/ClientQuotes';
import EngineerAvailability from '@/pages/EngineerAvailability';
import EngineerDashboard from '@/pages/EngineerDashboard';
import EngineerJobDetail from '@/pages/EngineerJobDetail';
import EngineerProfile from '@/pages/EngineerProfile';
import EnhancedClientOrderView from '@/pages/EnhancedClientOrderView';
import NotFound from '@/pages/NotFound';
import OrderDetail from '@/pages/OrderDetail';
import PublicQuoteView from '@/pages/PublicQuoteView';
import SetupPassword from '@/pages/SetupPassword';

// Layout component
import Layout from '@/components/Layout';

// New partner pages
import AdminPartners from '@/pages/AdminPartners';
import AdminPartnerProfiles from '@/pages/AdminPartnerProfiles';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/setup-password" element={<SetupPassword />} />
          <Route path="/quote/:id" element={<PublicQuoteView />} />
          
          {/* Protected routes with layout */}
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/admin" element={<Layout><Admin /></Layout>} />
          <Route path="/admin/client-users" element={<Layout><AdminClientUsers /></Layout>} />
          <Route path="/admin/clients" element={<Layout><AdminClients /></Layout>} />
          <Route path="/admin/engineers" element={<Layout><AdminEngineers /></Layout>} />
          <Route path="/admin/leads" element={<Layout><AdminLeads /></Layout>} />
          <Route path="/admin/messages" element={<Layout><AdminMessages /></Layout>} />
          <Route path="/admin/orders" element={<Layout><AdminOrders /></Layout>} />
          <Route path="/admin/orders/:id" element={<Layout><OrderDetail /></Layout>} />
          <Route path="/admin/products" element={<Layout><AdminProducts /></Layout>} />
          <Route path="/admin/quotes" element={<Layout><AdminQuotes /></Layout>} />
          <Route path="/admin/quotes/create" element={<Layout><AdminQuoteCreate /></Layout>} />
          <Route path="/admin/quotes/:id" element={<Layout><AdminQuoteDetail /></Layout>} />
          <Route path="/admin/quotes/:id/edit" element={<Layout><AdminQuoteEdit /></Layout>} />
          <Route path="/admin/schedule" element={<Layout><AdminSchedule /></Layout>} />
          <Route path="/admin/schedule/status" element={<Layout><AdminScheduleStatus /></Layout>} />
          <Route path="/admin/settings" element={<Layout><AdminSettings /></Layout>} />
          <Route path="/admin/users" element={<Layout><AdminUsers /></Layout>} />
          <Route path="/admin/users/:id" element={<Layout><AdminUserDetail /></Layout>} />
          <Route path="/admin/users/invite" element={<Layout><AdminUserInvite /></Layout>} />
          
          {/* Partner management routes */}
          <Route path="/admin/partners" element={<Layout><AdminPartners /></Layout>} />
          <Route path="/admin/partners/:partnerId/profiles" element={<Layout><AdminPartnerProfiles /></Layout>} />
          
          <Route path="/client/dashboard" element={<Layout><ClientDashboard /></Layout>} />
          <Route path="/client/date-blocking" element={<Layout><ClientDateBlocking /></Layout>} />
          <Route path="/client/documents" element={<Layout><ClientDocuments /></Layout>} />
          <Route path="/client/messages" element={<Layout><ClientMessages /></Layout>} />
          <Route path="/client/offer/:id" element={<Layout><ClientOfferView /></Layout>} />
          <Route path="/client/orders" element={<Layout><ClientOrders /></Layout>} />
          <Route path="/client/orders/:id" element={<Layout><EnhancedClientOrderView /></Layout>} />
          <Route path="/client/payments" element={<Layout><ClientPayments /></Layout>} />
          <Route path="/client/profile" element={<Layout><ClientProfileSelf /></Layout>} />
          <Route path="/client/profile/:id" element={<Layout><ClientProfilePage /></Layout>} />
          <Route path="/client/quotes" element={<Layout><ClientQuotes /></Layout>} />
          <Route path="/client/quotes/:id" element={<Layout><ClientQuoteDetail /></Layout>} />
          
          <Route path="/engineer/availability" element={<Layout><EngineerAvailability /></Layout>} />
          <Route path="/engineer/dashboard" element={<Layout><EngineerDashboard /></Layout>} />
          <Route path="/engineer/jobs/:id" element={<Layout><EngineerJobDetail /></Layout>} />
          <Route path="/engineer/profile" element={<Layout><EngineerProfile /></Layout>} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
