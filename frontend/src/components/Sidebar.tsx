import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard,
  PlusCircle,
  Truck,
  Users,
  FileText,
  LogOut,
  Warehouse,
  Shield,
  Settings,
  ChevronDown,
  ChevronRight,
  Database,
  X,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab, isOpen, onClose }) => {
  const { user, logout } = useAuthStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Auto-expand settings submenu if active tab is in settings submenu
  useEffect(() => {
    if (currentTab === 'storage-management') {
      setSettingsOpen(true);
    }
  }, [currentTab]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'SUPERVISOR'] },
    { id: 'tenants', label: 'Super Admin Console', icon: Warehouse, roles: ['SUPER_ADMIN'] },
    { id: 'vehicle-entry', label: 'Vehicle Entry', icon: PlusCircle, roles: ['TENANT_ADMIN', 'MANAGER', 'SUPERVISOR', 'EXECUTIVE', 'GUARD'] },
    { id: 'vehicles', label: 'Yard Stock', icon: Truck, roles: ['TENANT_ADMIN', 'MANAGER', 'SUPERVISOR', 'EXECUTIVE', 'GUARD'] },
    { id: 'staff', label: 'Staff Management', icon: Users, roles: ['TENANT_ADMIN', 'MANAGER'] },
    { id: 'rates', label: 'Bank Management', icon: Settings, roles: ['TENANT_ADMIN', 'MANAGER'] },
    { id: 'reports', label: 'Reports', icon: FileText, roles: ['TENANT_ADMIN', 'MANAGER', 'SUPERVISOR'] },
  ];

  const allowedItems = menuItems.filter(item => !user || item.roles.includes(user.role));
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <div className="hidden md:flex md:flex-col w-64 bg-slate-950 border-r border-slate-800/80 text-slate-100 h-screen select-none shrink-0 relative shadow-2xl">
      {/* Yard Logo & Branding Header */}
      <div className="p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 rounded-xl text-white shadow-lg shadow-indigo-600/30 border border-white/10">
            <Warehouse className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm leading-tight text-white tracking-wider font-display">YMS ENTERPRISE</h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide">YARD OPERATING SYSTEM</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Active Yard Context Badge */}
      {user?.tenant && (
        <div className="px-5 py-3.5 border-b border-slate-800/60 bg-indigo-950/20 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold text-indigo-400 tracking-widest block">Active Yard</span>
            <div className="flex items-center space-x-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
            </div>
          </div>
          <p className="text-xs font-bold text-slate-100 mt-1 truncate">{user.tenant.yardName}</p>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        {allowedItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setCurrentTab(item.id);
                onClose();
              }}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/20 translate-x-1'
                  : 'text-slate-400 hover:bg-slate-900/80 hover:text-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 transition-transform duration-200 ${isActive ? 'text-white scale-110' : 'text-slate-400'}`} />
              <span className="tracking-wide">{item.label}</span>
            </button>
          );
        })}

        {/* Collapsible "Manage Settings" Menu for Super Admin */}
        {isSuperAdmin && (
          <div className="space-y-1 pt-2 border-t border-slate-800/60 mt-2">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 text-slate-400 hover:bg-slate-900/80 hover:text-slate-100`}
            >
              <div className="flex items-center space-x-3">
                <Settings className="w-4 h-4 text-slate-400" />
                <span className="tracking-wide">Settings</span>
              </div>
              {settingsOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              )}
            </button>

            {/* Submenu Item */}
            {settingsOpen && (
              <div className="pl-6 space-y-1 animate-fade-in">
                <button
                  onClick={() => {
                    setCurrentTab('storage-management');
                    onClose();
                  }}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                    currentTab === 'storage-management'
                      ? 'bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-500 font-extrabold'
                      : 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 shrink-0" />
                  <span>Storage Config</span>
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User Session Profile & Logout */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40 backdrop-blur-md">
        <div className="flex items-center space-x-3 mb-3 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-xl flex items-center justify-center font-black text-sm shadow-md shadow-indigo-600/20">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-100 truncate">{user?.name}</p>
            <div className="flex items-center space-x-1 mt-0.5">
              <Shield className="w-3 h-3 text-indigo-400" />
              <p className="text-[9px] font-extrabold text-indigo-400 uppercase tracking-widest">
                {user?.role.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-rose-400 hover:border-rose-900/40 hover:bg-rose-950/20 transition-all duration-200 shadow-sm"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
