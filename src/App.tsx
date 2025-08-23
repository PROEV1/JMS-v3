
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import SetupPassword from "./pages/SetupPassword";
import ResetPassword from "./pages/ResetPassword";
import AdminDashboard from "./pages/Admin";
import AdminUsers from "./pages/AdminUsers";
import AdminUserInvite from "./pages/AdminUserInvite";
import AdminUserDetail from "./pages/AdminUserDetail";
import AdminClients from "./pages/AdminClients";
import AdminClientUsers from "./pages/AdminClientUsers";
import AdminLeads from "./pages/AdminLeads";
import AdminQuotes from "./pages/AdminQuotes";
import AdminQuoteCreate from "./pages/AdminQuoteCreate";
import AdminQuoteEdit from "./pages/AdminQuoteEdit";
import AdminQuoteDetail from "./pages/AdminQuoteDetail";
import AdminOrders from "./pages/AdminOrders";
import AdminProducts from "./pages/AdminProducts";
import AdminMessages from "./pages/AdminMessages";
import AdminSettings from "./pages/AdminSettings";
import AdminPartners from "./pages/AdminPartners";
import AdminPartnerUsers from "./pages/AdminPartnerUsers";
import AdminPartnerProfiles from "./pages/AdminPartnerProfiles";
import AdminEngineers from "./pages/AdminEngineers";
import AdminSchedule from "./pages/AdminSchedule";
import AdminScheduleStatus from "./pages/AdminScheduleStatus";
import AdminInventory from "./pages/AdminInventory";
import ClientDashboard from "./pages/ClientDashboard";
import ClientQuotes from "./pages/ClientQuotes";
import ClientQuoteDetail from "./pages/ClientQuoteDetail";
import ClientOrders from "./pages/ClientOrders";
import ClientMessages from "./pages/ClientMessages";
import ClientPayments from "./pages/ClientPayments";
import ClientDocuments from "./pages/ClientDocuments";
import ClientDateBlocking from "./pages/ClientDateBlocking";
import ClientOfferView from "./pages/ClientOfferView";
import ClientOfferViewPublic from "./pages/ClientOfferViewPublic";
import ClientProfilePage from "./pages/ClientProfilePage";
import ClientProfileSelf from "./pages/ClientProfileSelf";
import EnhancedClientOrderView from "./pages/EnhancedClientOrderView";
import PartnerPortal from "./pages/PartnerPortal";
import SurveyPage from "./pages/SurveyPage";
import SurveySuccess from "./pages/SurveySuccess";
import EngineerDashboard from "./pages/EngineerDashboard";
import EngineerJobs from "./pages/EngineerJobs";
import EngineerJobDetail from "./pages/EngineerJobDetail";
import EngineerProfile from "./pages/EngineerProfile";
import EngineerStockRequests from "./pages/EngineerStockRequests";
import OrderDetail from "./pages/OrderDetail";
import PublicQuoteView from "./pages/PublicQuoteView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/setup-password" element={<SetupPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
               <Route path="/offers/:token" element={<ClientOfferViewPublic />} />
               <Route path="/quotes/:shareToken" element={<PublicQuoteView />} />
               <Route path="/survey/:orderId" element={<SurveyPage />} />
               <Route path="/survey-success" element={<SurveySuccess />} />
               <Route path="/partner" element={<PartnerPortal />} />
              
              {/* All other routes wrapped in Layout */}
              <Route path="/*" element={
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    
                    {/* Admin Routes */}
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/users/invite" element={<AdminUserInvite />} />
                    <Route path="/admin/users/:id" element={<AdminUserDetail />} />
                    <Route path="/admin/clients" element={<AdminClients />} />
                    <Route path="/admin/clients/:id" element={<ClientProfilePage />} />
                    <Route path="/admin/client-users" element={<AdminClientUsers />} />
                    <Route path="/admin/leads" element={<AdminLeads />} />
                    <Route path="/admin/quotes" element={<AdminQuotes />} />
                    <Route path="/admin/quotes/create" element={<AdminQuoteCreate />} />
                    <Route path="/admin/quotes/:id/edit" element={<AdminQuoteEdit />} />
                    <Route path="/admin/quotes/:id" element={<AdminQuoteDetail />} />
                    <Route path="/admin/orders" element={<AdminOrders />} />
                    <Route path="/admin/products" element={<AdminProducts />} />
                    <Route path="/admin/messages" element={<AdminMessages />} />
                    <Route path="/admin/settings" element={<AdminSettings />} />
                    <Route path="/admin/partners" element={<AdminPartners />} />
                    <Route path="/admin/partners/:id/users" element={<AdminPartnerUsers />} />
                    <Route path="/admin/partners/:id/profiles" element={<AdminPartnerProfiles />} />
                    <Route path="/admin/engineers" element={<AdminEngineers />} />
                    <Route path="/admin/schedule" element={<AdminSchedule />} />
                    <Route path="/admin/schedule/status/:status" element={<AdminScheduleStatus />} />
                    <Route path="/admin/schedule-status" element={<AdminScheduleStatus />} />
                    <Route path="/admin/inventory" element={<AdminInventory />} />
                    
                    {/* Client Routes */}
                    <Route path="/client" element={<ClientDashboard />} />
                    <Route path="/client/dashboard" element={<ClientDashboard />} />
                    <Route path="/client/quotes" element={<ClientQuotes />} />
                    <Route path="/client/quotes/:id" element={<ClientQuoteDetail />} />
                    <Route path="/client/orders" element={<ClientOrders />} />
                    <Route path="/client/orders/:id" element={<EnhancedClientOrderView />} />
                    <Route path="/client/messages" element={<ClientMessages />} />
                    <Route path="/client/payments" element={<ClientPayments />} />
                    <Route path="/client/documents" element={<ClientDocuments />} />
                    <Route path="/client/date-blocking" element={<ClientDateBlocking />} />
                    <Route path="/client/offers/:token" element={<ClientOfferView />} />
                    <Route path="/client/profile/:id" element={<ClientProfilePage />} />
                    <Route path="/client/profile" element={<ClientProfileSelf />} />
                    
                    {/* Engineer Routes */}
                    <Route path="/engineer" element={<EngineerDashboard />} />
                    <Route path="/engineer/dashboard" element={<EngineerDashboard />} />
                    <Route path="/engineer/jobs" element={<EngineerJobs />} />
                    <Route path="/engineer/jobs/:id" element={<EngineerJobDetail />} />
                    <Route path="/engineer/profile" element={<EngineerProfile />} />
                    <Route path="/engineer/stock-requests" element={<EngineerStockRequests />} />
                    
                    {/* Other authenticated routes */}
                    <Route path="/orders/:id" element={<OrderDetail />} />
                    
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              } />
            </Routes>
          </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
