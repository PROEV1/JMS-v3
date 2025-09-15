
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/RouteGuard';
import OpsCommandCentre from '@/pages/OpsCommandCentre';
import AdminQuotes from '@/pages/AdminQuotes';
import AdminQuoteCreate from '@/pages/AdminQuoteCreate';
import AdminQuoteDetail from '@/pages/AdminQuoteDetail';
import AdminQuoteEdit from '@/pages/AdminQuoteEdit';
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
import AdminSurveyFormEdit from '@/pages/AdminSurveyFormEdit';
import AdminChargers from '@/pages/AdminChargers';
import AdminPartners from '@/pages/AdminPartners';
import AdminPartnerProfiles from '@/pages/AdminPartnerProfiles';
import AdminPartnerUsers from '@/pages/AdminPartnerUsers';
import SurveyPage from '@/pages/SurveyPage';
import SurveySuccess from '@/pages/SurveySuccess';
import SurveyReadOnlyView from '@/pages/SurveyReadOnlyView';
import PublicQuoteView from '@/pages/PublicQuoteView';
import AdminSchedule from '@/pages/AdminSchedule';
import AdminScheduleStatus from '@/pages/AdminScheduleStatus';
import EngineerAvailability from '@/pages/EngineerAvailability';
import EngineerProfile from '@/pages/EngineerProfile';
import AdminMessages from '@/pages/AdminMessages';
import AdminClientDetail from '@/pages/AdminClientDetail';
import AdminPartnerQuotes from '@/pages/AdminPartnerQuotes';
import Auth from '@/pages/Auth';
import Layout from '@/components/SimpleLayout';
import ClientDashboard from '@/pages/ClientDashboard';
import ClientQuotes from '@/pages/ClientQuotes';
import ClientQuoteDetail from '@/pages/ClientQuoteDetail';
import ClientOrders from '@/pages/ClientOrders';
import ClientMessages from '@/pages/ClientMessages';
import ClientPayments from '@/pages/ClientPayments';
import ClientProfilePage from '@/pages/ClientProfilePage';
import EnhancedClientOrderView from '@/pages/EnhancedClientOrderView';
import ClientOfferViewPublic from '@/pages/ClientOfferViewPublic';
import ClientOfferView from '@/pages/ClientOfferView';
import { ErrorBoundaryRoute } from '@/components/ErrorBoundaryRoute';
import EngineerDashboard from '@/pages/EngineerDashboard';
import EngineerJobs from '@/pages/EngineerJobs';
import EngineerJobDetail from '@/pages/EngineerJobDetail';
import EngineerChargers from '@/pages/EngineerChargers';
import EngineerVanStock from '@/pages/EngineerVanStock';
import EngineerStockRequests from '@/pages/EngineerStockRequests';
import EngineerScan from '@/pages/EngineerScan';
import PartnerPortal from '@/pages/PartnerPortal';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster />
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
        <Route path="/quote/:token" element={<PublicQuoteView />} />
        <Route path="/offers/:token" element={
          <ErrorBoundaryRoute>
            <ClientOfferViewPublic />
          </ErrorBoundaryRoute>
        } />
        <Route path="/client-offer/:token" element={
          <ErrorBoundaryRoute>
            <ClientOfferView />
          </ErrorBoundaryRoute>
        } />
        <Route path="/public/client-offer/:token" element={
          <ErrorBoundaryRoute>
            <ClientOfferViewPublic />
          </ErrorBoundaryRoute>
        } />
        
        {/* Survey Routes - Public access with token validation */}
        <Route path="/survey/:orderId" element={<SurveyPage />} />
        <Route path="/survey/:orderId/success" element={<SurveySuccess />} />
        <Route path="/survey-view/:orderId" element={<SurveyReadOnlyView />} />
        
        {/* Root redirect */}
        <Route path="/" element={<RouteGuard><Layout><OpsCommandCentre /></Layout></RouteGuard>} />
        
        {/* Client Management Routes (Admin Only) */}
        <Route path="/admin/client" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><ClientDashboard /></Layout></RouteGuard>} />
        <Route path="/admin/client/quotes" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><ClientQuotes /></Layout></RouteGuard>} />
        <Route path="/admin/client/quotes/:id" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><ClientQuoteDetail /></Layout></RouteGuard>} />
        <Route path="/admin/client/orders" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><ClientOrders /></Layout></RouteGuard>} />
        <Route path="/admin/client/orders/:id" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><EnhancedClientOrderView /></Layout></RouteGuard>} />
        <Route path="/admin/client/messages" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><ClientMessages /></Layout></RouteGuard>} />
        <Route path="/admin/client/payments" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><ClientPayments /></Layout></RouteGuard>} />
        <Route path="/admin/client/profile" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><ClientProfilePage /></Layout></RouteGuard>} />
        
        {/* Client Portal Routes (Client Access) */}
        <Route path="/portal" element={<RouteGuard allowedRoles={['client']}><Layout><ClientMessages /></Layout></RouteGuard>} />
        <Route path="/portal/messages" element={<RouteGuard allowedRoles={['client']}><Layout><ClientMessages /></Layout></RouteGuard>} />
        
        {/* Engineer Routes */}
        <Route path="/engineer/dashboard" element={<RouteGuard allowedRoles={['engineer']}><Layout><EngineerDashboard /></Layout></RouteGuard>} />
        <Route path="/engineer" element={<RouteGuard allowedRoles={['engineer']}><Layout><EngineerDashboard /></Layout></RouteGuard>} />
        <Route path="/engineer/jobs" element={<RouteGuard allowedRoles={['engineer']}><Layout><EngineerJobs /></Layout></RouteGuard>} />
        <Route path="/engineer/jobs/:id" element={<RouteGuard allowedRoles={['engineer']}><Layout><EngineerJobDetail /></Layout></RouteGuard>} />
        <Route path="/engineer/chargers" element={<RouteGuard allowedRoles={['engineer']}><Layout><EngineerChargers /></Layout></RouteGuard>} />
        <Route path="/engineer/van-stock" element={<RouteGuard allowedRoles={['engineer']}><Layout><EngineerVanStock /></Layout></RouteGuard>} />
        <Route path="/engineer/stock-requests" element={<RouteGuard allowedRoles={['engineer']}><Layout><EngineerStockRequests /></Layout></RouteGuard>} />
        <Route path="/engineer/scan" element={<RouteGuard allowedRoles={['engineer']}><Layout><EngineerScan /></Layout></RouteGuard>} />
        <Route path="/engineer/availability" element={<RouteGuard allowedRoles={['engineer']}><Layout><EngineerAvailability /></Layout></RouteGuard>} />
        <Route path="/engineer/profile" element={<RouteGuard allowedRoles={['engineer']}><Layout><EngineerProfile /></Layout></RouteGuard>} />
        
        {/* Partner Routes */}
        <Route path="/partner" element={<RouteGuard allowedRoles={['partner_user']}><Layout><PartnerPortal /></Layout></RouteGuard>} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><OpsCommandCentre /></Layout></RouteGuard>} />
        <Route path="/admin/quotes" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminQuotes /></Layout></RouteGuard>} />
        <Route path="/admin/quotes/create" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminQuoteCreate /></Layout></RouteGuard>} />
        <Route path="/admin/quotes/:id/edit" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminQuoteEdit /></Layout></RouteGuard>} />
        <Route path="/admin/quotes/:id" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminQuoteDetail /></Layout></RouteGuard>} />
        <Route path="/admin/orders" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminOrders /></Layout></RouteGuard>} />
        <Route path="/admin/orders/:id" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><OrderDetail /></Layout></RouteGuard>} />
        <Route path="/orders/:id" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><OrderDetail /></Layout></RouteGuard>} />
        <Route path="/admin/clients" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminClients /></Layout></RouteGuard>} />
        <Route path="/admin/clients/:id" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminClientDetail /></Layout></RouteGuard>} />
        <Route path="/admin/leads" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminLeads /></Layout></RouteGuard>} />
        <Route path="/admin/products" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminProducts /></Layout></RouteGuard>} />
        <Route path="/admin/inventory" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminInventory /></Layout></RouteGuard>} />
        <Route path="/admin/survey-forms" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminSurveyForms /></Layout></RouteGuard>} />
        <Route path="/admin/survey-forms/:versionId/edit" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminSurveyFormEdit /></Layout></RouteGuard>} />
        <Route path="/admin/chargers" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminChargers /></Layout></RouteGuard>} />
        <Route path="/admin/partners" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminPartners /></Layout></RouteGuard>} />
        <Route path="/admin/partners/:id/users" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminPartnerUsers /></Layout></RouteGuard>} />
        <Route path="/admin/partners/:id/profiles" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminPartnerProfiles /></Layout></RouteGuard>} />
        <Route path="/admin/engineers" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminEngineers /></Layout></RouteGuard>} />
        <Route path="/admin/engineers/:id" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><EngineerProfile /></Layout></RouteGuard>} />
        <Route path="/admin/users" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminUsers /></Layout></RouteGuard>} />
        <Route path="/admin/users/new" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminUserInvite /></Layout></RouteGuard>} />
        <Route path="/admin/users/:id" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminUserDetail /></Layout></RouteGuard>} />
        <Route path="/admin/settings" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminSettings /></Layout></RouteGuard>} />
        <Route path="/admin/schedule" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminSchedule /></Layout></RouteGuard>} />
        <Route path="/admin/schedule/status/:status" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminScheduleStatus /></Layout></RouteGuard>} />
        <Route path="/admin/schedule/engineer/:engineerId" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><EngineerAvailability /></Layout></RouteGuard>} />
        <Route path="/admin/messages" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminMessages /></Layout></RouteGuard>} />
        <Route path="/ops/quotes" element={<RouteGuard allowedRoles={['admin', 'standard_office_user']}><Layout><AdminPartnerQuotes /></Layout></RouteGuard>} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
