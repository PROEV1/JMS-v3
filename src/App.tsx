
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { AuthProvider } from "@/hooks/useAuth";
import Layout from "@/components/Layout";

import Dashboard from "./pages/Dashboard";
import ClientDashboard from "./pages/ClientDashboard";
import Admin from "./pages/Admin";
import AdminProducts from "./pages/AdminProducts";
import AdminClients from "./pages/AdminClients";
import AdminQuotes from "./pages/AdminQuotes";
import AdminOrders from "./pages/AdminOrders";
import AdminEngineers from "./pages/AdminEngineers";
import AdminQuoteDetail from "./pages/AdminQuoteDetail";
import AdminQuoteCreate from "./pages/AdminQuoteCreate";
import AdminQuoteEdit from "./pages/AdminQuoteEdit";
import AdminLeads from "./pages/AdminLeads";
import ClientProfilePage from "./pages/ClientProfilePage";
import EngineerDashboard from "./pages/EngineerDashboard";
import EngineerJobDetail from "./pages/EngineerJobDetail";
import EngineerProfile from "./pages/EngineerProfile";
import Auth from "./pages/Auth";
import SetupPassword from "./pages/SetupPassword";
import AdminMessages from "./pages/AdminMessages";
import AdminSettings from "./pages/AdminSettings";
import AdminUsers from "./pages/AdminUsers";
import AdminClientUsers from "./pages/AdminClientUsers";
import AdminUserDetail from "./pages/AdminUserDetail";
import AdminUserInvite from "./pages/AdminUserInvite";
import OrderDetail from "./pages/OrderDetail";
import PublicQuoteView from "./pages/PublicQuoteView";
import EnhancedClientOrderView from "./pages/EnhancedClientOrderView";
import AdminSchedule from "./pages/AdminSchedule";
import ClientDateBlocking from "./pages/ClientDateBlocking";
import EngineerAvailability from "./pages/EngineerAvailability";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <DndProvider backend={HTML5Backend}>
          <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/setup-password" element={<SetupPassword />} />
            <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
            <Route path="/client" element={<Layout><ClientDashboard /></Layout>} />
            <Route path="/client/date-blocking" element={<Layout><ClientDateBlocking /></Layout>} />
            <Route path="/client/orders/:orderId" element={<Layout><EnhancedClientOrderView /></Layout>} />
            <Route path="/engineer" element={<Layout><EngineerDashboard /></Layout>} />
            <Route path="/engineer/profile" element={<Layout><EngineerProfile /></Layout>} />
            <Route path="/engineer/availability" element={<Layout><EngineerAvailability /></Layout>} />
            <Route path="/engineer/job/:jobId" element={<Layout><EngineerJobDetail /></Layout>} />
            <Route path="/admin" element={<Layout><Admin /></Layout>} />
            <Route path="/admin/orders" element={<Layout><AdminOrders /></Layout>} />
            <Route path="/admin/schedule" element={<Layout><AdminSchedule /></Layout>} />
            <Route path="/admin/engineers" element={<Layout><AdminEngineers /></Layout>} />
            <Route path="/admin/products" element={<Layout><AdminProducts /></Layout>} />
            <Route path="/admin/clients" element={<Layout><AdminClients /></Layout>} />
            <Route path="/admin/clients/:clientId" element={<Layout><ClientProfilePage /></Layout>} />
            <Route path="/admin/leads" element={<Layout><AdminLeads /></Layout>} />
            <Route path="/admin/quotes" element={<Layout><AdminQuotes /></Layout>} />
            <Route path="/admin/quotes/new" element={<Layout><AdminQuoteCreate /></Layout>} />
            <Route path="/admin/quotes/:id/edit" element={<Layout><AdminQuoteEdit /></Layout>} />
            <Route path="/admin/quotes/:quoteId" element={<Layout><AdminQuoteDetail /></Layout>} />
            <Route path="/admin/messages" element={<Layout><AdminMessages /></Layout>} />
            <Route path="/admin/users" element={<Layout><AdminUsers /></Layout>} />
            <Route path="/admin/client-users" element={<Layout><AdminClientUsers /></Layout>} />
            <Route path="/admin/users/new" element={<Layout><AdminUserInvite /></Layout>} />
            <Route path="/admin/users/:userId" element={<Layout><AdminUserDetail /></Layout>} />
            <Route path="/admin/settings" element={<Layout><AdminSettings /></Layout>} />
            <Route path="/admin/client/:clientId" element={<Layout><ClientProfilePage /></Layout>} />
            <Route path="/admin/order/:orderId" element={<Layout><OrderDetail /></Layout>} />
            <Route path="/order/:orderId" element={<Layout><OrderDetail /></Layout>} />
            <Route path="/quote/:shareToken" element={<PublicQuoteView />} />
            {/* Auth page as home page */}
            <Route path="/" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </DndProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
