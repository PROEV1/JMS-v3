import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import Home from '@/pages/Home';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminEngineers from '@/pages/AdminEngineers';
import AdminClients from '@/pages/AdminClients';
import AdminQuotes from '@/pages/AdminQuotes';
import AdminOrders from '@/pages/AdminOrders';
import AdminInvoices from '@/pages/AdminInvoices';
import AdminScheduling from '@/pages/AdminScheduling';
import AdminSchedulingStatus from '@/pages/AdminSchedulingStatus';
import AdminSchedulingMap from '@/pages/AdminSchedulingMap';
import AdminSchedulingOptimise from '@/pages/AdminSchedulingOptimise';
import AdminSchedulingConflicts from '@/pages/AdminSchedulingConflicts';
import AdminSchedulingCapacity from '@/pages/AdminSchedulingCapacity';
import AdminSchedulingSettings from '@/pages/AdminSchedulingSettings';
import AdminSchedulingSlots from '@/pages/AdminSchedulingSlots';
import AdminSchedulingSlotsNew from '@/pages/AdminSchedulingSlotsNew';
import AdminSchedulingSlotsEdit from '@/pages/AdminSchedulingSlotsEdit';
import AdminUsers from '@/pages/AdminUsers';
import AdminRoles from '@/pages/AdminRoles';
import AdminPermissions from '@/pages/AdminPermissions';
import AdminSettings from '@/pages/AdminSettings';
import AdminLogs from '@/pages/AdminLogs';
import EngineerDashboard from '@/pages/EngineerDashboard';
import EngineerOrders from '@/pages/EngineerOrders';
import EngineerInvoices from '@/pages/EngineerInvoices';
import EngineerScheduling from '@/pages/EngineerScheduling';
import EngineerSettings from '@/pages/EngineerSettings';
import ClientDashboard from '@/pages/ClientDashboard';
import ClientQuotes from '@/pages/ClientQuotes';
import ClientOrders from '@/pages/ClientOrders';
import ClientInvoices from '@/pages/ClientInvoices';
import ClientSettings from '@/pages/ClientSettings';
import AuthLogin from '@/pages/AuthLogin';
import AuthRegister from '@/pages/AuthRegister';
import AuthForgotPassword from '@/pages/AuthForgotPassword';
import AuthResetPassword from '@/pages/AuthResetPassword';
import AuthVerifyEmail from '@/pages/AuthVerifyEmail';
import AuthLogout from '@/pages/AuthLogout';
import AuthProfile from '@/pages/AuthProfile';
import AuthSettings from '@/pages/AuthSettings';
import AuthChangePassword from '@/pages/AuthChangePassword';
import AuthChangeEmail from '@/pages/AuthChangeEmail';
import AuthDeleteAccount from '@/pages/AuthDeleteAccount';
import AuthTwoFactorAuth from '@/pages/AuthTwoFactorAuth';
import AuthTwoFactorAuthVerify from '@/pages/AuthTwoFactorAuthVerify';
import AuthTwoFactorAuthDisable from '@/pages/AuthTwoFactorAuthDisable';
import AuthTwoFactorAuthEnable from '@/pages/AuthTwoFactorAuthEnable';
import AuthTwoFactorAuthBackupCodes from '@/pages/AuthTwoFactorAuthBackupCodes';
import AuthTwoFactorAuthNewBackupCodes from '@/pages/AuthTwoFactorAuthNewBackupCodes';
import AuthTwoFactorAuthRecover from '@/pages/AuthTwoFactorAuthRecover';
import AuthTwoFactorAuthRecoverVerify from '@/pages/AuthTwoFactorAuthRecoverVerify';
import AuthTwoFactorAuthRecoverDisable from '@/pages/AuthTwoFactorAuthRecoverDisable';
import AuthTwoFactorAuthRecoverEnable from '@/pages/AuthTwoFactorAuthRecoverEnable';
import AuthTwoFactorAuthRecoverBackupCodes from '@/pages/AuthTwoFactorAuthRecoverBackupCodes';
import AuthTwoFactorAuthRecoverNewBackupCodes from '@/pages/AuthTwoFactorAuthRecoverNewBackupCodes';
import AuthTwoFactorAuthRecoverTwoFactorAuth from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuth';
import AuthTwoFactorAuthRecoverTwoFactorAuthVerify from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthVerify';
import AuthTwoFactorAuthRecoverTwoFactorAuthDisable from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthDisable';
import AuthTwoFactorAuthRecoverTwoFactorAuthEnable from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthEnable';
import AuthTwoFactorAuthRecoverTwoFactorAuthBackupCodes from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthBackupCodes';
import AuthTwoFactorAuthRecoverTwoFactorAuthNewBackupCodes from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthNewBackupCodes';
import AuthTwoFactorAuthRecoverTwoFactorAuthRecover from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthRecover';
import AuthTwoFactorAuthRecoverTwoFactorAuthRecoverVerify from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthRecoverVerify';
import AuthTwoFactorAuthRecoverTwoFactorAuthRecoverDisable from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthRecoverDisable';
import AuthTwoFactorAuthRecoverTwoFactorAuthRecoverEnable from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthRecoverEnable';
import AuthTwoFactorAuthRecoverTwoFactorAuthRecoverBackupCodes from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthRecoverBackupCodes';
import AuthTwoFactorAuthRecoverTwoFactorAuthRecoverNewBackupCodes from '@/pages/AuthTwoFactorAuthRecoverTwoFactorAuthRecoverNewBackupCodes';
import AdminPartners from '@/pages/AdminPartners';
import AdminPartnerProfiles from '@/pages/AdminPartnerProfiles';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/engineers" element={<AdminEngineers />} />
          <Route path="/admin/clients" element={<AdminClients />} />
          <Route path="/admin/quotes" element={<AdminQuotes />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/invoices" element={<AdminInvoices />} />
          <Route path="/admin/scheduling" element={<AdminScheduling />} />
          <Route path="/admin/schedule/status/:status" element={<AdminSchedulingStatus />} />
          <Route path="/admin/schedule/map" element={<AdminSchedulingMap />} />
          <Route path="/admin/schedule/optimise" element={<AdminSchedulingOptimise />} />
          <Route path="/admin/schedule/conflicts" element={<AdminSchedulingConflicts />} />
          <Route path="/admin/schedule/capacity" element={<AdminSchedulingCapacity />} />
          <Route path="/admin/schedule/settings" element={<AdminSchedulingSettings />} />
          <Route path="/admin/schedule/slots" element={<AdminSchedulingSlots />} />
          <Route path="/admin/schedule/slots/new" element={<AdminSchedulingSlotsNew />} />
          <Route path="/admin/schedule/slots/:id/edit" element={<AdminSchedulingSlotsEdit />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/roles" element={<AdminRoles />} />
          <Route path="/admin/permissions" element={<AdminPermissions />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/logs" element={<AdminLogs />} />
          <Route path="/engineer" element={<EngineerDashboard />} />
          <Route path="/engineer/orders" element={<EngineerOrders />} />
          <Route path="/engineer/invoices" element={<EngineerInvoices />} />
          <Route path="/engineer/scheduling" element={<EngineerScheduling />} />
          <Route path="/engineer/settings" element={<EngineerSettings />} />
          <Route path="/client" element={<ClientDashboard />} />
          <Route path="/client/quotes" element={<ClientQuotes />} />
          <Route path="/client/orders" element={<ClientOrders />} />
          <Route path="/client/invoices" element={<ClientInvoices />} />
          <Route path="/client/settings" element={<ClientSettings />} />
          <Route path="/auth/login" element={<AuthLogin />} />
          <Route path="/auth/register" element={<AuthRegister />} />
          <Route path="/auth/forgot-password" element={<AuthForgotPassword />} />
          <Route path="/auth/reset-password" element={<AuthResetPassword />} />
          <Route path="/auth/verify-email" element={<AuthVerifyEmail />} />
          <Route path="/auth/logout" element={<AuthLogout />} />
          <Route path="/auth/profile" element={<AuthProfile />} />
          <Route path="/auth/settings" element={<AuthSettings />} />
          <Route path="/auth/change-password" element={<AuthChangePassword />} />
          <Route path="/auth/change-email" element={<AuthChangeEmail />} />
          <Route path="/auth/delete-account" element={<AuthDeleteAccount />} />
          <Route path="/auth/two-factor-auth" element={<AuthTwoFactorAuth />} />
          <Route path="/auth/two-factor-auth/verify" element={<AuthTwoFactorAuthVerify />} />
          <Route path="/auth/two-factor-auth/disable" element={<AuthTwoFactorAuthDisable />} />
          <Route path="/auth/two-factor-auth/enable" element={<AuthTwoFactorAuthEnable />} />
          <Route path="/auth/two-factor-auth/backup-codes" element={<AuthTwoFactorAuthBackupCodes />} />
          <Route path="/auth/two-factor-auth/new-backup-codes" element={<AuthTwoFactorAuthNewBackupCodes />} />
          <Route path="/auth/two-factor-auth/recover" element={<AuthTwoFactorAuthRecover />} />
          <Route path="/auth/two-factor-auth/recover/verify" element={<AuthTwoFactorAuthRecoverVerify />} />
          <Route path="/auth/two-factor-auth/recover/disable" element={<AuthTwoFactorAuthRecoverDisable />} />
          <Route path="/auth/two-factor-auth/recover/enable" element={<AuthTwoFactorAuthRecoverEnable />} />
          <Route path="/auth/two-factor-auth/recover/backup-codes" element={<AuthTwoFactorAuthRecoverBackupCodes />} />
          <Route path="/auth/two-factor-auth/recover/new-backup-codes" element={<AuthTwoFactorAuthRecoverNewBackupCodes />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth" element={<AuthTwoFactorAuthRecoverTwoFactorAuth />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/verify" element={<AuthTwoFactorAuthRecoverTwoFactorAuthVerify />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/disable" element={<AuthTwoFactorAuthRecoverTwoFactorAuthDisable />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/enable" element={<AuthTwoFactorAuthRecoverTwoFactorAuthEnable />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/backup-codes" element={<AuthTwoFactorAuthRecoverTwoFactorAuthBackupCodes />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/new-backup-codes" element={<AuthTwoFactorAuthRecoverTwoFactorAuthNewBackupCodes />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/recover" element={<AuthTwoFactorAuthRecoverTwoFactorAuthRecover />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/recover/verify" element={<AuthTwoFactorAuthRecoverTwoFactorAuthRecoverVerify />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/recover/disable" element={<AuthTwoFactorAuthRecoverTwoFactorAuthRecoverDisable />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/recover/enable" element={<AuthTwoFactorAuthRecoverTwoFactorAuthRecoverEnable />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/recover/backup-codes" element={<AuthTwoFactorAuthRecoverTwoFactorAuthRecoverBackupCodes />} />
          <Route path="/auth/two-factor-auth/recover/two-factor-auth/recover/new-backup-codes" element={<AuthTwoFactorAuthRecoverTwoFactorAuthRecoverNewBackupCodes />} />
          
          {/* New partner management routes */}
          <Route path="/admin/partners" element={<AdminPartners />} />
          <Route path="/admin/partners/:partnerId/profiles" element={<AdminPartnerProfiles />} />
        </Routes>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
