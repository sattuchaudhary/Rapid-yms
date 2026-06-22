import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { VehicleEntry } from './components/VehicleEntry';
import { VehicleList } from './components/VehicleList';
import { StaffManagement } from './components/StaffManagement';
import { TenantManagement } from './components/TenantManagement';
import { LossAnalysis } from './components/LossAnalysis';
import { RateMaster } from './components/RateMaster';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { StorageManagement } from './components/StorageManagement';
import { CustomerPortal } from './components/CustomerPortal';
import api from './services/api';
import { Warehouse, LogIn, ShieldAlert, Menu, LayoutDashboard, Plus, Truck, Settings, MoreHorizontal, X, Users, FileText, Database, LogOut, ChevronRight, Shield } from 'lucide-react';
import { ToastContainer } from './components/ToastContainer';


import { useTenantStore } from './store/tenantStore';

const isTabAllowed = (tab: string, role?: string): boolean => {
  if (!role) return false;
  
  // Storage management is only for SUPER_ADMIN
  if (tab === 'storage-management') {
    return role === 'SUPER_ADMIN';
  }
  
  const menuItems = [
    { id: 'dashboard', roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'SUPERVISOR'] },
    { id: 'tenants', roles: ['SUPER_ADMIN'] },
    { id: 'vehicle-entry', roles: ['TENANT_ADMIN', 'MANAGER', 'SUPERVISOR', 'EXECUTIVE', 'GUARD'] },
    { id: 'vehicles', roles: ['TENANT_ADMIN', 'MANAGER', 'SUPERVISOR', 'EXECUTIVE', 'GUARD'] },
    { id: 'staff', roles: ['TENANT_ADMIN', 'MANAGER'] },
    { id: 'rates', roles: ['TENANT_ADMIN', 'MANAGER'] },
    { id: 'reports', roles: ['TENANT_ADMIN', 'MANAGER', 'SUPERVISOR'] },
  ];
  
  const item = menuItems.find(i => i.id === tab);
  return item ? item.roles.includes(role) : false;
};

export const App: React.FC = () => {
  const { isAuthenticated, initialize, login, user } = useAuthStore();
  const [currentTab, setCurrentTab] = useState(() => {
    return localStorage.getItem('yms_active_tab') || 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const { resolvedTenant, resolveTenant, loading: tenantLoading, error: tenantError, isRoot } = useTenantStore();
  const [showCustomerPortal, setShowCustomerPortal] = useState(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Password Reset (First login force change) state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetting, setResetting] = useState(false);

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match.');
      return;
    }
    
    setResetting(true);
    try {
      const res = await api.post('/auth/change-password', { newPassword });
      if (res.data?.success) {
        // Update user state in store
        const authData = localStorage.getItem('yms_auth');
        if (authData) {
          const parsed = JSON.parse(authData);
          parsed.user.requiresPasswordReset = false;
          localStorage.setItem('yms_auth', JSON.stringify(parsed));
        }
        
        // Re-initialize state or update user directly
        const updatedUser = { ...user!, requiresPasswordReset: false };
        useAuthStore.setState({ user: updatedUser });
      }
    } catch (err: any) {
      setResetError(err.response?.data?.error || 'Failed to update password. Try again.');
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    initialize();
    resolveTenant(window.location.host);
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const savedTab = localStorage.getItem('yms_active_tab');
      if (savedTab && isTabAllowed(savedTab, user.role)) {
        setCurrentTab(savedTab);
      } else {
        if (user.role === 'SUPER_ADMIN') {
          setCurrentTab('tenants');
        } else {
          setCurrentTab('dashboard');
        }
      }
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isAuthenticated && currentTab) {
      localStorage.setItem('yms_active_tab', currentTab);
    }
  }, [currentTab, isAuthenticated]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data?.success) {
        const { user: loggedInUser, accessToken, refreshToken } = res.data;
        
        // Dynamic Tenant Subdomain Security Lock
        if (resolvedTenant && loggedInUser.tenant.id !== resolvedTenant.id && loggedInUser.role !== 'SUPER_ADMIN') {
          setError('Access Denied: Your account does not belong to this yard.');
          return;
        }

        login(loggedInUser, accessToken, refreshToken);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials or connection error');
    } finally {
      setLoggingIn(false);
    }
  };

  // 1. Loading State (Premium Design UI)
  if (tenantLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans select-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
        <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6 z-10">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl relative shadow-2xl">
            <Warehouse className="w-10 h-10 text-primary animate-pulse" />
            <div className="absolute -inset-1 border border-primary/20 rounded-3xl animate-ping opacity-75"></div>
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">Securing Workspace</h2>
            <p className="text-xs text-slate-500 font-semibold">Resolving multi-tenant portal and branding properties...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error State (Premium Suspended / Domain Not Found UI)
  if (tenantError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans select-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="w-full max-w-md bg-slate-900 border border-slate-800/80 p-8 rounded-3xl shadow-2xl relative z-10 text-center space-y-6">
          <div className="w-16 h-16 bg-rose-950/40 border border-rose-900/40 rounded-2xl flex items-center justify-center mx-auto text-rose-500 shadow-lg shadow-rose-950/20">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold tracking-tight text-white uppercase">Portal Offline or Invalid Domain</h1>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed px-4">
              The yard subdomain you are trying to access does not exist, or has been temporarily suspended due to billing/compliance issues.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => window.location.reload()}
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors shadow-lg"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If not authenticated, render beautiful modern SaaS Login View
  if (!isAuthenticated) {
    if (showCustomerPortal) {
      return <CustomerPortal onBackToLogin={() => setShowCustomerPortal(false)} />;
    }
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden select-none font-sans">
        {/* Glow backgrounds */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative z-10 space-y-8">
          {/* Logo Branding */}
          <div className="flex flex-col items-center text-center space-y-2">
            {resolvedTenant?.logo ? (
              <div className="p-1.5 bg-slate-950 border border-slate-800 rounded-2xl shadow-lg">
                <img
                  src={resolvedTenant.logo}
                  alt={resolvedTenant.yardName}
                  className="w-12 h-12 rounded-xl object-cover animate-fade-in"
                />
              </div>
            ) : (
              <div className="p-3 bg-primary rounded-2xl text-white shadow-lg shadow-primary/20">
                <Warehouse className="w-8 h-8 animate-pulse" />
              </div>
            )}
            
            <h1 className="text-xl font-bold tracking-tight text-white uppercase mt-4">
              {resolvedTenant ? resolvedTenant.yardName : 'Yard Management SaaS'}
            </h1>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed max-w-xs mx-auto">
              {resolvedTenant ? resolvedTenant.address : 'Multi-Tenant Parking Yard Operations Portal'}
            </p>
            {resolvedTenant && (
              <div className="inline-flex items-center space-x-1.5 bg-primary/10 border border-primary/20 text-primary px-2.5 py-1 rounded-full text-[9px] uppercase font-bold tracking-wider mt-1.5">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></span>
                <span>Verified Corporate Node</span>
              </div>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            {error && (
              <div className="bg-rose-950/30 border border-rose-900/40 text-rose-400 p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={resolvedTenant ? `user@${resolvedTenant.email.split('@')[1]}` : 'admin@mumbaiyard.com'}
                className="w-full bg-slate-950 text-white px-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Password</label>
                <a href="#forgot" className="text-[10px] font-bold text-primary hover:underline">Forgot password?</a>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 text-white px-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-primary hover:bg-primary/95 disabled:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all text-xs flex items-center justify-center space-x-2"
            >
              {loggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating secure tenant...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Secure Tenant Sign In</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setShowCustomerPortal(true)}
                className="text-xs font-bold text-indigo-450 hover:text-indigo-300 hover:underline transition-colors uppercase tracking-wider"
              >
                Track Seized Vehicle (Customer Portal)
              </button>
            </div>
          </form>

          {/* Quick Sandbox Login helpers */}
          <div className="border-t border-slate-800/80 pt-6 space-y-2">
            <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block text-center">Development Sandbox Accounts</span>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold">
              {/* Show only relevant sandbox options matching domain */}
              {(!resolvedTenant || isRoot || resolvedTenant.yardName.toLowerCase().includes('system')) && (
                <button
                  type="button"
                  onClick={() => { setEmail('superadmin@yms-saas.com'); setPassword('password123'); }}
                  className="bg-slate-950 border border-slate-800 text-slate-300 py-2 rounded-lg hover:border-primary/50 transition-colors"
                >
                  Super Admin
                </button>
              )}
              {(!resolvedTenant || resolvedTenant.yardName.toLowerCase().includes('shree')) && (
                <button
                  type="button"
                  onClick={() => { setEmail('shreeyard@gmail.com'); setPassword('password123'); }}
                  className="bg-slate-950 border border-slate-800 text-slate-300 py-2 rounded-lg hover:border-primary/50 transition-colors col-span-2"
                >
                  Shree Admin (New)
                </button>
              )}
              {(!resolvedTenant || resolvedTenant.yardName.toLowerCase().includes('mumbai')) && (
                <>
                  <button
                    type="button"
                    onClick={() => { setEmail('admin@mumbaiyard.com'); setPassword('password123'); }}
                    className="bg-slate-950 border border-slate-800 text-slate-300 py-2 rounded-lg hover:border-primary/50 transition-colors"
                  >
                    Mumbai Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmail('guard@mumbaiyard.com'); setPassword('password123'); }}
                    className="bg-slate-950 border border-slate-800 text-slate-300 py-2 rounded-lg hover:border-primary/50 transition-colors"
                  >
                    Mumbai Guard
                  </button>
                </>
              )}
              {(!resolvedTenant || resolvedTenant.yardName.toLowerCase().includes('delhi')) && (
                <button
                  type="button"
                  onClick={() => { setEmail('admin@delhiyard.com'); setPassword('password123'); }}
                  className="bg-slate-950 border border-slate-800 text-slate-300 py-2 rounded-lg hover:border-primary/50 transition-colors col-span-2"
                >
                  Delhi Admin
                </button>
              )}
            </div>
          </div>
        </div>
        <ToastContainer />
      </div>
    );
  }

  // Shell Layout when logged in but requires first-time password reset
  if (isAuthenticated && user?.requiresPasswordReset) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans select-none text-slate-800">
        {/* Glowing backgrounds */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative z-10 space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="p-3.5 bg-indigo-950/40 border border-indigo-900/40 rounded-2xl text-indigo-400 shadow-lg shadow-indigo-950/20">
              <Shield className="w-8 h-8 animate-pulse" />
            </div>
            
            <h1 className="text-xl font-bold tracking-tight text-white uppercase mt-4">
              Create Your Password
            </h1>
            <p className="text-xs text-slate-400 font-semibold leading-relaxed max-w-xs mx-auto">
              Your account has been provisioned with a default password. For operational security, please set a custom password before accessing the YMS dashboard.
            </p>
          </div>

          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            {resetError && (
              <div className="bg-rose-950/30 border border-rose-900/40 text-rose-400 p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{resetError}</span>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter at least 6 characters"
                className="w-full bg-slate-950 text-white px-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your custom password"
                className="w-full bg-slate-950 text-white px-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
              />
            </div>

            <button
              type="submit"
              disabled={resetting}
              className="w-full bg-primary hover:bg-primary/95 disabled:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all text-xs flex items-center justify-center space-x-2 mt-4"
            >
              {resetting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Updating secure access credentials...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" />
                  <span>Activate My Account</span>
                </>
              )}
            </button>
          </form>
        </div>
        <ToastContainer />
      </div>
    );
  }

  // Shell Layout when logged in
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Panel views */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        {/* Mobile Header Bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-2.5 bg-slate-950 text-white border-b border-slate-900 shrink-0 shadow-md z-30 select-none">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-primary/20 text-primary border border-primary/30 rounded-lg">
              <Warehouse className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-xs uppercase tracking-wider text-slate-100">
              {user?.tenant ? user.tenant.yardName : 'YMS SaaS'}
            </span>
          </div>
          
          <div className="flex items-center space-x-2.5">
            <div className="text-[8px] font-extrabold text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full">
              {user?.role.replace('_', ' ')}
            </div>
            <div className="w-7 h-7 bg-primary/20 text-primary border border-primary/30 rounded-full flex items-center justify-center font-black text-xs shadow-sm">
              {user?.name.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content viewport area */}
        <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
          {currentTab === 'dashboard' && (user?.role === 'SUPER_ADMIN' ? <SuperAdminDashboard /> : <Dashboard setCurrentTab={setCurrentTab} />)}
          {currentTab === 'tenants' && <TenantManagement />}
          {currentTab === 'vehicle-entry' && <VehicleEntry />}
          {currentTab === 'vehicles' && <VehicleList />}
          {currentTab === 'staff' && <StaffManagement />}
          {currentTab === 'rates' && <RateMaster />}
          {currentTab === 'reports' && <LossAnalysis />}
          {currentTab === 'storage-management' && <StorageManagement />}
        </div>

        {/* Premium Bottom Tab Navigation Bar */}
        <nav className="md:hidden shrink-0 bg-slate-950 border-t border-slate-900/60 px-4 py-2 flex justify-around items-center relative z-40 shadow-[0_-8px_30px_rgba(0,0,0,0.2)]">
          {/* 1. Dashboard Tab */}
          <button
            onClick={() => { setCurrentTab('dashboard'); setBottomSheetOpen(false); }}
            className={`flex flex-col items-center justify-center w-12 py-1 transition-all ${
              currentTab === 'dashboard' ? 'text-primary scale-110' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-1 tracking-tight">Home</span>
          </button>

          {/* 2. Yard Stock Tab */}
          <button
            onClick={() => { setCurrentTab('vehicles'); setBottomSheetOpen(false); }}
            className={`flex flex-col items-center justify-center w-12 py-1 transition-all ${
              currentTab === 'vehicles' ? 'text-primary scale-110' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <Truck className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-1 tracking-tight">Stock</span>
          </button>

          {/* 3. Central FAB: New Gate Entry */}
          <button
            onClick={() => { setCurrentTab('vehicle-entry'); setBottomSheetOpen(false); }}
            className={`relative -translate-y-5 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-primary to-indigo-600 text-white shadow-lg shadow-primary/40 border-4 border-slate-950 active:scale-95 transition-all z-50`}
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>

          {/* 4. Bank Pricing Rates (or Super Admin Tenancies) */}
          <button
            onClick={() => {
              if (user?.role === 'SUPER_ADMIN') {
                setCurrentTab('tenants');
              } else {
                setCurrentTab('rates');
              }
              setBottomSheetOpen(false);
            }}
            className={`flex flex-col items-center justify-center w-12 py-1 transition-all ${
              (currentTab === 'rates' || currentTab === 'tenants') ? 'text-primary scale-110' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            {user?.role === 'SUPER_ADMIN' ? <Warehouse className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
            <span className="text-[9px] font-bold mt-1 tracking-tight">
              {user?.role === 'SUPER_ADMIN' ? 'Yards' : 'Rates'}
            </span>
          </button>

          {/* 5. More Menu Tab */}
          <button
            onClick={() => setBottomSheetOpen(!bottomSheetOpen)}
            className={`flex flex-col items-center justify-center w-12 py-1 transition-all ${
              bottomSheetOpen ? 'text-primary scale-110' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-1 tracking-tight">More</span>
          </button>
        </nav>
      </div>

      {/* Mobile Slide-Up Bottom Sheet Menu */}
      {bottomSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 select-none animate-fade-in">
          {/* Backdrop dim */}
          <div 
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setBottomSheetOpen(false)}
          />
          {/* Sheet Body */}
          <div className="absolute inset-x-0 bottom-0 bg-slate-900 border-t border-slate-800 rounded-t-[32px] shadow-2xl p-6 pb-8 space-y-6 transform translate-y-0 transition-transform duration-300">
            {/* Top Pull Bar Drag Indicator */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto -mt-2 mb-2" onClick={() => setBottomSheetOpen(false)}></div>
            
            {/* User Session Profile Card */}
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3">
              <div className="w-11 h-11 bg-primary/20 text-primary border border-primary/30 rounded-full flex items-center justify-center font-black text-base">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-slate-100 truncate">{user?.name}</p>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[9px] font-extrabold text-primary uppercase tracking-widest">
                    {user?.role.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Grid of Administrative Actions */}
            <div className="grid grid-cols-2 gap-3">
              {/* Staff Management (Admins & Managers) */}
              {(user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER') && (
                <button
                  onClick={() => { setCurrentTab('staff'); setBottomSheetOpen(false); }}
                  className={`p-4 rounded-2xl border bg-slate-950/20 hover:bg-slate-950/40 text-left transition-all space-y-2 flex flex-col justify-between ${
                    currentTab === 'staff' ? 'border-primary/50 text-white bg-slate-950/40' : 'border-slate-800 text-slate-300'
                  }`}
                >
                  <Users className={`w-5 h-5 ${currentTab === 'staff' ? 'text-primary' : 'text-slate-400'}`} />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">Staff Control</p>
                    <p className="text-[8px] text-slate-500 font-medium">Manage members</p>
                  </div>
                </button>
              )}

              {/* Reports Analysis */}
              {(user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPERVISOR') && (
                <button
                  onClick={() => { setCurrentTab('reports'); setBottomSheetOpen(false); }}
                  className={`p-4 rounded-2xl border bg-slate-950/20 hover:bg-slate-950/40 text-left transition-all space-y-2 flex flex-col justify-between ${
                    currentTab === 'reports' ? 'border-primary/50 text-white bg-slate-950/40' : 'border-slate-800 text-slate-300'
                  }`}
                >
                  <FileText className={`w-5 h-5 ${currentTab === 'reports' ? 'text-primary' : 'text-slate-400'}`} />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">Reports Feed</p>
                    <p className="text-[8px] text-slate-500 font-medium">Loss Analysis</p>
                  </div>
                </button>
              )}

              {/* Storage limits S3 (Super Admin only) */}
              {user?.role === 'SUPER_ADMIN' && (
                <button
                  onClick={() => { setCurrentTab('storage-management'); setBottomSheetOpen(false); }}
                  className={`p-4 rounded-2xl border bg-slate-950/20 hover:bg-slate-950/40 text-left transition-all space-y-2 flex flex-col justify-between ${
                    currentTab === 'storage-management' ? 'border-primary/50 text-white bg-slate-950/40' : 'border-slate-800 text-slate-300'
                  }`}
                >
                  <Database className={`w-5 h-5 ${currentTab === 'storage-management' ? 'text-primary' : 'text-slate-400'}`} />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold">S3 Storage</p>
                    <p className="text-[8px] text-slate-500 font-medium">Quota mappings</p>
                  </div>
                </button>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                const { logout } = useAuthStore.getState();
                logout();
                setBottomSheetOpen(false);
              }}
              className="w-full flex items-center justify-center space-x-2 py-3 rounded-2xl bg-rose-950/20 border border-rose-900/40 text-rose-400 font-bold hover:bg-rose-950/40 transition-all text-xs"
            >
              <LogOut className="w-4.5 h-4.5" />
              <span>Secure Log Out</span>
            </button>
          </div>
        </div>
      )}
      <ToastContainer />
    </div>
  );
};

export default App;
