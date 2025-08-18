import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';

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

// New partner pages
import AdminPartners from '@/pages/AdminPartners';
import AdminPartnerProfiles from '@/pages/AdminPartnerProfiles';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/client-users" element={<AdminClientUsers />} />
          <Route path="/admin/clients" element={<AdminClients />} />
          <Route path="/admin/engineers" element={<AdminEngineers />} />
          <Route path="/admin/leads" element={<AdminLeads />} />
          <Route path="/admin/messages" element={<AdminMessages />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/orders/:id" element={<OrderDetail />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/quotes" element={<AdminQuotes />} />
          <Route path="/admin/quotes/create" element={<AdminQuoteCreate />} />
          <Route path="/admin/quotes/:id" element={<AdminQuoteDetail />} />
          <Route path="/admin/quotes/:id/edit" element={<AdminQuoteEdit />} />
          <Route path="/admin/schedule" element={<AdminSchedule />} />
          <Route path="/admin/schedule/status" element={<AdminScheduleStatus />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/users/:id" element={<AdminUserDetail />} />
          <Route path="/admin/users/invite" element={<AdminUserInvite />} />
          
          {/* Partner management routes */}
          <Route path="/admin/partners" element={<AdminPartners />} />
          <Route path="/admin/partners/:partnerId/profiles" element={<AdminPartnerProfiles />} />
          
          <Route path="/auth" element={<Auth />} />
          <Route path="/setup-password" element={<SetupPassword />} />
          
          <Route path="/client/dashboard" element={<ClientDashboard />} />
          <Route path="/client/date-blocking" element={<ClientDateBlocking />} />
          <Route path="/client/documents" element={<ClientDocuments />} />
          <Route path="/client/messages" element={<ClientMessages />} />
          <Route path="/client/offer/:id" element={<ClientOfferView />} />
          <Route path="/client/orders" element={<ClientOrders />} />
          <Route path="/client/orders/:id" element={<EnhancedClientOrderView />} />
          <Route path="/client/payments" element={<ClientPayments />} />
          <Route path="/client/profile" element={<ClientProfileSelf />} />
          <Route path="/client/profile/:id" element={<ClientProfilePage />} />
          <Route path="/client/quotes" element={<ClientQuotes />} />
          <Route path="/client/quotes/:id" element={<ClientQuoteDetail />} />
          
          <Route path="/engineer/availability" element={<EngineerAvailability />} />
          <Route path="/engineer/dashboard" element={<EngineerDashboard />} />
          <Route path="/engineer/jobs/:id" element={<EngineerJobDetail />} />
          <Route path="/engineer/profile" element={<EngineerProfile />} />
          
          <Route path="/quote/:id" element={<PublicQuoteView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
