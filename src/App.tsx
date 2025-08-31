import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { DesignVersionProvider } from '@/contexts/DesignVersionContext';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminQuotes from '@/pages/AdminQuotes';
import AdminQuoteDetail from '@/pages/AdminQuoteDetail';
import AdminOrders from '@/pages/AdminOrders';
import AdminOrderDetail from '@/pages/AdminOrderDetail';
import AdminClients from '@/pages/AdminClients';
import AdminEngineers from '@/pages/AdminEngineers';
import AdminUsers from '@/pages/AdminUsers';
import AdminSettings from '@/pages/AdminSettings';
import PublicQuoteView from '@/pages/PublicQuoteView';
import SchedulingDashboard from '@/pages/SchedulingDashboard';
import ScheduleStatusView from '@/pages/ScheduleStatusView';
import EngineerAvailabilityView from '@/pages/EngineerAvailabilityView';
import EngineerDetailView from '@/pages/EngineerDetailView';
import AdminFinancialReports from '@/pages/AdminFinancialReports';
import AdminMessages from '@/pages/AdminMessages';
import AdminPartnerQuotes from '@/pages/AdminPartnerQuotes';

function App() {
  return (
    <Router>
      <QueryClientProvider client={new QueryClient()}>
        <DesignVersionProvider>
          <Toaster />
          <Routes>
            <Route path="/" element={<PublicQuoteView />} />
            <Route path="/quote/:token" element={<PublicQuoteView />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/quotes" element={<AdminQuotes />} />
            <Route path="/admin/quotes/:id" element={<AdminQuoteDetail />} />
            <Route path="/admin/orders" element={<AdminOrders />} />
            <Route path="/admin/orders/:id" element={<AdminOrderDetail />} />
            <Route path="/admin/clients" element={<AdminClients />} />
            <Route path="/admin/engineers" element={<AdminEngineers />} />
            <Route path="/admin/engineers/:id" element={<EngineerDetailView />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/schedule" element={<SchedulingDashboard />} />
            <Route path="/admin/schedule/status/:status" element={<ScheduleStatusView />} />
            <Route path="/admin/schedule/engineer/:engineerId" element={<EngineerAvailabilityView />} />
            <Route path="/admin/reports/financial" element={<AdminFinancialReports />} />
            <Route path="/admin/messages" element={<AdminMessages />} />
            <Route path="/admin/ops/quotes" element={<AdminPartnerQuotes />} />
          </Routes>
        </DesignVersionProvider>
      </QueryClientProvider>
    </Router>
  );
}

export default App;
