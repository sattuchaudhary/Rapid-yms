import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  Building2,
  Users,
  Database,
  DollarSign,
  PlusCircle,
  Search,
  ShieldCheck,
  Power,
  Ban,
  MapPin,
  Mail,
  Phone,
  Layers,
  TrendingUp,
  LogIn,
  Settings,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';


export const TenantManagement: React.FC = () => {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('analytics'); // analytics | yards | settings
  const [globalSettings, setGlobalSettings] = useState({
    basicPlanPrice: 19999,
    premiumPlanPrice: 29999,
    enterprisePlanPrice: 49999,
    maintenanceMode: false,
    region: 'ap-south-1',
    smtpHost: 'smtp.sendgrid.net',
    smtpPort: 587,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const { login } = useAuthStore();
  const toast = useToastStore();

  
  // Drawer/Modal Form state
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    yardName: '',
    address: '',
    contactPerson: '',
    email: '',
    phone: '',
    gstNumber: '',
    planName: 'Enterprise',
    storageLimit: 10240, // Default 10GB
    subdomain: '',
  });

  // Dynamic Notification configurator states
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configSubmitting, setConfigSubmitting] = useState(false);
  const [configError, setConfigError] = useState('');
  
  const [configData, setConfigData] = useState({
    notificationChannel: 'EMAIL',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    smtpFrom: '',
    twilioSid: '',
    twilioAuth: '',
    twilioFrom: '',
    whatsappApiKey: '',
    billingModel: 'HYBRID',
    maxVehicles: 1000,
    storageLimit: 10240,
  });

  const handleOpenConfigurator = (tenant: any) => {
    setSelectedTenant(tenant);
    setConfigData({
      notificationChannel: tenant.notificationChannel || 'EMAIL',
      smtpHost: tenant.smtpHost || '',
      smtpPort: tenant.smtpPort || 587,
      smtpUser: tenant.smtpUser || '',
      smtpPass: tenant.smtpPass || '',
      smtpFrom: tenant.smtpFrom || '',
      twilioSid: tenant.twilioSid || '',
      twilioAuth: tenant.twilioAuth || '',
      twilioFrom: tenant.twilioFrom || '',
      whatsappApiKey: tenant.whatsappApiKey || '',
      billingModel: tenant.billingModel || 'HYBRID',
      maxVehicles: tenant.maxVehicles !== undefined ? tenant.maxVehicles : 1000,
      storageLimit: tenant.storageLimit !== undefined ? tenant.storageLimit : 10240,
    });
    setIsConfigOpen(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSubmitting(true);
    setConfigError('');
    try {
      const res = await api.put(`/tenants/${selectedTenant.id}`, configData);
      if (res.data?.success) {
        toast.success(`Notification channels for ${selectedTenant.yardName} updated successfully!`);
        setIsConfigOpen(false);
        fetchTenants();
      }
    } catch (err: any) {
      setConfigError(err.response?.data?.error || 'Failed to save notification settings');
    } finally {
      setConfigSubmitting(false);
    }
  };

  // SaaS Subscription Webhook Simulator states
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState('');
  const [simTenant, setSimTenant] = useState<any>(null);
  
  const [simData, setSimData] = useState({
    eventType: 'invoice.payment_succeeded',
    planName: 'Enterprise',
  });

  const handleTriggerSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    setSimError('');
    try {
      const res = await api.post('/payments/simulate', {
        tenantId: simTenant.id,
        eventType: simData.eventType,
        planName: simData.planName,
      });
      if (res.data?.success) {
        toast.success(`Webhook Simulated: ${simTenant.yardName} status is now ${res.data.tenant.status}!`);
        setIsSimulateOpen(false);
        fetchTenants();
      }
    } catch (err: any) {
      setSimError(err.response?.data?.message || 'Failed to simulate payment webhook');
    } finally {
      setSimulating(false);
    }
  };

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tenants');
      if (res.data?.success) {
        setTenants(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch tenants', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.name === 'storageLimit' ? parseInt(e.target.value) || 0 : e.target.value;
    setFormData({ ...formData, [e.target.name]: val });
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/tenants', formData);
      if (res.data?.success) {
        toast.success('New Parking Yard added to SaaS successfully!');
        setIsOpen(false);
        // Clear form
        setFormData({
          yardName: '',
          address: '',
          contactPerson: '',
          email: '',
          phone: '',
          gstNumber: '',
          planName: 'Enterprise',
          storageLimit: 10240,
          subdomain: '',
        });
        fetchTenants();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to register new tenant yard');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMsg = `Are you sure you want to ${nextStatus === 'ACTIVE' ? 'ACTIVATE' : 'SUSPEND'} this yard?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.put(`/tenants/${tenantId}`, { status: nextStatus });
      if (res.data?.success) {
        toast.success(`Yard status updated to ${nextStatus}!`);
        fetchTenants();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update tenant status');
    }
  };

  const handleImpersonate = async (tenantId: string, yardName: string) => {
    if (!window.confirm(`Are you sure you want to log in as an administrator for ${yardName}?`)) return;
    
    try {
      const res = await api.post('/auth/impersonate', { targetTenantId: tenantId });
      if (res.data?.success) {
        const { user, accessToken, refreshToken } = res.data;
        login(user, accessToken, refreshToken);
        // Will trigger re-render and navigate to Tenant Dashboard automatically
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to impersonate tenant. Make sure they have an active TENANT_ADMIN user.');
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setTimeout(() => {
      setSavingSettings(false);
      toast.success('Global SaaS configuration saved successfully!');
    }, 1000);
  };

  // Filtered tenants
  const filtered = tenants.filter(t =>
    t.yardName.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase()) ||
    t.contactPerson.toLowerCase().includes(search.toLowerCase())
  );

  // Platform Metrics
  const activeYards = tenants.filter(t => t.status === 'ACTIVE').length;
  const suspendedYards = tenants.filter(t => t.status === 'SUSPENDED').length;
  const totalStorageAllocated = tenants.reduce((acc, t) => acc + (t.storageLimit || 0), 0) / 1024; // GB to TB

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-50 space-y-6 md:space-y-8 flex-1 overflow-y-auto relative font-sans">
      {/* Page Header with Tabs */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between space-y-4 md:space-y-0 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Super Admin Console</h2>
          <p className="text-sm text-slate-500 font-medium">Platform analytics, tenant provisioning, and global system health</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'analytics' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Platform Analytics
          </button>
          <button
            onClick={() => setActiveTab('yards')}
            className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'yards' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Yards Management
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'settings' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            SaaS Config
          </button>
        </div>
      </div>

      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Level Global Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 select-none">
            {/* Total Yards */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-6 rounded-2xl shadow-lg shadow-indigo-500/20 text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <span className="bg-white/20 px-2.5 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm">+2 this month</span>
              </div>
              <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-wider block">Total Live Yards</span>
              <span className="text-4xl font-extrabold tracking-tight">{tenants.length}</span>
            </div>

            {/* Global Storage */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-sky-300 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:bg-sky-500 group-hover:text-white transition-colors">
                  <Database className="w-6 h-6" />
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Allocated Cloud Space</span>
              <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{totalStorageAllocated.toFixed(2)} TB</span>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-sky-500 h-full w-[45%]"></div>
              </div>
            </div>

            {/* Total Subscriptions */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group hover:border-emerald-300 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SaaS Platform MRR</span>
              <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{"\u20B9"}{activeYards * 49999}</span>
              <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +15% from last month
              </p>
            </div>

            {/* System Health */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative group hover:border-primary/30 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-primary/10 text-primary rounded-xl group-hover:bg-primary group-hover:text-white transition-colors">
                  <Layers className="w-6 h-6" />
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Health</span>
              <span className="text-3xl font-extrabold text-slate-800 tracking-tight">99.9%</span>
              <p className="text-[10px] text-primary font-bold mt-2 flex items-center">
                <ShieldCheck className="w-3 h-3 mr-1" />
                All services operational
              </p>
            </div>
          </div>

          {/* Advanced Charts Area (UI Simulation for Advanced Look) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2 text-primary" />
                Platform Growth Trajectory (Last 6 Months)
              </h3>
              <div className="h-64 flex items-end justify-between space-x-2 px-2">
                {[
                  { val: 40, month: 'Nov' },
                  { val: 55, month: 'Dec' },
                  { val: 45, month: 'Jan' },
                  { val: 75, month: 'Feb' },
                  { val: 65, month: 'Mar' },
                  { val: 85, month: 'Apr' },
                  { val: 100, month: 'May' }
                ].map((item, i) => (
                  <div key={i} className="w-full flex flex-col items-center group">
                    <div 
                      className="w-full bg-primary/20 rounded-t-lg group-hover:bg-primary transition-all relative"
                      style={{ height: `${item.val}%` }}
                    >
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.val * 10}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 mt-3">
                      {item.month}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden flex flex-col">
              <div className="absolute right-0 top-0 w-32 h-32 bg-primary/20 blur-3xl"></div>
              <h3 className="text-sm font-bold text-slate-100 mb-6">Live Activity Stream</h3>
              
              <div className="space-y-4 flex-1">
                {[
                  { title: 'New yard provisioned', time: '10 mins ago', yard: 'Pune Central' },
                  { title: '100th vehicle entered', time: '1 hr ago', yard: 'Mumbai Logistics' },
                  { title: 'Storage limit reached', time: '3 hrs ago', yard: 'Delhi NCR Yard' },
                  { title: 'SaaS Plan Upgraded', time: '5 hrs ago', yard: 'Shree Parking' },
                ].map((log, i) => (
                  <div key={i} className="flex items-start space-x-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0"></div>
                    <div>
                      <p className="text-xs font-bold text-slate-200">{log.title}</p>
                      <p className="text-[10px] font-medium text-slate-400">{log.yard} • {log.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all">
                View Full Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'yards' && (
        <div className="space-y-6 animate-fade-in">
          {/* Yards Control Console Header */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Active Tenants Register</h3>
            <button
              onClick={() => setIsOpen(true)}
              className="bg-primary hover:bg-primary/95 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-primary/20 transition-all text-xs flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Provision New Parking Yard</span>
            </button>
          </div>

          {/* Aggregate Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 select-none">
            {/* Total Yards */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Registered Yards</span>
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{tenants.length}</span>
                <span className="text-[10px] font-semibold text-emerald-600 flex items-center mt-1">
                  <TrendingUp className="w-3 h-3 mr-0.5" />
                  <span>{activeYards} active in production</span>
                </span>
              </div>
            </div>

            {/* Global Storage */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 bg-sky-50 text-sky-600 rounded-xl">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Allocated Cloud Space</span>
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{totalStorageAllocated.toFixed(2)} TB</span>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">S3 photos & inventory PDFs limit</p>
              </div>
            </div>

            {/* Total Subscriptions */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Dynamic SaaS Plan MRR</span>
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{"\u20B9"}{activeYards * 49999} / mo</span>
                <p className="text-[10px] text-emerald-600 font-bold mt-1">{"\u20B9"}49,999/yard active monthly rate</p>
              </div>
            </div>

            {/* System Suspended */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Suspended Accounts</span>
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{suspendedYards}</span>
                <p className="text-[10px] text-rose-600 font-bold mt-1">Payment defaults or expired agreements</p>
              </div>
            </div>
          </div>

          {/* Control Console Search & Table */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 select-none">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search yards by Name, GST, Contact person..."
                  className="w-full text-slate-800 pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                />
              </div>
              <div className="flex items-center space-x-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/50">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Superadmin Console Only</span>
              </div>
            </div>

            {/* Yards Grid/Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden select-none">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                      <th className="p-4 font-semibold">Yard Details</th>
                      <th className="p-4 font-semibold">Contact Information</th>
                      <th className="p-4 font-semibold">Plan Level</th>
                      <th className="p-4 font-semibold">Storage Limit</th>
                      <th className="p-4 font-semibold">Status</th>
                      <th className="p-4 font-semibold">GST Details</th>
                      <th className="p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold">Fetching SaaS tenants...</td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold">No provisioned yards match search criteria</td>
                      </tr>
                    ) : (
                      filtered.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center space-x-3">
                              {t.logo ? (
                                <img src={t.logo} alt="logo" className="w-9 h-9 object-cover rounded-lg border shadow-sm shrink-0" />
                              ) : (
                                <div className="w-9 h-9 bg-primary/10 text-primary border border-primary/20 rounded-lg flex items-center justify-center shrink-0">
                                  <Building2 className="w-5 h-5" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-slate-800 text-sm tracking-tight">{t.yardName}</p>
                                <span className="text-[10px] text-slate-400 flex items-center mt-0.5">
                                  <MapPin className="w-3 h-3 mr-0.5 text-slate-300" />
                                  <span className="truncate max-w-[200px]">{t.address}</span>
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="p-4 space-y-1">
                            <div className="text-slate-700 font-bold flex items-center space-x-1">
                              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{t.contactPerson}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center space-x-1 font-semibold">
                              <Mail className="w-3 h-3 text-slate-300" />
                              <span>{t.email}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center space-x-1 font-semibold">
                              <Phone className="w-3 h-3 text-slate-300" />
                              <span>{t.phone}</span>
                            </div>
                          </td>

                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider ${
                              t.planName === 'Enterprise'
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {t.planName || 'Basic'}
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="font-bold text-slate-700">{(t.storageLimit || 0) / 1024} GB</div>
                            <span className="text-[9px] text-slate-400">AWS Cloud drive limit</span>
                          </td>

                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] ${
                              t.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-100 text-rose-700 border border-rose-200'
                            }`}>
                              {t.status}
                            </span>
                          </td>

                          <td className="p-4">
                            <span className="font-semibold text-slate-500 font-mono text-[10px]">
                              {t.gstNumber || 'N/A'}
                            </span>
                          </td>

                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleImpersonate(t.id, t.yardName)}
                                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-primary hover:text-white hover:border-primary transition-all"
                                title="Login As Yard Admin"
                              >
                                <LogIn className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenConfigurator(t)}
                                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all"
                                title="Configure Notification Keys"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSimTenant(t);
                                  setSimData({ eventType: 'invoice.payment_succeeded', planName: t.planName || 'Enterprise' });
                                  setIsSimulateOpen(true);
                                }}
                                className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 transition-all"
                                title="Simulate Gateway Webhook"
                              >
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(t.id, t.status)}
                                className={`p-2 rounded-lg border transition-all ${
                                  t.status === 'ACTIVE'
                                    ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100/50'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100/50'
                                }`}
                                title={t.status === 'ACTIVE' ? 'Suspend Yard' : 'Activate Yard'}
                              >
                                {t.status === 'ACTIVE' ? <Ban className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 animate-fade-in text-slate-800">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Global Plan Pricing */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">Global SaaS Pricing Plans</h3>
                <p className="text-xs text-slate-400 font-semibold">Define the subscription rates charged to Yard Owners monthly.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Basic Plan Rate</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">{"\u20B9"}</span>
                    <input
                      type="number"
                      required
                      value={globalSettings.basicPlanPrice}
                      onChange={(e) => setGlobalSettings({ ...globalSettings, basicPlanPrice: parseInt(e.target.value) || 0 })}
                      className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs font-bold"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">Up to 2GB S3 limit</span>
                </div>

                <div className="space-y-1.5 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Premium Plan Rate</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">{"\u20B9"}</span>
                    <input
                      type="number"
                      required
                      value={globalSettings.premiumPlanPrice}
                      onChange={(e) => setGlobalSettings({ ...globalSettings, premiumPlanPrice: parseInt(e.target.value) || 0 })}
                      className="w-full pl-6 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs font-bold"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">Up to 10GB S3 limit</span>
                </div>

                <div className="space-y-1.5 p-4 rounded-xl border border-purple-100 bg-purple-50/30">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block">Enterprise Plan Rate</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">{"\u20B9"}</span>
                    <input
                      type="number"
                      required
                      value={globalSettings.enterprisePlanPrice}
                      onChange={(e) => setGlobalSettings({ ...globalSettings, enterprisePlanPrice: parseInt(e.target.value) || 0 })}
                      className="w-full pl-6 pr-3 py-1.5 bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-xs font-bold text-purple-700"
                    />
                  </div>
                  <span className="text-[9px] text-purple-500 font-medium">Up to 50GB S3 limit</span>
                </div>
              </div>

              {/* Advanced System Controls */}
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Security & System Controls</h4>
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50/30">
                  <div>
                    <h5 className="text-xs font-bold text-slate-700">Platform Maintenance Mode</h5>
                    <p className="text-[10px] text-slate-400 font-semibold">Temporarily block access for all tenant operations to run database migrations.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGlobalSettings({ ...globalSettings, maintenanceMode: !globalSettings.maintenanceMode })}
                    className={`w-12 h-6 flex items-center rounded-full p-1 transition-all ${
                      globalSettings.maintenanceMode ? 'bg-rose-500 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <span className="bg-white w-4 h-4 rounded-full shadow-md"></span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cloud & Server Infrastructure */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">Cloud Infrastructure</h3>
                <p className="text-xs text-slate-400 font-semibold">Global storage and communication gateway configs.</p>
              </div>

              {/* AWS Configuration */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">AWS S3 Region</label>
                  <select
                    value={globalSettings.region}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, region: e.target.value })}
                    className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs font-semibold"
                  >
                    <option value="ap-south-1">ap-south-1 (Mumbai)</option>
                    <option value="us-east-1">us-east-1 (N. Virginia)</option>
                    <option value="eu-central-1">eu-central-1 (Frankfurt)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SMTP Mail Host</label>
                  <input
                    type="text"
                    required
                    value={globalSettings.smtpHost}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, smtpHost: e.target.value })}
                    className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SMTP Port</label>
                  <input
                    type="number"
                    required
                    value={globalSettings.smtpPort}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, smtpPort: parseInt(e.target.value) || 0 })}
                    className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl transition-all text-xs flex items-center justify-center space-x-2 pt-3"
              >
                {savingSettings ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving configurations...</span>
                  </>
                ) : (
                  <span>Save Global Configuration</span>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Draw-out Slide Modal (New Yard Provisioning) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end animate-fade-in select-none">
          <div className="w-full max-w-lg bg-white h-screen shadow-2xl flex flex-col justify-between overflow-y-auto p-6 animate-slide-in">
            {/* Drawer Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Provision New Yard Tenant</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Spin up an isolated database workspace and configure cloud limits for a new yard partner.</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleCreateTenant} className="flex-1 my-6 space-y-4 overflow-y-auto pr-1">
              {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-lg text-xs font-semibold">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Parking Yard Name *</label>
                <input
                  type="text"
                  name="yardName"
                  required
                  value={formData.yardName}
                  onChange={handleChange}
                  placeholder="e.g. Pune City Repossession Yard"
                  className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                />
              </div>

              <div className="space-y-1 animate-fade-in text-left">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Subdomain Prefix (Optional)</label>
                <div className="flex items-center shadow-sm rounded-xl overflow-hidden border border-slate-200">
                  <input
                    type="text"
                    name="subdomain"
                    value={formData.subdomain || ''}
                    onChange={handleChange}
                    placeholder="e.g. pune"
                    className="flex-1 bg-white text-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  />
                  <span className="bg-slate-100 text-slate-400 px-3.5 py-2 border-l border-slate-200 text-xs font-bold font-mono">
                    .myyard.com
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 font-semibold leading-relaxed block mt-0.5">Leave blank to automatically slugify from Parking Yard Name.</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Physical Address *</label>
                <input
                  type="text"
                  name="address"
                  required
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Pune Bypass Highway, Hadapsar, MH"
                  className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Contact Person Name *</label>
                  <input
                    type="text"
                    name="contactPerson"
                    required
                    value={formData.contactPerson}
                    onChange={handleChange}
                    placeholder="Milind Rao"
                    className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">GST Number (Optional)</label>
                  <input
                    type="text"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleChange}
                    placeholder="27ABCDE1234F1Z1"
                    className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Secure Email (Primary admin) *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="puneadmin@yms.com"
                    className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number *</label>
                  <input
                    type="text"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+919800000000"
                    className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SaaS Pricing Plan</label>
                  <select
                    name="planName"
                    value={formData.planName}
                    onChange={handleChange}
                    className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  >
                    <option value="Basic">Basic ({"\u20B9"}19,999/mo)</option>
                    <option value="Premium">Premium ({"\u20B9"}29,999/mo)</option>
                    <option value="Enterprise">Enterprise ({"\u20B9"}49,999/mo)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cloud Storage Quota</label>
                  <select
                    name="storageLimit"
                    value={formData.storageLimit}
                    onChange={handleChange}
                    className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  >
                    <option value={2048}>2 GB (Basic)</option>
                    <option value={5120}>5 GB (Standard)</option>
                    <option value={10240}>10 GB (Premium)</option>
                    <option value={51200}>50 GB (Enterprise)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary/95 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all text-xs flex items-center justify-center space-x-2 pt-3"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Provisioning secure workspace...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Deploy Workspace Workspace</span>
                  </>
                )}
              </button>
            </form>

            {/* Bottom Actions */}
            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold py-2.5 rounded-xl text-xs"
              >
                Cancel provision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings Configurator Modal */}
      {isConfigOpen && selectedTenant && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end animate-fade-in select-none text-slate-800">
          <div className="w-full max-w-lg bg-white h-screen shadow-2xl flex flex-col justify-between overflow-y-auto p-6 animate-slide-in">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Configure Gate Alerts</h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Setup API keys, credentials, and notification channels for <strong>{selectedTenant.yardName}</strong>.
                </p>
              </div>
              <button
                onClick={() => setIsConfigOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Config Form */}
            <form onSubmit={handleSaveConfig} className="flex-1 my-6 space-y-5 overflow-y-auto pr-1">
              {configError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-lg text-xs font-semibold">
                  {configError}
                </div>
              )}

              {/* SaaS Billing & Quota Manager Section */}
              <div className="space-y-4 border-b border-slate-100 pb-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">SaaS Quotas & Limits</h4>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Billing Model Model</label>
                  <select
                    value={configData.billingModel}
                    onChange={(e) => setConfigData({ ...configData, billingModel: e.target.value })}
                    className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  >
                    <option value="VEHICLE">Vehicle volume limit only</option>
                    <option value="STORAGE">Cloud Storage space limit only</option>
                    <option value="HYBRID">Hybrid (Both limits concurrent)</option>
                    <option value="UNLIMITED">Unlimited (VIP Enterprise)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Render Max Vehicles limit if VEHICLE or HYBRID selected */}
                  {(configData.billingModel === 'VEHICLE' || configData.billingModel === 'HYBRID') ? (
                    <div className="space-y-1 animate-fade-in">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Max Vehicles Limit</label>
                      <input
                        type="number"
                        value={configData.maxVehicles}
                        onChange={(e) => setConfigData({ ...configData, maxVehicles: parseInt(e.target.value) || 0 })}
                        placeholder="1000"
                        className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                      />
                      <span className="text-[9px] text-slate-400 font-medium">Set -1 for infinite vehicles</span>
                    </div>
                  ) : (
                    <div className="space-y-1 opacity-50 select-none">
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Max Vehicles Limit</label>
                      <input
                        type="text"
                        disabled
                        value="Bypassed (Unlimited)"
                        className="w-full bg-slate-50 text-slate-300 px-3 py-2 rounded-xl border border-slate-100 text-xs font-semibold"
                      />
                    </div>
                  )}

                  {/* Render Storage Limit if STORAGE or HYBRID selected */}
                  {(configData.billingModel === 'STORAGE' || configData.billingModel === 'HYBRID') ? (
                    <div className="space-y-1 animate-fade-in">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Storage Space Limit</label>
                      <select
                        value={configData.storageLimit}
                        onChange={(e) => setConfigData({ ...configData, storageLimit: parseInt(e.target.value) || 2048 })}
                        className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                      >
                        <option value={2048}>2 GB (Basic)</option>
                        <option value={5120}>5 GB (Standard)</option>
                        <option value={10240}>10 GB (Premium)</option>
                        <option value={51200}>50 GB (Enterprise)</option>
                        <option value={-1}>Infinite Storage (-1)</option>
                      </select>
                      <span className="text-[9px] text-slate-400 font-medium">S3 cloud aggregate limit</span>
                    </div>
                  ) : (
                    <div className="space-y-1 opacity-50 select-none">
                      <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Storage Space Limit</label>
                      <input
                        type="text"
                        disabled
                        value="Bypassed (Unlimited)"
                        className="w-full bg-slate-50 text-slate-300 px-3 py-2 rounded-xl border border-slate-100 text-xs font-semibold"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Dispatch Channel</label>
                <select
                  value={configData.notificationChannel}
                  onChange={(e) => setConfigData({ ...configData, notificationChannel: e.target.value })}
                  className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                >
                  <option value="EMAIL">Email Dispatch (SMTP Client)</option>
                  <option value="WHATSAPP">WhatsApp Cloud API (Meta API Key)</option>
                  <option value="SMS">Twilio SMS (Custom SID/Auth)</option>
                  <option value="NONE">None (Disabled)</option>
                </select>
              </div>

              {/* Conditional EMAIL Fields */}
              {configData.notificationChannel === 'EMAIL' && (
                <div className="space-y-4 border-t border-slate-100 pt-4 animate-fade-in">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">SMTP Configurations</h4>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SMTP Host</label>
                      <input
                        type="text"
                        required
                        value={configData.smtpHost}
                        onChange={(e) => setConfigData({ ...configData, smtpHost: e.target.value })}
                        placeholder="smtp.gmail.com"
                        className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SMTP Port</label>
                      <input
                        type="number"
                        required
                        value={configData.smtpPort}
                        onChange={(e) => setConfigData({ ...configData, smtpPort: parseInt(e.target.value) || 587 })}
                        placeholder="587"
                        className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SMTP Username</label>
                      <input
                        type="text"
                        required
                        value={configData.smtpUser}
                        onChange={(e) => setConfigData({ ...configData, smtpUser: e.target.value })}
                        placeholder="user@gmail.com"
                        className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SMTP Password</label>
                      <input
                        type="password"
                        required
                        value={configData.smtpPass}
                        onChange={(e) => setConfigData({ ...configData, smtpPass: e.target.value })}
                        placeholder="••••••••"
                        className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sender Email (From)</label>
                    <input
                      type="email"
                      required
                      value={configData.smtpFrom}
                      onChange={(e) => setConfigData({ ...configData, smtpFrom: e.target.value })}
                      placeholder="alerts@youryard.com"
                      className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Conditional WHATSAPP Fields */}
              {configData.notificationChannel === 'WHATSAPP' && (
                <div className="space-y-4 border-t border-slate-100 pt-4 animate-fade-in">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Meta API Credentials</h4>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WhatsApp System API Token</label>
                    <input
                      type="password"
                      required
                      value={configData.whatsappApiKey}
                      onChange={(e) => setConfigData({ ...configData, whatsappApiKey: e.target.value })}
                      placeholder="EAAW..."
                      className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              {/* Conditional TWILIO SMS Fields */}
              {configData.notificationChannel === 'SMS' && (
                <div className="space-y-4 border-t border-slate-100 pt-4 animate-fade-in">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Twilio SMS Credentials</h4>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Twilio Account SID</label>
                    <input
                      type="text"
                      required
                      value={configData.twilioSid}
                      onChange={(e) => setConfigData({ ...configData, twilioSid: e.target.value })}
                      placeholder="AC..."
                      className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Twilio Auth Token</label>
                    <input
                      type="password"
                      required
                      value={configData.twilioAuth}
                      onChange={(e) => setConfigData({ ...configData, twilioAuth: e.target.value })}
                      placeholder="••••••••"
                      className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Twilio Sender Number (From)</label>
                    <input
                      type="text"
                      required
                      value={configData.twilioFrom}
                      onChange={(e) => setConfigData({ ...configData, twilioFrom: e.target.value })}
                      placeholder="+1234567890"
                      className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={configSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all text-xs flex items-center justify-center space-x-2 pt-3"
              >
                {configSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving configurations...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Apply Gate Configurations</span>
                  </>
                )}
              </button>
            </form>

            {/* Bottom Actions */}
            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="w-full border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold py-2.5 rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SaaS Webhook Simulator Modal */}
      {isSimulateOpen && simTenant && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 animate-fade-in select-none text-slate-800">
          <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-2xl relative space-y-6 animate-scale-in">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-emerald-500 animate-pulse" />
                  <span>SaaS Gateway Simulator</span>
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-1">
                  Trigger mock subscription webhooks for <strong>{simTenant.yardName}</strong>.
                </p>
              </div>
              <button
                onClick={() => setIsSimulateOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Sim Form */}
            <form onSubmit={handleTriggerSimulation} className="space-y-4">
              {simError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 p-3 rounded-lg text-xs font-semibold">
                  {simError}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Gateway Event Type</label>
                <select
                  value={simData.eventType}
                  onChange={(e) => setSimData({ ...simData, eventType: e.target.value })}
                  className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                >
                  <option value="invoice.payment_succeeded">Stripe: invoice.payment_succeeded (Re-activate & Renew)</option>
                  <option value="invoice.payment_failed">Stripe: invoice.payment_failed (Suspend Yard access)</option>
                  <option value="subscription.canceled">Stripe: subscription.canceled (De-provision & Suspend)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Subscription Tier</label>
                <select
                  value={simData.planName}
                  onChange={(e) => setSimData({ ...simData, planName: e.target.value })}
                  className="w-full text-slate-800 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                >
                  <option value="Basic">Basic Plan ({"\u20B9"}19,999/mo)</option>
                  <option value="Premium">Premium Plan ({"\u20B9"}29,999/mo)</option>
                  <option value="Enterprise">Enterprise Plan ({"\u20B9"}49,999/mo)</option>
                </select>
              </div>

              <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
                <div className="flex space-x-3 items-center">
                  <span className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest">Mocking Engine</span>
                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded text-[9px] uppercase font-bold">Stripe API v3</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal px-2">
                  This simulates Stripe billing servers delivering a cryptographic JSON payload containing this tenant's UUID context.
                </p>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSimulateOpen(false)}
                  className="w-1/3 border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="w-2/3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 transition-all text-xs flex items-center justify-center space-x-2"
                >
                  {simulating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Simulating webhook...</span>
                    </>
                  ) : (
                    <span>Transmit Webhook</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantManagement;
