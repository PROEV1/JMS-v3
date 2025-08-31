
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { RootRedirect } from '@/components/RootRedirect';
import Dashboard from '@/pages/Dashboard';
import AdminQuotes from '@/pages/AdminQuotes';
import AdminQuoteDetail from '@/pages/AdminQuoteDetail';
import AdminOrders from '@/pages/AdminOrders';
import OrderDetail from '@/pages/OrderDetail';
import AdminClients from '@/pages/AdminClients';
import AdminEngineers from '@/pages/AdminEngineers';
import AdminUsers from '@/pages/AdminUsers';
import AdminSettings from '@/pages/AdminSettings';
import PublicQuoteView from '@/pages/PublicQuoteView';
import AdminSchedule from '@/pages/AdminSchedule';
import AdminScheduleStatus from '@/pages/AdminScheduleStatus';
import EngineerAvailability from '@/pages/EngineerAvailability';
import EngineerProfile from '@/pages/EngineerProfile';
import AdminMessages from '@/pages/AdminMessages';
import AdminPartnerQuotes from '@/pages/AdminPartnerQuotes';
import Auth from '@/pages/Auth';
import { ProtectedRoute } from '@/components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Toaster />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/quote/:token" element={<PublicQuoteView />} />
        <Route path="/admin" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin/quotes" element={<ProtectedRoute><AdminQuotes /></ProtectedRoute>} />
        <Route path="/admin/quotes/:id" element={<ProtectedRoute><AdminQuoteDetail /></ProtectedRoute>} />
        <Route path="/admin/orders" element={<ProtectedRoute><AdminOrders /></ProtectedRoute>} />
        <Route path="/admin/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
        <Route path="/admin/clients" element={<ProtectedRoute><AdminClients /></ProtectedRoute>} />
        <Route path="/admin/engineers" element={<ProtectedRoute><AdminEngineers /></ProtectedRoute>} />
        <Route path="/admin/engineers/:id" element={<ProtectedRoute><EngineerProfile /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
        <Route path="/admin/schedule" element={<ProtectedRoute><AdminSchedule /></ProtectedRoute>} />
        <Route path="/admin/schedule/status/:status" element={<ProtectedRoute><AdminScheduleStatus /></ProtectedRoute>} />
        <Route path="/admin/schedule/engineer/:engineerId" element={<ProtectedRoute><EngineerAvailability /></ProtectedRoute>} />
        <Route path="/admin/messages" element={<ProtectedRoute><AdminMessages /></ProtectedRoute>} />
        <Route path="/ops/quotes" element={<ProtectedRoute><AdminPartnerQuotes /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}

export default App;
