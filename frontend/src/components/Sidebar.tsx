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
    <div className="hidden md:flex md:flex-col w-64 bg-slate-900 border-r border-slate-800 text-slate-100 h-screen select-none shrink-0 relative">
      {/* Yard Logo & Branding */}
      <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary rounded-lg text-white shadow-lg shadow-primary/30">
            <Warehouse className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-tight text-white uppercase tracking-wider">YMS SaaS</h1>
            <p className="text-[10px] text-slate-400 font-medium">Yard Management System</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tenant Yard Context */}
      {user?.tenant && (
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/10">
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Active Yard</p>
          <p className="text-xs font-semibold text-slate-200 mt-1 truncate">{user.tenant.yardName}</p>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
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
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-100'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Collapsible "Manage Settings" Menu for Super Admin */}
        {isSuperAdmin && (
          <div className="space-y-1 pt-1">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 text-slate-400 hover:bg-slate-800/60 hover:text-slate-100`}
            >
              <div className="flex items-center space-x-3">
                <Settings className="w-5 h-5" />
                <span>Manage Settings</span>
              </div>
              {settingsOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
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
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    currentTab === 'storage-management'
                      ? 'bg-primary/20 text-primary border-l-2 border-primary'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200'
                  }`}
                >
                  <Database className="w-4 h-4 shrink-0" />
                  <span>Storage Management</span>
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User Session Profile & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-9 h-9 bg-primary/20 text-primary border border-primary/30 rounded-full flex items-center justify-center font-bold text-sm">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.name}</p>
            <div className="flex items-center space-x-1 mt-0.5">
              <Shield className="w-3 h-3 text-primary" />
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                {user?.role.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-800 bg-slate-950/30 text-slate-400 hover:text-rose-400 hover:border-rose-950/30 hover:bg-rose-950/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
