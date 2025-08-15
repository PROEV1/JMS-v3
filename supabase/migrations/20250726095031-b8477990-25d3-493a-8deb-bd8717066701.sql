-- Insert default permissions for each role
INSERT INTO user_permissions (role, permission_key, can_access) VALUES
-- Admin permissions (full access)
('admin', 'users.manage', true),
('admin', 'users.create', true),
('admin', 'users.delete', true),
('admin', 'quotes.manage', true),
('admin', 'orders.manage', true),
('admin', 'clients.manage', true),
('admin', 'messages.manage', true),
('admin', 'engineers.manage', true),
('admin', 'settings.manage', true),
('admin', 'reports.financial', true),

-- Manager permissions (everything except user management)
('manager', 'users.manage', false),
('manager', 'users.create', false),
('manager', 'users.delete', false),
('manager', 'quotes.manage', true),
('manager', 'orders.manage', true),
('manager', 'clients.manage', true),
('manager', 'messages.manage', true),
('manager', 'engineers.manage', true),
('manager', 'settings.manage', true),
('manager', 'reports.financial', true),

-- Standard office user permissions (limited access)
('standard_office_user', 'users.manage', false),
('standard_office_user', 'users.create', false),
('standard_office_user', 'users.delete', false),
('standard_office_user', 'quotes.manage', true),
('standard_office_user', 'orders.manage', true),
('standard_office_user', 'clients.manage', true),
('standard_office_user', 'messages.manage', true),
('standard_office_user', 'engineers.manage', false),
('standard_office_user', 'settings.manage', false),
('standard_office_user', 'reports.financial', false),

-- Engineer permissions (job-focused only)
('engineer', 'users.manage', false),
('engineer', 'users.create', false),
('engineer', 'users.delete', false),
('engineer', 'quotes.manage', false),
('engineer', 'orders.manage', false),
('engineer', 'clients.manage', false),
('engineer', 'messages.manage', false),
('engineer', 'engineers.manage', false),
('engineer', 'settings.manage', false),
('engineer', 'reports.financial', false),
('engineer', 'jobs.assigned', true),
('engineer', 'jobs.upload', true),
('engineer', 'jobs.complete', true),

-- Client permissions (view only their own data)
('client', 'users.manage', false),
('client', 'users.create', false),
('client', 'users.delete', false),
('client', 'quotes.view_own', true),
('client', 'orders.view_own', true),
('client', 'messages.view_own', true)
ON CONFLICT (role, permission_key) DO NOTHING;