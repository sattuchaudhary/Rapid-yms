import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Truck,
  IndianRupee,
  Activity,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Search,
  X,
  Clock,
  ExternalLink,
  Plus,
  Coins,
  FileText,
  Sparkles,
  KeyRound,
  Leaf,
  Shield,
  LayoutGrid,
  CheckSquare,
  Layers,
  Users,
  ClipboardCheck,
} from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { UnifiedReleaseModal } from './UnifiedReleaseModal';


interface DashboardStats {
  stats: {
    totalVehicles: number;
    kachhaVehicles: {
      thisMonth: number;
      total: number;
    };
    pakkaVehicles: {
      thisMonth: number;
      total: number;
    };
    releasedVehicles: {
      today: number;
      thisMonth: number;
      thisYear: number;
    };
    pendingReleases: number;
    dailyRevenue: {
      today: { amount: number; count: number };
      thisMonth: { amount: number; count: number };
      thisYear: { amount: number; count: number };
    };
    dailyLoss: {
      today: { amount: number; count: number };
      thisMonth: { amount: number; count: number };
      thisYear: { amount: number; count: number };
    };
  };
  bankStats: { bank: string; count: number }[];
  recentEntries: any[];
  recentReleases: any[];
}


interface DashboardProps {
  setCurrentTab?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ setCurrentTab }) => {
  const toast = useToastStore();
  const { user } = useAuthStore();
  const userRole = user?.role;

  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [calcDays, setCalcDays] = useState<number>(30);
  const [calcRate, setCalcRate] = useState<number>(150);

  // ==========================================
  // VEHICLE QUICK RELEASE DESK STATE
  // ==========================================
  const [releaseWizardOpen, setReleaseWizardOpen] = useState(false);

  // Callback to refresh dashboard stats after a successful release
  const handleReleaseSuccess = async () => {
    try {
      const statsRes = await api.get('/reports/dashboard');
      if (statsRes.data?.success) {
        setData(statsRes.data.data);
      }
    } catch (e) {
      console.error('Failed to reload dashboard stats after release', e);
    }
  };

  // Detail Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalVehicles, setModalVehicles] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Custom modal date filters
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');
  const [modalActiveStatus, setModalActiveStatus] = useState<'KACHHA' | 'PAKKA' | 'RELEASED' | 'REVENUE' | 'LOSS' | null>(null);

  // Custom Dashboard Date Range states
  const [dateMode, setDateMode] = useState<'realtime' | 'custom'>('realtime');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const fetchStats = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const params: any = {};
      if (start) params.startDate = start;
      if (end) params.endDate = end;
      const res = await api.get('/reports/dashboard', { params });
      if (res.data?.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCountClick = async (status: 'KACHHA' | 'PAKKA', timeframe: 'this_month' | 'all') => {
    setModalOpen(true);
    setModalLoading(true);
    setSearchTerm('');
    setBankFilter('');
    setTypeFilter('');
    setModalStartDate('');
    setModalEndDate('');
    setModalActiveStatus(status);
    setModalTitle(
      `Active ${status === 'PAKKA' ? 'Pakka' : 'Kachha'} Vehicles - ${
        timeframe === 'this_month' ? 'This Month' : 'Total Stock'
      }`
    );
    try {
      const res = await api.get('/reports/dashboard/vehicles', {
        params: { status, timeframe },
      });
      if (res.data?.success) {
        setModalVehicles(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load modal vehicles', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleThreeClick = async (status: 'RELEASED' | 'REVENUE' | 'LOSS', timeframe: 'today' | 'this_month' | 'this_year' | 'custom') => {
    setModalOpen(true);
    setModalLoading(true);
    setSearchTerm('');
    setBankFilter('');
    setTypeFilter('');
    setModalStartDate('');
    setModalEndDate('');
    setModalActiveStatus(status);
    
    const timeframeLabels: any = { today: 'Today', this_month: 'This Month', this_year: 'This Year', custom: 'Custom Period' };
    const statusLabels: any = { RELEASED: 'Released Vehicles', REVENUE: 'Revenue Details', LOSS: 'Loss Liability' };
    setModalTitle(`${statusLabels[status]} - ${timeframeLabels[timeframe]}`);
    
    try {
      const params: any = { status, timeframe };
      if (timeframe === 'custom') {
        if (customStartDate) params.startDate = customStartDate;
        if (customEndDate) params.endDate = customEndDate;
      }
      const res = await api.get('/reports/dashboard/vehicles', { params });
      if (res.data?.success) {
        setModalVehicles(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load modal vehicles', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalDateApply = async () => {
    if (!modalActiveStatus || !modalStartDate || !modalEndDate) return;
    setModalLoading(true);
    try {
      const res = await api.get('/reports/dashboard/vehicles', {
        params: {
          status: modalActiveStatus,
          timeframe: 'custom',
          startDate: modalStartDate,
          endDate: modalEndDate
        }
      });
      if (res.data?.success) {
        setModalVehicles(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load modal custom range vehicles', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleResetAllModalFilters = async () => {
    setSearchTerm('');
    setBankFilter('');
    setTypeFilter('');
    setModalStartDate('');
    setModalEndDate('');
    
    if (!modalActiveStatus) return;
    setModalLoading(true);
    try {
      let tf = 'all';
      if (modalTitle.toLowerCase().includes('today')) tf = 'today';
      else if (modalTitle.toLowerCase().includes('month')) tf = 'this_month';
      else if (modalTitle.toLowerCase().includes('year')) tf = 'this_year';
      else if (modalTitle.toLowerCase().includes('custom') && dateMode === 'custom') {
        tf = 'custom';
      }

      const params: any = { status: modalActiveStatus, timeframe: tf };
      if (tf === 'custom') {
        if (customStartDate) params.startDate = customStartDate;
        if (customEndDate) params.endDate = customEndDate;
      }

      const res = await api.get('/reports/dashboard/vehicles', { params });
      if (res.data?.success) {
        setModalVehicles(res.data.data);
      }
    } catch (err) {
      console.error('Failed to reset and reload modal vehicles', err);
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-500">Loading live yard metrics...</p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center text-rose-500 font-medium">Failed to load system dashboard</div>;

  const { stats, bankStats, recentEntries, recentReleases } = data;

  const cards = [
    {
      type: 'interactive' as const,
      statusType: 'PAKKA' as const,
      title: 'Pakka Vehicles',
      desc: 'Active parking billing',
      icon: CheckCircle,
      color: 'bg-pakka text-white shadow-lg shadow-pakka/20',
      badge: 'Pakka Active',
      borderColor: 'border-emerald-200',
      counts: stats.pakkaVehicles,
    },
    {
      type: 'interactive' as const,
      statusType: 'KACHHA' as const,
      title: 'Kachha Vehicles',
      desc: 'Repo kit / billing pending',
      icon: AlertCircle,
      color: 'bg-kachha text-white shadow-lg shadow-kachha/20',
      badge: 'Kachha Active',
      borderColor: 'border-amber-200',
      counts: stats.kachhaVehicles,
    },
    {
      type: 'standard' as const,
      title: 'Pending Releases',
      value: stats.pendingReleases,
      desc: 'Awaiting gate pass / approval',
      icon: Clock,
      color: 'bg-blue-500 text-white shadow-lg shadow-blue-500/20',
      badge: 'Approvals Pending',
      borderColor: 'border-blue-200',
    },
    {
      type: 'interactive-three' as const,
      statusType: 'RELEASED' as const,
      title: 'Released Vehicles',
      desc: 'Successfully dispatched',
      icon: ShieldCheck,
      color: 'bg-teal-600 text-white shadow-lg shadow-teal-600/20',
      badge: 'Dispatched',
      borderColor: 'border-teal-200',
      threeValues: stats.releasedVehicles,
    },
    {
      type: 'interactive-three' as const,
      statusType: 'REVENUE' as const,
      title: 'Daily Revenue',
      desc: 'Calculated parking fees',
      icon: IndianRupee,
      color: 'bg-revenue text-white shadow-lg shadow-revenue/20',
      badge: 'Billing Engine',
      borderColor: 'border-indigo-200',
      threeValues: stats.dailyRevenue,
      isCurrency: true,
    },
    {
      type: 'interactive-three' as const,
      statusType: 'LOSS' as const,
      title: 'Yard Daily Loss',
      desc: 'Loss from Kachha delay',
      icon: TrendingUp,
      color: 'bg-loss text-white shadow-lg shadow-loss/20',
      badge: 'Kachha Liability',
      borderColor: 'border-rose-200',
      threeValues: stats.dailyLoss,
      isCurrency: true,
    },
  ];

  const renderGuardDashboard = () => {
    return (
      <div className="space-y-6 animate-fade-in select-none">
        {/* Top Welcome Shift Card */}
        <div className="bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-800">
          <div className="absolute right-0 top-0 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none animate-pulse"></div>
          <div className="z-10 space-y-2">
            <span className="bg-primary/20 border border-primary/30 text-primary text-[9px] uppercase font-black tracking-widest px-3 py-1 rounded-full shadow-inner">
              Gate Terminal Station
            </span>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight font-display text-white mt-1">
              Welcome Back, {user?.name}!
            </h2>
            <p className="text-xs text-slate-400 font-bold">
              Shift Operations: <span className="text-primary font-black uppercase">{user?.tenant.yardName} Entry/Exit Node</span>
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl shrink-0 shadow-lg text-slate-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-white uppercase tracking-wider text-[10px] font-black">Gate Monitor Online</span>
          </div>
        </div>

        {/* Guard Quick Frontline Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card A: New Gate Entry */}
          <button
            onClick={() => setCurrentTab && setCurrentTab('vehicle-entry')}
            className="flex flex-col items-start justify-between bg-gradient-to-tr from-primary to-indigo-650 hover:from-primary/95 hover:to-indigo-650/95 border border-primary/25 rounded-[28px] p-6 text-left h-44 transition-all duration-300 active:scale-98 shadow-xl shadow-primary/10 group cursor-pointer"
          >
            <div className="p-3 bg-white/10 rounded-2xl text-white group-hover:scale-110 transition-transform shadow-lg border border-white/5">
              <Plus className="w-6 h-6 stroke-[3]" />
            </div>
            <div className="space-y-1">
              <span className="text-lg font-black tracking-wide block text-white uppercase">New Gate Check-In</span>
              <span className="text-xs text-white/80 font-bold block">Log Seizure, Accessories checklist & photos</span>
            </div>
          </button>

          {/* Card B: Checkout desk */}
          <button
            onClick={() => setReleaseWizardOpen(true)}
            className="flex flex-col items-start justify-between bg-slate-900 hover:bg-slate-900/95 border border-slate-800/80 rounded-[28px] p-6 text-left h-44 transition-all duration-300 active:scale-98 shadow-xl group cursor-pointer relative"
          >
            <div className="absolute right-6 top-6 w-16 h-16 bg-amber-500/5 rounded-full blur-xl"></div>
            <div className="p-3 bg-slate-850 text-amber-400 rounded-2xl group-hover:scale-110 transition-transform shadow-lg border border-slate-800">
              <KeyRound className="w-6 h-6 text-amber-400" />
            </div>
            <div className="space-y-1">
              <span className="text-lg font-black tracking-wide block text-white uppercase">Gate Pass Checkout Portal</span>
              <span className="text-xs text-slate-500 font-bold block">Verify clearance payments & issue gate pass</span>
            </div>
          </button>
        </div>

        {/* Offline Dues Estimator & In-Yard Activity logs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Bill Calculator */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-md flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
                <IndianRupee className="w-5 h-5 text-emerald-500" />
                <span className="uppercase tracking-wider">Quick Dues Calculator</span>
              </h3>
              <p className="text-[10px] text-slate-450 font-bold mt-1">Estimate parking dues for inquiring customers</p>
            </div>

            <div className="space-y-4 my-6 flex-1">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block">Days Parked</label>
                <input
                  type="number"
                  value={calcDays}
                  onChange={(e) => setCalcDays(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary"
                  min="1"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-455 uppercase tracking-wider block">Rate Per Day (₹)</label>
                <input
                  type="number"
                  value={calcRate}
                  onChange={(e) => setCalcRate(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white focus:border-primary"
                  min="1"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center mt-4 shadow-sm">
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block">Estimated Charge</span>
                <span className="text-xl font-black text-emerald-700 block mt-1">₹{(calcDays * calcRate).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Table: Guard shift logs */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-md lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
                <Truck className="w-5 h-5 text-indigo-500" />
                <span className="uppercase tracking-wider">Gate Check-In Shift Log</span>
              </h3>
              <p className="text-[10px] text-slate-455 font-bold mt-1">Latest vehicle check-ins logged under your node</p>
            </div>

            <div className="my-6 flex-1 overflow-x-auto min-h-[220px]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                    <th className="pb-3 font-extrabold">Vehicle No</th>
                    <th className="pb-3 font-extrabold">Model</th>
                    <th className="pb-3 font-extrabold">Bank</th>
                    <th className="pb-3 font-extrabold">Status</th>
                    <th className="pb-3 font-extrabold">Slot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-655 font-semibold">
                  {recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">No entries logged today</td>
                    </tr>
                  ) : (
                    recentEntries.slice(0, 5).map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 font-black text-slate-800 uppercase tracking-wide">{v.vehicleNumber}</td>
                        <td className="py-3 text-slate-500 font-bold">{v.brand} {v.model}</td>
                        <td className="py-3 text-slate-600 font-bold">{v.bankName}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] ${
                            v.yardStatus === 'KACHHA'
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}>
                            {v.yardStatus}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {v.yardLocation?.slot || 'Unallocated'}
                          </span>
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
    );
  };

  const renderSupervisorDashboard = () => {
    // Generate Zone occupancy visual stats
    const zones = [
      { id: 'A', name: 'Zone A - Cars / SUVs', occupied: 38, capacity: 50, color: 'bg-indigo-600' },
      { id: 'B', name: 'Zone B - 2-Wheelers', occupied: 18, capacity: 40, color: 'bg-emerald-600' },
      { id: 'CV', name: 'Zone CV - Commercials', occupied: 4, capacity: 10, color: 'bg-amber-600' },
    ];

    return (
      <div className="space-y-6 animate-fade-in select-none">
        {/* Top Welcome Card */}
        <div className="bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-800">
          <div className="absolute right-0 top-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none animate-pulse"></div>
          <div className="z-10 space-y-2">
            <span className="bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 text-[9px] uppercase font-black tracking-widest px-3 py-1 rounded-full shadow-inner">
              Yard Supervisor Node
            </span>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight font-display text-white mt-1">
              Welcome Back, {user?.name}!
            </h2>
            <p className="text-xs text-slate-400 font-bold">
              Space Allocation Station: <span className="text-indigo-400 font-black uppercase">{user?.tenant.yardName} Inventory Control</span>
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl shrink-0 shadow-lg text-slate-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
            <span className="text-white uppercase tracking-wider text-[10px] font-black">Stock Coordinator Online</span>
          </div>
        </div>

        {/* Supervisor Actions Center */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Action A: Allocate Slots */}
          <button
            onClick={() => setCurrentTab && setCurrentTab('vehicles')}
            className="flex flex-col items-start justify-between bg-slate-900 hover:bg-slate-900/95 border border-slate-800/80 rounded-[28px] p-6 text-left h-36 transition-all duration-300 active:scale-98 shadow-xl group cursor-pointer"
          >
            <div className="p-3 bg-slate-850 text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform shadow-lg border border-slate-800">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <span className="text-base font-black tracking-wide block text-white uppercase">Allocate Parking Slots</span>
              <span className="text-[11px] text-slate-500 font-bold block">Assign Zone zones and slot rows to unallocated inventory</span>
            </div>
          </button>

          {/* Action B: Inventory check audit */}
          <button
            onClick={() => setCurrentTab && setCurrentTab('vehicles')}
            className="flex flex-col items-start justify-between bg-slate-900 hover:bg-slate-900/95 border border-slate-800/80 rounded-[28px] p-6 text-left h-36 transition-all duration-300 active:scale-98 shadow-xl group cursor-pointer"
          >
            <div className="p-3 bg-slate-850 text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform shadow-lg border border-slate-800">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <span className="text-base font-black tracking-wide block text-white uppercase">Yard Inventory Space Audit</span>
              <span className="text-[11px] text-slate-500 font-bold block">Run physical inventory checklists audits</span>
            </div>
          </button>
        </div>

        {/* Stock allocation metrics & Visual Zone progress */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Space occupancy progress bars */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-md flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
                <LayoutGrid className="w-5 h-5 text-indigo-500" />
                <span className="uppercase tracking-wider">Yard Slot Occupancy</span>
              </h3>
              <p className="text-[10px] text-slate-455 font-bold mt-1">Real-time occupancy ratio across allocated zones</p>
            </div>

            <div className="space-y-5 my-6 flex-1 overflow-y-auto">
              {zones.map((zone) => {
                const percent = Math.round((zone.occupied / zone.capacity) * 100);
                return (
                  <div key={zone.id} className="space-y-1.5 font-bold text-xs">
                    <div className="flex justify-between text-slate-655 font-bold text-[11px]">
                      <span>{zone.name}</span>
                      <span>{zone.occupied} / {zone.capacity} ({percent}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
                      <div
                        className={`h-full ${zone.color} rounded-full transition-all duration-500 shadow-sm`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table: Supervisor in-yard entries */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-md lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
                <Truck className="w-5 h-5 text-indigo-500" />
                <span className="uppercase tracking-wider">Active Inventory Arrivals</span>
              </h3>
              <p className="text-[10px] text-slate-455 font-bold mt-1">Recent entries awaiting layout allocation</p>
            </div>

            <div className="my-6 flex-1 overflow-x-auto min-h-[220px]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                    <th className="pb-3 font-extrabold">Vehicle No</th>
                    <th className="pb-3 font-extrabold">Brand/Model</th>
                    <th className="pb-3 font-extrabold">Arrival Date</th>
                    <th className="pb-3 font-extrabold">Class</th>
                    <th className="pb-3 font-extrabold text-center">Yard Location Slot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-655 font-semibold">
                  {recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">No active vehicles recorded</td>
                    </tr>
                  ) : (
                    recentEntries.slice(0, 5).map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 font-black text-slate-800 uppercase tracking-wide">{v.vehicleNumber}</td>
                        <td className="py-3.5 text-slate-500 font-bold">{v.brand} {v.model}</td>
                        <td className="py-3.5 text-slate-500 font-bold">{new Date(v.entryDate).toLocaleDateString()}</td>
                        <td className="py-3.5 text-slate-600 font-bold uppercase">{v.vehicleType}</td>
                        <td className="py-3.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded font-black text-[9px] border ${
                            v.yardLocation?.slot 
                              ? 'bg-emerald-50 border-emerald-100 text-emerald-700 font-black shadow-sm' 
                              : 'bg-amber-50 border-amber-100 text-amber-700'
                          }`}>
                            {v.yardLocation?.slot ? `Row: ${v.yardLocation.slot}` : 'Awaiting Slot Allocation'}
                          </span>
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
    );
  };

  const renderExecutiveDashboard = () => {
    return (
      <div className="space-y-6 animate-fade-in select-none">
        {/* Top Welcome Card */}
        <div className="bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border border-slate-800">
          <div className="absolute right-0 top-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none animate-pulse"></div>
          <div className="z-10 space-y-2">
            <span className="bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 text-[9px] uppercase font-black tracking-widest px-3 py-1 rounded-full shadow-inner">
              Releases Desk Operations Executive
            </span>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight font-display text-white mt-1">
              Welcome Back, {user?.name}!
            </h2>
            <p className="text-xs text-slate-400 font-bold">
              Release Desk Station: <span className="text-indigo-400 font-black uppercase">{user?.tenant.yardName} Documents Office</span>
            </p>
          </div>
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl shrink-0 shadow-lg text-slate-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
            <span className="text-white uppercase tracking-wider text-[10px] font-black">Clearance Coordinator Online</span>
          </div>
        </div>

        {/* Executive Quick KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/50 shadow-sm flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider w-fit">Release Status</span>
            <div className="mt-3">
              <span className="text-3xl font-black text-slate-800 tracking-tight font-display">{stats.pendingReleases}</span>
              <span className="text-xs text-slate-400 font-bold block mt-0.5">Pending Release Applications</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-200/50 shadow-sm flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider w-fit">Cleared Dispatches</span>
            <div className="mt-3">
              <span className="text-3xl font-black text-slate-800 tracking-tight font-display">{stats.releasedVehicles.today}</span>
              <span className="text-xs text-slate-400 font-bold block mt-0.5">Vehicles Dispatched Today</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-200/50 shadow-sm flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider w-fit">Total Month Outflow</span>
            <div className="mt-3">
              <span className="text-3xl font-black text-slate-800 tracking-tight font-display">{stats.releasedVehicles.thisMonth}</span>
              <span className="text-xs text-slate-400 font-bold block mt-0.5">Cleared passes this month</span>
            </div>
          </div>
        </div>

        {/* Primary Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setReleaseWizardOpen(true)}
            className="flex flex-col items-start justify-between bg-gradient-to-tr from-primary to-indigo-650 hover:from-primary/95 hover:to-indigo-650/95 border border-primary/20 rounded-[28px] p-6 text-left h-36 transition-all duration-300 active:scale-98 shadow-xl group cursor-pointer"
          >
            <div className="p-3 bg-white/10 rounded-2xl text-white group-hover:scale-110 transition-transform shadow-lg border border-white/5">
              <KeyRound className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="space-y-0.5">
              <span className="text-base font-black tracking-wide block text-white uppercase">Launch Release Checkout Desk</span>
              <span className="text-xs text-white/80 font-bold block">Initiate document audit and checkout checklist</span>
            </div>
          </button>

          <button
            onClick={() => setCurrentTab && setCurrentTab('vehicles')}
            className="flex flex-col items-start justify-between bg-slate-900 hover:bg-slate-900/95 border border-slate-800/80 rounded-[28px] p-6 text-left h-36 transition-all duration-300 active:scale-98 shadow-xl group cursor-pointer"
          >
            <div className="p-3 bg-slate-850 text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform shadow-lg border border-slate-800">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-0.5">
              <span className="text-base font-black tracking-wide block text-white uppercase">Browse Seized Vehicle Log</span>
              <span className="text-xs text-slate-500 font-bold block">Track customer paperwork, brands and engine codes</span>
            </div>
          </button>
        </div>

        {/* Digital release requests queue queue log */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-md flex flex-col">
          <div>
            <h3 className="text-sm font-black text-slate-800 flex items-center space-x-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-500" />
              <span className="uppercase tracking-wider">Digital Customer Release Queue</span>
            </h3>
            <p className="text-[10px] text-slate-455 font-bold mt-1">Applications submitted online from Customer Portal awaiting paperwork audit</p>
          </div>

          <div className="my-6 overflow-x-auto min-h-[220px]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                  <th className="pb-3 font-extrabold">Vehicle No</th>
                  <th className="pb-3 font-extrabold">Bank</th>
                  <th className="pb-3 font-extrabold">Release Type</th>
                  <th className="pb-3 font-extrabold">Dues Status</th>
                  <th className="pb-3 font-extrabold">Papers Submitted</th>
                  <th className="pb-3 font-extrabold text-center">Desk Audit Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-655 font-semibold">
                {recentEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">No active release requests inside database</td>
                  </tr>
                ) : (
                  recentEntries.slice(0, 5).map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 font-black text-slate-800 uppercase tracking-wide">{v.vehicleNumber}</td>
                      <td className="py-3.5 text-slate-500 font-bold">{v.bankName}</td>
                      <td className="py-3.5 uppercase font-bold text-[10px] text-slate-500">BANK COOP</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] ${
                          v.billing?.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'bg-rose-55 text-rose-700 border border-rose-100'
                        }`}>
                          {v.billing?.paymentStatus || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                          <span className="text-[10px] text-slate-500 font-bold">Verification Papers Uploaded</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-center">
                        <button
                          onClick={() => setReleaseWizardOpen(true)}
                          className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/95 text-white font-extrabold uppercase tracking-wider text-[9px] transition-all cursor-pointer hover:shadow-sm"
                        >
                          Audit Papers
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderManagerDashboard = () => {
    return (
      <div className="space-y-4 md:space-y-5 animate-fade-in select-none">
        {/* Top Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2.5 md:space-y-0">
          <div>
            <h2 className="text-lg sm:text-2xl font-extrabold text-slate-800 tracking-tight font-display flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              <span>Operations Control Center</span>
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-450 font-semibold mt-0.5 font-sans">Real-time status of parked vehicles, billing, and release approvals</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto font-sans">
            {/* Date range toggle buttons */}
            <div className="flex items-center bg-slate-200/50 p-0.5 rounded-xl border border-slate-300/30 shadow-sm">
              <button
                onClick={() => {
                  setDateMode('realtime');
                  fetchStats();
                }}
                className={`px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${
                  dateMode === 'realtime'
                    ? 'bg-white text-slate-850 shadow-sm font-extrabold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Real-Time
              </button>
              <button
                onClick={() => setDateMode('custom')}
                className={`px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all duration-200 cursor-pointer ${
                  dateMode === 'custom'
                    ? 'bg-white text-slate-850 shadow-sm font-extrabold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Custom Range
              </button>
            </div>

            {dateMode === 'custom' && (
              <div className="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80 shadow-sm animate-fade-in">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent border-0 text-[10px] font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer p-0"
                />
                <span className="text-[10px] text-slate-400 font-bold px-0.5">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent border-0 text-[10px] font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer p-0"
                />
                <button
                  onClick={() => {
                    if (customStartDate && customEndDate) {
                      fetchStats(customStartDate, customEndDate);
                    }
                  }}
                  disabled={!customStartDate || !customEndDate}
                  className="bg-primary hover:bg-primary/95 disabled:bg-slate-200 disabled:text-slate-450 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer hover:shadow-sm"
                >
                  Apply
                </button>
              </div>
            )}

            <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200/50 shadow-sm text-slate-655 text-[10px] sm:text-xs font-extrabold">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* [NEW] Quick Actions Control Panel */}
        <div className="bg-gradient-to-tr from-slate-900 via-slate-950 to-slate-900 text-white rounded-2xl p-4 sm:p-4.5 shadow-md relative overflow-hidden flex flex-col gap-3 border border-slate-800">
          <div className="absolute right-0 top-0 w-28 h-28 bg-primary/10 rounded-full blur-[40px] pointer-events-none"></div>
          <div className="absolute left-1/3 bottom-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-[40px] pointer-events-none"></div>

          <div className="z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                Command Center
              </span>
              <h3 className="text-xs sm:text-sm font-extrabold tracking-tight font-display">Logistics Yard Quick Actions</h3>
            </div>
            <p className="hidden md:block text-[9px] text-slate-400 font-semibold">Instant single-tap shortcuts for day-to-day operations and field management.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 z-10">
            {/* Action 1: Gate Check In */}
            <button
              onClick={() => setCurrentTab && setCurrentTab('vehicle-entry')}
              className="flex flex-col items-start justify-between bg-gradient-to-tr from-primary to-indigo-650 hover:from-primary/95 hover:to-indigo-650/95 border border-primary/20 rounded-xl p-3 text-left h-20 sm:h-22 transition-all duration-200 active:scale-95 shadow-md shadow-primary/10 group cursor-pointer"
            >
              <div className="p-1.5 bg-white/10 rounded-lg text-white group-hover:scale-105 transition-transform">
                <Plus className="w-4 h-4 stroke-[3]" />
              </div>
              <div className="space-y-0">
                <span className="text-[11px] sm:text-xs font-black tracking-wide block">Gate Check-In</span>
                <span className="text-[8px] text-white/70 font-semibold block">Record Repo Entry</span>
              </div>
            </button>

            {/* Action 2: Yard Stocks */}
            <button
              onClick={() => setCurrentTab && setCurrentTab('vehicles')}
              className="flex flex-col items-start justify-between bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-left h-20 sm:h-22 transition-all duration-200 active:scale-95 group cursor-pointer"
            >
              <div className="p-1.5 bg-slate-800 text-slate-350 rounded-lg group-hover:scale-105 transition-transform">
                <Truck className="w-4 h-4" />
              </div>
              <div className="space-y-0">
                <span className="text-[11px] sm:text-xs font-black tracking-wide block text-slate-200">Active Stock</span>
                <span className="text-[8px] text-slate-550 font-semibold block">Track slots & release</span>
              </div>
            </button>

            {/* Action 3: Configure Tariffs */}
            <button
              onClick={() => setCurrentTab && setCurrentTab('rates')}
              className="flex flex-col items-start justify-between bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-left h-20 sm:h-22 transition-all duration-200 active:scale-95 group cursor-pointer"
            >
              <div className="p-1.5 bg-slate-800 text-slate-350 rounded-lg group-hover:scale-105 transition-transform">
                <Coins className="w-4 h-4" />
              </div>
              <div className="space-y-0">
                <span className="text-[11px] sm:text-xs font-black tracking-wide block text-slate-200">Bank Rates</span>
                <span className="text-[8px] text-slate-550 font-semibold block">Manage tariffs & lists</span>
              </div>
            </button>

            {/* Action 4: Reports Analytics */}
            <button
              onClick={() => setCurrentTab && setCurrentTab('reports')}
              className="flex flex-col items-start justify-between bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-left h-20 sm:h-22 transition-all duration-200 active:scale-95 group cursor-pointer"
            >
              <div className="p-1.5 bg-slate-800 text-slate-350 rounded-lg group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
              <div className="space-y-0">
                <span className="text-[11px] sm:text-xs font-black tracking-wide block text-slate-200">Loss Analytics</span>
                <span className="text-[8px] text-slate-550 font-semibold block">Kachha share graphs</span>
              </div>
            </button>

            {/* Action 5: Vehicle Release Desk */}
            <button
              onClick={() => setReleaseWizardOpen(true)}
              className="flex flex-col items-start justify-between bg-slate-950/40 hover:bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-left h-20 sm:h-22 transition-all duration-200 active:scale-95 group cursor-pointer font-sans"
            >
              <div className="p-1.5 bg-slate-800 text-slate-350 rounded-lg group-hover:scale-105 transition-transform">
                <KeyRound className="w-4 h-4 text-amber-400" />
              </div>
              <div className="space-y-0">
                <span className="text-[11px] sm:text-xs font-black tracking-wide block text-slate-200">Vehicle Release</span>
                <span className="text-[8px] text-slate-550 font-semibold block">Quick checkout desk</span>
              </div>
            </button>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/50 p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 active:scale-[0.98] group relative overflow-hidden"
              >
                <div className="absolute right-0 bottom-0 w-24 h-24 bg-slate-50/60 rounded-full blur-2xl group-hover:scale-125 transition-all duration-500"></div>

                <div className="flex justify-between items-start z-10">
                  <div className="space-y-2 font-sans">
                    <span className="text-[9px] uppercase font-black tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/40 block w-fit">
                      {card.badge}
                    </span>
                    <h3 className="text-slate-450 font-bold text-xs uppercase tracking-wider block">{card.title}</h3>
                  </div>
                  <div className={`p-3 rounded-2xl ${card.color} group-hover:scale-115 transition-transform duration-300 shrink-0`}>
                    <Icon className="w-5.5 h-5.5" />
                  </div>
                </div>
                {card.type === 'interactive' && card.counts ? (
                  <div className="mt-5 z-10 space-y-3 font-sans">
                    <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">{card.desc}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleCountClick(card.statusType, 'this_month')}
                        className="flex flex-col items-center justify-center bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 rounded-2xl p-3 text-center transition-all duration-200 active:scale-95 group/btn cursor-pointer"
                      >
                        <span className="text-[9px] uppercase font-black text-slate-450 block group-hover/btn:text-indigo-650 transition-colors">
                          This Month
                        </span>
                        <span className="text-2xl font-black text-slate-800 block mt-1 font-display">
                          {card.counts.thisMonth}
                        </span>
                      </button>
                      <button
                        onClick={() => handleCountClick(card.statusType, 'all')}
                        className="flex flex-col items-center justify-center bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 rounded-2xl p-3 text-center transition-all duration-200 active:scale-95 group/btn cursor-pointer"
                      >
                        <span className="text-[9px] uppercase font-black text-slate-450 block group-hover/btn:text-indigo-655 transition-colors">
                          Total Stock
                        </span>
                        <span className="text-2xl font-black text-slate-800 block mt-1 font-display">
                          {card.counts.total}
                        </span>
                      </button>
                    </div>
                  </div>
                ) : card.type === 'interactive-three' && card.threeValues ? (
                  <div className="mt-5 z-10 space-y-3 font-sans">
                    <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">{card.desc}</p>
                    {data?.stats && (data.stats as any).isCustomRange ? (
                      <button
                        onClick={() => handleThreeClick(card.statusType, 'custom')}
                        className="w-full flex flex-col items-center justify-center bg-indigo-50/50 hover:bg-indigo-50/80 border border-indigo-200/60 rounded-2xl p-4.5 text-center transition-all duration-200 active:scale-95 group/btn cursor-pointer"
                      >
                        <span className="text-[9px] uppercase font-black text-indigo-650 tracking-wider block">
                          Selected Custom Period
                        </span>
                        <span className="text-2xl font-black text-slate-850 block mt-1 font-display">
                          {card.isCurrency ? `\u20B9${card.threeValues.today.amount.toLocaleString('en-IN')}` : card.threeValues.today}
                        </span>
                        <span className="text-[10px] text-slate-450 font-semibold block mt-1">
                          {card.isCurrency 
                            ? `${card.threeValues.today.count} ${card.threeValues.today.count === 1 ? 'vehicle' : 'vehicles'}`
                            : 'vehicles'
                          }
                        </span>
                      </button>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => handleThreeClick(card.statusType, 'today')}
                          className="flex flex-col items-center justify-center bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 rounded-2xl py-2 px-1 text-center transition-all duration-200 active:scale-95 group/btn cursor-pointer"
                        >
                          <span className="text-[8px] uppercase font-black text-slate-400 block group-hover/btn:text-indigo-650 transition-colors">
                            Today
                          </span>
                          <span className="text-sm font-black text-slate-800 block mt-0.5 font-display truncate w-full px-0.5" title={card.isCurrency ? `\u20B9${card.threeValues.today.amount.toLocaleString('en-IN')}` : String(card.threeValues.today)}>
                            {card.isCurrency ? `\u20B9${card.threeValues.today.amount.toLocaleString('en-IN')}` : card.threeValues.today}
                          </span>
                          <span className="text-[8px] text-slate-450 font-semibold block mt-0.5 group-hover/btn:text-indigo-500">
                            {card.isCurrency 
                              ? `${card.threeValues.today.count}`
                              : 'vehicles'
                            }
                          </span>
                        </button>
                        <button
                          onClick={() => handleThreeClick(card.statusType, 'this_month')}
                          className="flex flex-col items-center justify-center bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 rounded-2xl py-2 px-1 text-center transition-all duration-200 active:scale-95 group/btn cursor-pointer"
                        >
                          <span className="text-[8px] uppercase font-black text-slate-400 block group-hover/btn:text-indigo-650 transition-colors">
                            Month
                          </span>
                          <span className="text-sm font-black text-slate-800 block mt-0.5 font-display truncate w-full px-0.5" title={card.isCurrency ? `\u20B9${card.threeValues.thisMonth.amount.toLocaleString('en-IN')}` : String(card.threeValues.thisMonth)}>
                            {card.isCurrency ? `\u20B9${card.threeValues.thisMonth.amount.toLocaleString('en-IN')}` : card.threeValues.thisMonth}
                          </span>
                          <span className="text-[8px] text-slate-455 font-semibold block mt-0.5 group-hover/btn:text-indigo-500">
                            {card.isCurrency 
                              ? `${card.threeValues.thisMonth.count}`
                              : 'vehicles'
                            }
                          </span>
                        </button>
                        <button
                          onClick={() => handleThreeClick(card.statusType, 'this_year')}
                          className="flex flex-col items-center justify-center bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 rounded-2xl py-2 px-1 text-center transition-all duration-200 active:scale-95 group/btn cursor-pointer"
                        >
                          <span className="text-[8px] uppercase font-black text-slate-400 block group-hover/btn:text-indigo-650 transition-colors">
                            Year
                          </span>
                          <span className="text-sm font-black text-slate-800 block mt-0.5 font-display truncate w-full px-0.5" title={card.isCurrency ? `\u20B9${card.threeValues.thisYear.amount.toLocaleString('en-IN')}` : String(card.threeValues.thisYear)}>
                            {card.isCurrency ? `\u20B9${card.threeValues.thisYear.amount.toLocaleString('en-IN')}` : card.threeValues.thisYear}
                          </span>
                          <span className="text-[8px] text-slate-455 font-semibold block mt-0.5 group-hover/btn:text-indigo-500">
                            {card.isCurrency 
                              ? `${card.threeValues.thisYear.count}`
                              : 'vehicles'
                            }
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 z-10 space-y-1 font-sans">
                    <p className="text-3xl font-black text-slate-900 tracking-tight font-display">{card.value}</p>
                    <p className="text-xs text-slate-400 font-semibold">{card.desc}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Charts & Details section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Bank-wise Distribution */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between lg:col-span-1 font-sans">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-primary" />
                <span>Bank-wise Vehicles Share</span>
              </h3>
              <p className="text-xs text-slate-450 font-semibold mt-1">Breakdown of finance partners</p>
            </div>

            <div className="space-y-4 my-6 flex-1 overflow-y-auto max-h-[280px] pr-2">
              {bankStats.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No banks registered</p>
              ) : (
                (() => {
                  const total = bankStats.reduce((sum, b) => sum + b.count, 0) || 1;
                  return bankStats.map((item, idx) => {
                    const percent = Math.round((item.count / total) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold text-slate-655">
                          <span>{item.bank}</span>
                          <span>{item.count} ({percent}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </div>

          {/* Quick Offline Bill Calculator Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between lg:col-span-1 font-sans">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <IndianRupee className="w-5 h-5 text-emerald-500" />
                <span>Quick Bill Calculator</span>
              </h3>
              <p className="text-xs text-slate-450 font-semibold mt-1">Offline parking charge estimation</p>
            </div>

            <div className="space-y-4 my-6 flex-1">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Days Parked</label>
                <input
                  type="number"
                  value={calcDays}
                  onChange={(e) => setCalcDays(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-750 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  min="1"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-455 uppercase tracking-wider block">Rate Per Day (₹)</label>
                <input
                  type="number"
                  value={calcRate}
                  onChange={(e) => setCalcRate(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-750 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  min="1"
                />
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-center mt-4">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Estimated Charge</span>
                <span className="text-2xl font-black text-emerald-700 block mt-1">{"\u20B9"}{(calcDays * calcRate).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Recent Activity Log - Entries */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2 flex flex-col justify-between font-sans">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <Truck className="w-5 h-5 text-kachha" />
                <span>Recent In-Yard Entries</span>
              </h3>
              <p className="text-xs text-slate-450 font-semibold mt-1">Latest vehicle check-ins</p>
            </div>

            <div className="my-6 flex-1 overflow-x-auto min-h-[220px]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                    <th className="pb-3 font-extrabold">Vehicle No</th>
                    <th className="pb-3 font-extrabold">Brand/Model</th>
                    <th className="pb-3 font-extrabold">Bank</th>
                    <th className="pb-3 font-extrabold">Status</th>
                    <th className="pb-3 font-extrabold">Yard Slot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-655 font-semibold">
                  {recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">No vehicles recorded yet</td>
                    </tr>
                  ) : (
                    recentEntries.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 font-black text-slate-800 uppercase tracking-wide">{v.vehicleNumber}</td>
                        <td className="py-3.5">{v.brand} {v.model}</td>
                        <td className="py-3.5 font-bold">{v.bankName}</td>
                        <td className="py-3.5 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded font-black text-[9px] ${
                              v.yardStatus === 'KACHHA'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {v.yardStatus}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {v.yardLocation?.slot || 'Unallocated'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Dispatched / Released Activity Log */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col font-sans">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-pakka" />
              <span>Recent Releases & Dispatches</span>
            </h3>
            <p className="text-xs text-slate-455 font-semibold mt-1">Vehicles that safely cleared gate passes today</p>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                  <th className="pb-3 font-extrabold">Gate Pass No</th>
                  <th className="pb-3 font-extrabold">Vehicle Number</th>
                  <th className="pb-3 font-extrabold">Type</th>
                  <th className="pb-3 font-extrabold">Released Date</th>
                  <th className="pb-3 font-extrabold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-slate-655 font-semibold">
                {recentReleases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 font-bold">No releases recorded today</td>
                  </tr>
                ) : (
                  recentReleases.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 font-bold text-slate-800">{r.gatePassNumber}</td>
                      <td className="py-3.5 font-black uppercase text-slate-850">{r.vehicle?.vehicleNumber}</td>
                      <td className="py-3.5 uppercase">{r.releaseType} Release</td>
                      <td className="py-3.5 font-semibold text-slate-500">{new Date(r.releasedAt).toLocaleString('en-IN')}</td>
                      <td className="py-3.5">
                        <a
                          href={r.gatePassUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary font-bold hover:underline flex items-center space-x-1"
                        >
                          <span>Print Pass</span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3.5 sm:p-4.5 md:p-6 bg-slate-50 overflow-y-auto space-y-4 md:space-y-5 flex-1 select-none font-sans">
      {userRole === 'GUARD' && renderGuardDashboard()}
      {userRole === 'SUPERVISOR' && renderSupervisorDashboard()}
      {userRole === 'EXECUTIVE' && renderExecutiveDashboard()}
      {(userRole === 'SUPER_ADMIN' || userRole === 'TENANT_ADMIN' || userRole === 'MANAGER') && renderManagerDashboard()}

      {/* Interactive Detail Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div 
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-6xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex flex-col md:flex-row md:items-center gap-4 w-full mr-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 tracking-tight">{modalTitle}</h3>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Filter by bank, type, custom dates, or search vehicles below.
                  </p>
                </div>

                {/* Inline Metrics pills ticker - sits in the Header next to the title */}
                {modalActiveStatus && !modalLoading && (
                  (() => {
                    const filtered = modalVehicles.filter((v) => {
                      const term = searchTerm.toLowerCase();
                      const matchesSearch = (
                        v.vehicleNumber?.toLowerCase().includes(term) ||
                        v.brand?.toLowerCase().includes(term) ||
                        v.model?.toLowerCase().includes(term) ||
                        v.bankName?.toLowerCase().includes(term) ||
                        v.repoAgency?.toLowerCase().includes(term)
                      );
                      const matchesBank = bankFilter === '' || v.bankName === bankFilter;
                      const matchesType = typeFilter === '' || v.vehicleType === typeFilter;
                      return matchesSearch && matchesBank && matchesType;
                    });

                    const isRevenue = modalActiveStatus === 'REVENUE';
                    const isLoss = modalActiveStatus === 'LOSS';
                    const isReleased = modalActiveStatus === 'RELEASED';
                    const isPakka = modalActiveStatus === 'PAKKA';
                    const isKachha = modalActiveStatus === 'KACHHA';

                    if (isRevenue) {
                      const totalFilteredRevenue = filtered.reduce((sum, v) => sum + (v.billing?.paidAmount || 0), 0);
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] bg-slate-100/70 p-1 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] select-none md:ml-auto">
                          <span className="font-extrabold text-[8px] uppercase text-slate-400 tracking-wider px-1">Live Stats:</span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Today: <span className="font-extrabold text-emerald-600">{"\u20B9"}{stats.dailyRevenue.today.amount.toLocaleString('en-IN')}</span> <span className="text-[8px] text-slate-400">({stats.dailyRevenue.today.count})</span>
                          </span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Month: <span className="font-extrabold text-indigo-600">{"\u20B9"}{stats.dailyRevenue.thisMonth.amount.toLocaleString('en-IN')}</span> <span className="text-[8px] text-slate-400">({stats.dailyRevenue.thisMonth.count})</span>
                          </span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Year: <span className="font-extrabold text-blue-600">{"\u20B9"}{stats.dailyRevenue.thisYear.amount.toLocaleString('en-IN')}</span> <span className="text-[8px] text-slate-400">({stats.dailyRevenue.thisYear.count})</span>
                          </span>
                          <span className="px-2.5 py-0.5 bg-gradient-to-tr from-primary/5 to-indigo-50/5 border border-primary/20 text-slate-800 font-extrabold rounded-lg flex items-center gap-1 shadow-sm">
                            Filtered: <span className="font-black text-primary">{"\u20B9"}{totalFilteredRevenue.toLocaleString('en-IN')}</span> <span className="text-[8px] text-indigo-500">({filtered.length})</span>
                          </span>
                        </div>
                      );
                    }

                    if (isLoss) {
                      const totalFilteredLoss = filtered.reduce((sum, v) => sum + (v.billing?.dailyRate || 0), 0);
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] bg-slate-100/70 p-1 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] select-none md:ml-auto">
                          <span className="font-extrabold text-[8px] uppercase text-slate-400 tracking-wider px-1">Live Stats:</span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Today: <span className="font-extrabold text-rose-500">{"\u20B9"}{stats.dailyLoss.today.amount.toLocaleString('en-IN')}</span> <span className="text-[8px] text-slate-400">({stats.dailyLoss.today.count})</span>
                          </span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Month: <span className="font-extrabold text-rose-600">{"\u20B9"}{stats.dailyLoss.thisMonth.amount.toLocaleString('en-IN')}</span> <span className="text-[8px] text-slate-400">({stats.dailyLoss.thisMonth.count})</span>
                          </span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Year: <span className="font-extrabold text-rose-700">{"\u20B9"}{stats.dailyLoss.thisYear.amount.toLocaleString('en-IN')}</span> <span className="text-[8px] text-slate-400">({stats.dailyLoss.thisYear.count})</span>
                          </span>
                          <span className="px-2.5 py-0.5 bg-gradient-to-tr from-rose-50 to-orange-50/50 border border-rose-200 text-slate-800 font-extrabold rounded-lg flex items-center gap-1 shadow-sm">
                            Filtered: <span className="font-black text-rose-600">{"\u20B9"}{totalFilteredLoss.toLocaleString('en-IN')}/day</span> <span className="text-[8px] text-rose-500">({filtered.length})</span>
                          </span>
                        </div>
                      );
                    }

                    if (isReleased) {
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] bg-slate-100/70 p-1 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] select-none md:ml-auto">
                          <span className="font-extrabold text-[8px] uppercase text-slate-400 tracking-wider px-1">Live Stats:</span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Today: <span className="font-extrabold text-teal-600">{stats.releasedVehicles.today}</span>
                          </span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Month: <span className="font-extrabold text-teal-700">{stats.releasedVehicles.thisMonth}</span>
                          </span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Year: <span className="font-extrabold text-teal-800">{stats.releasedVehicles.thisYear}</span>
                          </span>
                          <span className="px-2.5 py-0.5 bg-gradient-to-tr from-teal-50 to-emerald-50/50 border border-teal-200 text-slate-800 font-extrabold rounded-lg flex items-center gap-1 shadow-sm">
                            Filtered: <span className="font-black text-teal-650">{filtered.length}</span>
                          </span>
                        </div>
                      );
                    }

                    if (isPakka) {
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] bg-slate-100/70 p-1 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] select-none md:ml-auto">
                          <span className="font-extrabold text-[8px] uppercase text-slate-400 tracking-wider px-1">Live Stats:</span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Month Entries: <span className="font-extrabold text-emerald-600">{stats.pakkaVehicles.thisMonth}</span>
                          </span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Total Stock: <span className="font-extrabold text-emerald-700">{stats.pakkaVehicles.total}</span>
                          </span>
                          <span className="px-2.5 py-0.5 bg-gradient-to-tr from-emerald-50 to-teal-50/50 border border-emerald-200 text-slate-800 font-extrabold rounded-lg flex items-center gap-1 shadow-sm">
                            Filtered: <span className="font-black text-emerald-655">{filtered.length}</span>
                          </span>
                        </div>
                      );
                    }

                    if (isKachha) {
                      return (
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] bg-slate-100/70 p-1 rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] select-none md:ml-auto">
                          <span className="font-extrabold text-[8px] uppercase text-slate-400 tracking-wider px-1">Live Stats:</span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Month Entries: <span className="font-extrabold text-amber-600">{stats.kachhaVehicles.thisMonth}</span>
                          </span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200/40 text-slate-700 font-bold rounded-lg flex items-center gap-1 shadow-sm">
                            Total Stock: <span className="font-extrabold text-amber-700">{stats.kachhaVehicles.total}</span>
                          </span>
                          <span className="px-2.5 py-0.5 bg-gradient-to-tr from-amber-50 to-yellow-50/50 border border-amber-200 text-slate-800 font-extrabold rounded-lg flex items-center gap-1 shadow-sm">
                            Filtered: <span className="font-black text-amber-655">{filtered.length}</span>
                          </span>
                        </div>
                      );
                    }

                    return null;
                  })()
                )}
              </div>

              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Unified Space-Efficient Filters Toolbar (Single Row!) */}
            <div className="px-6 py-2.5 border-b border-slate-100 bg-white flex flex-wrap items-center gap-3 animate-fade-in select-none">
              {/* Search bar */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by Vehicle Number, Brand, Model, Bank..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
                />
              </div>

              {/* Bank filter select */}
              <select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-655 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer animate-fade-in"
              >
                <option value="">All Banks</option>
                {(() => {
                  const uniqueBanks = Array.from(new Set(modalVehicles.map(v => v.bankName).filter(Boolean))) as string[];
                  return uniqueBanks.map(bank => (
                    <option key={bank} value={bank}>{bank}</option>
                  ));
                })()}
              </select>

              {/* Vehicle type filter select */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-655 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer animate-fade-in"
              >
                <option value="">All Types</option>
                <option value="TW">2-Wheeler (TW)</option>
                <option value="THREE_W">3-Wheeler (3W)</option>
                <option value="FW">4-Wheeler (FW)</option>
                <option value="CV">Commercial Vehicle (CV)</option>
              </select>

              {/* Compact Custom Period Inline Picker */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.02)] select-none">
                <span className="text-[8px] uppercase font-black text-slate-450 tracking-wider">Custom Period:</span>
                <input
                  type="date"
                  value={modalStartDate}
                  onChange={(e) => setModalStartDate(e.target.value)}
                  className="bg-transparent border-0 text-[10px] font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer p-0"
                />
                <span className="text-[10px] text-slate-400 font-bold px-0.5">to</span>
                <input
                  type="date"
                  value={modalEndDate}
                  onChange={(e) => setModalEndDate(e.target.value)}
                  className="bg-transparent border-0 text-[10px] font-bold text-slate-700 focus:outline-none focus:ring-0 cursor-pointer p-0"
                />
                <button
                  onClick={handleModalDateApply}
                  disabled={!modalStartDate || !modalEndDate}
                  className="bg-primary hover:bg-primary/95 disabled:bg-slate-200 disabled:text-slate-400 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer hover:shadow-sm active:scale-95 ml-1"
                >
                  Apply
                </button>
              </div>

              {(searchTerm || bankFilter || typeFilter || modalStartDate || modalEndDate) && (
                <button
                  onClick={handleResetAllModalFilters}
                  className="text-xs text-rose-500 hover:text-rose-655 font-bold bg-rose-50 hover:bg-rose-100/80 px-3 py-1.5 rounded-xl border border-rose-200/50 transition-all cursor-pointer hover:shadow-sm"
                >
                  Reset All
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {modalLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-semibold text-slate-400">Loading vehicles list...</p>
                </div>
              ) : (
                (() => {
                  const filtered = modalVehicles.filter((v) => {
                    const term = searchTerm.toLowerCase();
                    const matchesSearch = (
                      v.vehicleNumber?.toLowerCase().includes(term) ||
                      v.brand?.toLowerCase().includes(term) ||
                      v.model?.toLowerCase().includes(term) ||
                      v.bankName?.toLowerCase().includes(term) ||
                      v.repoAgency?.toLowerCase().includes(term)
                    );
                    
                    const matchesBank = bankFilter === '' || v.bankName === bankFilter;
                    const matchesType = typeFilter === '' || v.vehicleType === typeFilter;
                    
                    return matchesSearch && matchesBank && matchesType;
                  });

                  return (
                    <div className="space-y-4">
                      {filtered.length === 0 ? (
                        <div className="text-center py-16 space-y-3 bg-white border border-slate-200 rounded-3xl shadow-sm animate-fade-in">
                          <div className="inline-flex p-4 bg-slate-100 rounded-full text-slate-400">
                            <Search className="w-8 h-8" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-700">No matching vehicles found</h4>
                          <p className="text-xs text-slate-400 max-w-xs mx-auto">
                            Try searching for a different keyword or check back later.
                          </p>
                        </div>
                      ) : (
                        <div className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                          {(() => {
                            const isReleasedTab = modalTitle.toLowerCase().includes('released');
                            const isRevenueTab = modalTitle.toLowerCase().includes('revenue');
                            const isLossTab = modalTitle.toLowerCase().includes('loss');

                            return (
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                                    <th className="px-5 py-3 font-semibold">Vehicle Number</th>
                                    <th className="px-5 py-3 font-semibold">Details</th>
                                    <th className="px-5 py-3 font-semibold">Finance Partner</th>
                                    {isRevenueTab && <th className="px-5 py-3 font-semibold">Paid Amount</th>}
                                    {isLossTab && <th className="px-5 py-3 font-semibold">Daily Loss Rate</th>}
                                    {isReleasedTab || isRevenueTab ? (
                                      <th className="px-5 py-3 font-semibold">Released At</th>
                                    ) : (
                                      <th className="px-5 py-3 font-semibold">Entered At</th>
                                    )}
                                    <th className="px-5 py-3 font-semibold">Yard Slot</th>
                                    <th className="px-5 py-3 font-semibold text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-600">
                                  {filtered.map((v) => (
                                    <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="px-5 py-4 font-bold text-slate-800 uppercase tracking-wide">
                                        {v.vehicleNumber}
                                      </td>
                                      <td className="px-5 py-4">
                                        <div className="font-semibold text-slate-700">
                                          {v.brand || 'N/A'} {v.model || ''}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">{v.color || 'No color spec'}</div>
                                      </td>
                                      <td className="px-5 py-4 font-medium text-slate-600">
                                        {v.bankName}
                                      </td>
                                      {isRevenueTab && (
                                        <td className="px-5 py-4 font-bold text-emerald-600">
                                          {"\u20B9"}{v.billing?.paidAmount?.toLocaleString('en-IN') || 0}
                                        </td>
                                      )}
                                      {isLossTab && (
                                        <td className="px-5 py-4 font-bold text-rose-500">
                                          {"\u20B9"}{v.billing?.dailyRate?.toLocaleString('en-IN') || 0}/day
                                        </td>
                                      )}
                                      {isReleasedTab || isRevenueTab ? (
                                        <td className="px-5 py-4 text-slate-500 font-semibold">
                                          <div className="flex items-center space-x-1.5">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <span>
                                              {v.release?.releasedAt
                                                ? new Date(v.release.releasedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                                                : 'N/A'
                                              }
                                            </span>
                                          </div>
                                        </td>
                                      ) : (
                                        <td className="px-5 py-4 text-slate-500 font-semibold">
                                          <div className="flex items-center space-x-1.5">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{new Date(v.entryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                          </div>
                                        </td>
                                      )}
                                      <td className="px-5 py-4">
                                        <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                          {v.yardLocation?.slot || 'Unallocated'}
                                        </span>
                                      </td>
                                      <td className="px-5 py-4 text-center">
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            localStorage.setItem('yms_vehicle_list_search', v.vehicleNumber);
                                            setCurrentTab?.('vehicles');
                                            setModalOpen(false);
                                          }}
                                          className="inline-flex items-center space-x-1 text-primary font-semibold hover:underline bg-transparent border-none p-0 outline-none cursor-pointer"
                                        >
                                          <span>View File</span>
                                          <ExternalLink className="w-3 h-3" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-slate-400 text-[10px] font-bold uppercase tracking-wider px-6">
              <span>YMS Operations Control</span>
              <span>Total Displayed: {modalVehicles.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* UNIFIED VEHICLE RELEASE DESK - Shared Modal Component */}
      <UnifiedReleaseModal
        isOpen={releaseWizardOpen}
        onClose={() => setReleaseWizardOpen(false)}
        onSuccess={handleReleaseSuccess}
      />
    </div>
  );
};


