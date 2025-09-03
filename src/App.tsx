
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { RootRedirect } from '@/components/RootRedirect';
import Dashboard from '@/pages/Dashboard';
import AdminQuotes from '@/pages/AdminQuotes';
import AdminQuoteCreate from '@/pages/AdminQuoteCreate';
import AdminQuoteDetail from '@/pages/AdminQuoteDetail';
import AdminOrders from '@/pages/AdminOrders';
import OrderDetail from '@/pages/OrderDetail';
import AdminClients from '@/pages/AdminClients';
import AdminEngineers from '@/pages/AdminEngineers';
import AdminUsers from '@/pages/AdminUsers';
import AdminUserInvite from '@/pages/AdminUserInvite';
import AdminUserDetail from '@/pages/AdminUserDetail';
import AdminSettings from '@/pages/AdminSettings';
import AdminLeads from '@/pages/AdminLeads';
import AdminProducts from '@/pages/AdminProducts';
import AdminInventory from '@/pages/AdminInventory';
import AdminSurveyForms from '@/pages/AdminSurveyForms';
import AdminChargers from '@/pages/AdminChargers';
import AdminPartners from '@/pages/AdminPartners';
import AdminPartnerProfiles from '@/pages/AdminPartnerProfiles';
import AdminPartnerUsers from '@/pages/AdminPartnerUsers';
import PublicQuoteView from '@/pages/PublicQuoteView';
import AdminSchedule from '@/pages/AdminSchedule';
import AdminScheduleStatus from '@/pages/AdminScheduleStatus';
import EngineerAvailability from '@/pages/EngineerAvailability';
import EngineerProfile from '@/pages/EngineerProfile';
import AdminMessages from '@/pages/AdminMessages';
import AdminPartnerQuotes from '@/pages/AdminPartnerQuotes';
import Auth from '@/pages/Auth';
import Layout from '@/components/Layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import ClientDashboard from '@/pages/ClientDashboard';
import ClientQuotes from '@/pages/ClientQuotes';
import ClientOrders from '@/pages/ClientOrders';
import ClientMessages from '@/pages/ClientMessages';
import ClientPayments from '@/pages/ClientPayments';
import ClientProfilePage from '@/pages/ClientProfilePage';

function App() {
  return (
    <Router>
      <Toaster />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/quote/:token" element={<PublicQuoteView />} />
        
        {/* Client Routes */}
        <Route path="/client" element={<ProtectedRoute><Layout><ClientDashboard /></Layout></ProtectedRoute>} />
        <Route path="/client/quotes" element={<ProtectedRoute><Layout><ClientQuotes /></Layout></ProtectedRoute>} />
        <Route path="/client/orders" element={<ProtectedRoute><Layout><ClientOrders /></Layout></ProtectedRoute>} />
        <Route path="/client/messages" element={<ProtectedRoute><Layout><ClientMessages /></Layout></ProtectedRoute>} />
        <Route path="/client/payments" element={<ProtectedRoute><Layout><ClientPayments /></Layout></ProtectedRoute>} />
        <Route path="/client/profile" element={<ProtectedRoute><Layout><ClientProfilePage /></Layout></ProtectedRoute>} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/admin/quotes" element={<ProtectedRoute><Layout><AdminQuotes /></Layout></ProtectedRoute>} />
        <Route path="/admin/quotes/create" element={<ProtectedRoute><Layout><AdminQuoteCreate /></Layout></ProtectedRoute>} />
        <Route path="/admin/quotes/:id" element={<ProtectedRoute><Layout><AdminQuoteDetail /></Layout></ProtectedRoute>} />
        <Route path="/admin/orders" element={<ProtectedRoute><Layout><AdminOrders /></Layout></ProtectedRoute>} />
        <Route path="/admin/orders/:id" element={<ProtectedRoute><Layout><OrderDetail /></Layout></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><Layout><OrderDetail /></Layout></ProtectedRoute>} />
        <Route path="/admin/clients" element={<ProtectedRoute><Layout><AdminClients /></Layout></ProtectedRoute>} />
        <Route path="/admin/leads" element={<ProtectedRoute><Layout><AdminLeads /></Layout></ProtectedRoute>} />
        <Route path="/admin/products" element={<ProtectedRoute><Layout><AdminProducts /></Layout></ProtectedRoute>} />
        <Route path="/admin/inventory" element={<ProtectedRoute><Layout><AdminInventory /></Layout></ProtectedRoute>} />
        <Route path="/admin/survey-forms" element={<ProtectedRoute><Layout><AdminSurveyForms /></Layout></ProtectedRoute>} />
        <Route path="/admin/chargers" element={<ProtectedRoute><Layout><AdminChargers /></Layout></ProtectedRoute>} />
        <Route path="/admin/partners" element={<ProtectedRoute><Layout><AdminPartners /></Layout></ProtectedRoute>} />
        <Route path="/admin/partners/:id/users" element={<ProtectedRoute><Layout><AdminPartnerUsers /></Layout></ProtectedRoute>} />
        <Route path="/admin/partners/:id/profiles" element={<ProtectedRoute><Layout><AdminPartnerProfiles /></Layout></ProtectedRoute>} />
        <Route path="/admin/engineers" element={<ProtectedRoute><Layout><AdminEngineers /></Layout></ProtectedRoute>} />
        <Route path="/admin/engineers/:id" element={<ProtectedRoute><Layout><EngineerProfile /></Layout></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><Layout><AdminUsers /></Layout></ProtectedRoute>} />
        <Route path="/admin/users/new" element={<ProtectedRoute><Layout><AdminUserInvite /></Layout></ProtectedRoute>} />
        <Route path="/admin/users/:id" element={<ProtectedRoute><Layout><AdminUserDetail /></Layout></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute><Layout><AdminSettings /></Layout></ProtectedRoute>} />
        <Route path="/admin/schedule" element={<ProtectedRoute><Layout><AdminSchedule /></Layout></ProtectedRoute>} />
        <Route path="/admin/schedule/status/:status" element={<ProtectedRoute><Layout><AdminScheduleStatus /></Layout></ProtectedRoute>} />
        <Route path="/admin/schedule/engineer/:engineerId" element={<ProtectedRoute><Layout><EngineerAvailability /></Layout></ProtectedRoute>} />
        <Route path="/admin/messages" element={<ProtectedRoute><Layout><AdminMessages /></Layout></ProtectedRoute>} />
        <Route path="/ops/quotes" element={<ProtectedRoute><Layout><AdminPartnerQuotes /></Layout></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
