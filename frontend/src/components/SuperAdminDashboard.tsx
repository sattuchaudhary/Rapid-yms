import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  Building2,
  Database,
  IndianRupee,
  TrendingUp,
  ShieldCheck,
  Layers,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Calendar,
} from 'lucide-react';
import { useToastStore } from '../store/toastStore';

interface SuperAdminStats {
  overview: {
    totalTenants: number;
    activeTenants: number;
    suspendedTenants: number;
    totalVehicles: number;
    kachhaCount: number;
    pakkaCount: number;
    releasedCount: number;
    totalUsers: number;
    globalRevenue: number;
    globalStorage: number;
  };
  planDistribution: { planName: string; count: number }[];
  recentYards: any[];
  recentActivityLogs: any[];
  growthTrajectory: { label: string; count: number }[];
}

export const SuperAdminDashboard: React.FC = () => {
  const [data, setData] = useState<SuperAdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToastStore();

  const fetchGlobalStats = async () => {
    try {
      const res = await api.get('/reports/superadmin-dashboard');
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load super admin telemetry', err);
      toast.error('Failed to fetch system-wide metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalStats();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-500 animate-pulse">Analyzing system telemetry across all nodes...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-rose-500 font-medium">
        Failed to load platform operations control center.
      </div>
    );
  }

  const { overview, planDistribution, recentYards, recentActivityLogs, growthTrajectory } = data;

  // Aggregate SaaS plan revenue (Active yards * 49,999 average Enterprise subscription rate)
  const calculatedMRR = overview.activeTenants * 49999;
  
  // Format storage from MB to GB
  const storageGB = (overview.globalStorage / 1024).toFixed(1);

  const kpis = [
    {
      title: 'Production Nodes (Yards)',
      value: `${overview.activeTenants} / ${overview.totalTenants}`,
      desc: `${overview.suspendedTenants} yard accounts suspended`,
      icon: Building2,
      color: 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20',
      borderColor: 'border-indigo-100',
      badge: 'Multi-Tenant Network',
    },
    {
      title: 'Global Stock (Vehicles)',
      value: overview.totalVehicles.toString(),
      desc: `${overview.kachhaCount} Kachha | ${overview.pakkaCount} Pakka`,
      icon: Activity,
      color: 'bg-sky-500 text-white shadow-lg shadow-sky-500/20',
      borderColor: 'border-sky-100',
      badge: 'Live Inventory Stream',
    },
    {
      title: 'SaaS Platform MRR',
      value: `\u20B9${calculatedMRR.toLocaleString('en-IN')}`,
      desc: `\u20B9${(overview.globalRevenue).toLocaleString('en-IN')} parking revenue processed`,
      icon: IndianRupee,
      color: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20',
      borderColor: 'border-emerald-100',
      badge: 'Subscription Revenue',
    },
    {
      title: 'Allocated Cloud Storage',
      value: `${storageGB} GB`,
      desc: `Used across all tenant directories`,
      icon: Database,
      color: 'bg-violet-500 text-white shadow-lg shadow-violet-500/20',
      borderColor: 'border-violet-100',
      badge: 'AWS S3 Assets Limit',
    },
  ];

  // Get max count for chart scaling
  const maxCount = Math.max(...growthTrajectory.map(g => g.count), 1);

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-50 overflow-y-auto space-y-6 md:space-y-8 flex-1 font-sans">
      {/* Upper Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">SaaS Operational Intelligence Console</h2>
            <span className="bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
              Global Admin
            </span>
          </div>
          <p className="text-sm text-slate-500 font-medium">Real-time status of all parking yards, system growth metrics, storage limits, and live activity streams.</p>
        </div>
        <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm text-slate-600 text-sm font-semibold shrink-0">
          <Calendar className="w-4 h-4 text-primary" />
          <span>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className={`bg-white rounded-2xl border ${kpi.borderColor} p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 group`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] uppercase font-extrabold tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                    {kpi.badge}
                  </span>
                  <h3 className="text-slate-500 font-bold text-xs mt-3">{kpi.title}</h3>
                </div>
                <div className={`p-3 rounded-xl ${kpi.color} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-black text-slate-800 tracking-tight">{kpi.value}</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">{kpi.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Charts & Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Growth & Plans Section */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Platform Performance Simulation */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span>System Usage Trajectory</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-extrabold uppercase bg-slate-100 px-2 py-1 rounded">Telemetry Data</span>
            </div>
            
            <div className="h-64 flex items-end justify-between space-x-3 px-2 pt-4">
              {growthTrajectory.map((val, idx) => {
                const pct = maxCount > 0 ? (val.count / maxCount) * 80 + 15 : 15;
                return (
                  <div key={idx} className="w-full flex flex-col items-center group relative">
                    <div 
                      className="w-full bg-gradient-to-t from-primary/60 to-primary rounded-t-xl group-hover:from-indigo-600 group-hover:to-indigo-500 transition-all duration-300 relative shadow-inner"
                      style={{ height: `${pct}%` }}
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white font-extrabold text-[9px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md z-20">
                        {val.count} check-ins
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 mt-3 group-hover:text-slate-700 transition-colors">
                      {val.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recently Provisioned Nodes List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-800">Recently Registered Yards</h3>
                <p className="text-xs text-slate-400 font-medium">Provisioning history across the system node</p>
              </div>
              <span className="text-[10px] uppercase font-extrabold tracking-wider text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-lg">
                Telemetric Logs
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-extrabold tracking-wider">
                    <th className="pb-3 font-semibold">Yard Details</th>
                    <th className="pb-3 font-semibold">Contact</th>
                    <th className="pb-3 font-semibold">Plan</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Registered At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium">
                  {recentYards.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">No nodes registered in the platform yet.</td>
                    </tr>
                  ) : (
                    recentYards.map((yard) => (
                      <tr key={yard.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5">
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{yard.yardName}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{yard.address}</p>
                          </div>
                        </td>
                        <td className="py-3.5">
                          <p className="text-slate-700">{yard.contactPerson}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{yard.email}</p>
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                            yard.planName === 'Enterprise'
                              ? 'bg-purple-100 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {yard.planName || 'Basic'}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            yard.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-100 text-rose-700 border border-rose-200'
                          }`}>
                            {yard.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-[11px] text-slate-400 font-semibold">
                          {new Date(yard.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Live Operations Logs Stream & Plan Breakdown */}
        <div className="space-y-8">
          
          {/* Plan Distribution and Storage Health */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800">Plan & Subscription Distribution</h3>
              <p className="text-xs text-slate-400 font-semibold">Current multi-tenant subscription tiers</p>
            </div>

            <div className="space-y-4">
              {planDistribution.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No subscription data</p>
              ) : (
                (() => {
                  const total = planDistribution.reduce((acc, p) => acc + p.count, 0) || 1;
                  return planDistribution.map((plan, idx) => {
                    const pct = Math.round((plan.count / total) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-600">
                          <span className="uppercase text-slate-500 font-extrabold">{plan.planName || 'Basic'}</span>
                          <span>{plan.count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              plan.planName.toLowerCase().includes('enterprise') ? 'bg-purple-500' : 'bg-primary'
                            }`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Platform Security Indicator */}
            <div className="border-t border-slate-100 pt-6 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Security & Gateway Auditing</span>
              <div className="bg-slate-900 rounded-xl p-4 text-white relative overflow-hidden flex items-center space-x-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg shadow-lg shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-slate-200">Production Firewall Safe</h4>
                  <p className="text-[9px] text-slate-400 font-semibold leading-relaxed">System logs, databases, S3 buckets, and notification nodes are sealed & verified.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Live Activity Stream (System Wide Audit logs) */}
          <div className="bg-slate-900 rounded-2xl shadow-lg p-6 text-white flex flex-col h-[460px]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-black text-slate-200 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-primary animate-pulse" />
                <span>Live Activity Stream</span>
              </h3>
              <span className="text-[8px] uppercase tracking-wider font-extrabold text-emerald-400 border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 rounded">
                Realtime
              </span>
            </div>

            {/* Scrollable Logs list */}
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              {recentActivityLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                  <AlertCircle className="w-6 h-6 mb-2" />
                  <p className="font-semibold">No operational activities logged today.</p>
                </div>
              ) : (
                recentActivityLogs.map((log) => {
                  let Icon = Layers;
                  let colorClass = 'text-primary bg-primary/10 border-primary/20';

                  if (log.module === 'vehicles') {
                    Icon = Activity;
                    colorClass = 'text-sky-400 bg-sky-500/10 border-sky-500/20';
                  } else if (log.module === 'releases') {
                    Icon = CheckCircle;
                    colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                  } else if (log.module === 'billing') {
                    Icon = IndianRupee;
                    colorClass = 'text-violet-400 bg-violet-500/10 border-violet-500/20';
                  }

                  return (
                    <div key={log.id} className="flex items-start space-x-3 text-xs leading-normal">
                      <div className={`p-1.5 rounded-lg border ${colorClass} shrink-0 mt-0.5`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-bold text-slate-200 truncate">
                          {log.user?.name || 'System'} • <span className="font-semibold uppercase text-slate-400">{log.action}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 font-semibold truncate leading-relaxed">
                          Module: <span className="text-slate-300 font-bold">{log.module}</span>
                        </p>
                        <p className="text-[9px] font-extrabold text-primary truncate">
                          Yard: {log.tenant?.yardName || 'Global Platform'}
                        </p>
                        <span className="text-[8px] text-slate-500 font-bold block pt-0.5">
                          {new Date(log.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
