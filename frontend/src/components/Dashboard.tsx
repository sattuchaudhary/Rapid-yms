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
  Car,
  Building,
  RefreshCw,
  ChevronRight,
  Menu,
  Home,
  Database,
} from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import { useAuthStore } from '../store/authStore';
import { UnifiedReleaseModal } from './UnifiedReleaseModal';
import { DraftsModal } from './DraftsModal';



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
      today: { amount: number; count: number; accrued?: number };
      thisMonth: { amount: number; count: number; accrued?: number };
      thisYear: { amount: number; count: number; accrued?: number };
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
  // VEHICLE QUICK RELEASE & DRAFTS DESK STATE
  // ==========================================
  const [releaseWizardOpen, setReleaseWizardOpen] = useState(false);
  const [draftsModalOpen, setDraftsModalOpen] = useState(false);
  const [draftsCount, setDraftsCount] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('yms_offline_drafts');
      if (saved) {
        const parsed = JSON.parse(saved);
        setDraftsCount(Array.isArray(parsed) ? parsed.length : 0);
      } else {
        setDraftsCount(0);
      }
    } catch (e) {
      setDraftsCount(0);
    }
  }, [draftsModalOpen]);


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
  const [modalPage, setModalPage] = useState(1);

  // Custom Dashboard Date Range states
  const [dateMode, setDateMode] = useState<'realtime' | 'custom'>('realtime');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const fetchStats = async (start?: string, end?: string) => {
    if (start && end && new Date(start) > new Date(end)) {
      toast.error('Start date cannot be after end date');
      return;
    }
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
    setModalPage(1);
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
    setModalPage(1);
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
      desc: 'Pakka Stock Dues + Released',
      icon: IndianRupee,
      color: 'bg-revenue text-white shadow-lg shadow-revenue/20',
      badge: 'Total Earnings',
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
          <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center space-x-2">
                <IndianRupee className="w-5 h-5 text-emerald-400" />
                <span className="uppercase tracking-wider">Quick Dues Calculator</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Estimate parking dues for inquiring customers</p>
            </div>

            <div className="space-y-4 my-6 flex-1">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Days Parked</label>
                <input
                  type="number"
                  value={calcDays}
                  onChange={(e) => setCalcDays(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  min="1"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Rate Per Day (₹)</label>
                <input
                  type="number"
                  value={calcRate}
                  onChange={(e) => setCalcRate(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  min="1"
                />
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-center mt-4 shadow-sm">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider block">Estimated Charge</span>
                <span className="text-xl font-black text-emerald-300 block mt-1">₹{(calcDays * calcRate).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Table: Guard shift logs */}
          <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center space-x-2">
                <Truck className="w-5 h-5 text-indigo-400" />
                <span className="uppercase tracking-wider">Gate Check-In Shift Log</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Latest vehicle check-ins logged under your node</p>
            </div>

            <div className="my-6 flex-1 overflow-x-auto min-h-[220px]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                    <th className="pb-3 font-extrabold">Vehicle No</th>
                    <th className="pb-3 font-extrabold">Model</th>
                    <th className="pb-3 font-extrabold">Bank</th>
                    <th className="pb-3 font-extrabold">Status</th>
                    <th className="pb-3 font-extrabold">Slot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-semibold">
                  {recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">No entries logged today</td>
                    </tr>
                  ) : (
                    recentEntries.slice(0, 5).map((v) => (
                      <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 font-black text-white uppercase tracking-wide">{v.vehicleNumber}</td>
                        <td className="py-3 text-slate-300 font-bold">{v.brand} {v.model}</td>
                        <td className="py-3 text-slate-400 font-bold">{v.bankName}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] ${
                            v.yardStatus === 'KACHHA'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {v.yardStatus}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-slate-300 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
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
          <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center space-x-2">
                <LayoutGrid className="w-5 h-5 text-indigo-400" />
                <span className="uppercase tracking-wider">Yard Slot Occupancy</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Real-time occupancy ratio across allocated zones</p>
            </div>

            <div className="space-y-5 my-6 flex-1 overflow-y-auto">
              {zones.map((zone) => {
                const percent = Math.round((zone.occupied / zone.capacity) * 100);
                return (
                  <div key={zone.id} className="space-y-1.5 font-bold text-xs">
                    <div className="flex justify-between text-slate-300 font-bold text-[11px]">
                      <span>{zone.name}</span>
                      <span>{zone.occupied} / {zone.capacity} ({percent}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
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
          <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center space-x-2">
                <Truck className="w-5 h-5 text-indigo-400" />
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
          <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col justify-between">
            <span className="text-[8px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded uppercase tracking-wider w-fit border border-indigo-500/20">Release Status</span>
            <div className="mt-3">
              <span className="text-3xl font-black text-white tracking-tight font-display">{stats.pendingReleases}</span>
              <span className="text-xs text-slate-400 font-bold block mt-0.5">Pending Release Applications</span>
            </div>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col justify-between">
            <span className="text-[8px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase tracking-wider w-fit border border-emerald-500/20">Cleared Dispatches</span>
            <div className="mt-3">
              <span className="text-3xl font-black text-white tracking-tight font-display">{stats.releasedVehicles.today}</span>
              <span className="text-xs text-slate-400 font-bold block mt-0.5">Vehicles Dispatched Today</span>
            </div>
          </div>
          <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col justify-between">
            <span className="text-[8px] font-black text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded uppercase tracking-wider w-fit border border-teal-500/20">Total Month Outflow</span>
            <div className="mt-3">
              <span className="text-3xl font-black text-white tracking-tight font-display">{stats.releasedVehicles.thisMonth}</span>
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
        <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-3xl border border-slate-800/80 shadow-xl flex flex-col">
          <div>
            <h3 className="text-sm font-black text-white flex items-center space-x-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-400" />
              <span className="uppercase tracking-wider">Digital Customer Release Queue</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Applications submitted online from Customer Portal awaiting paperwork audit</p>
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
      <div className="space-y-6 animate-fade-in select-none bg-slate-950 p-1 sm:p-2 rounded-3xl">
        {/* Top Header with Date Mode & Live Status */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight font-display flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
              <span>Tenant Admin Operations Dashboard</span>
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Live yard stock summary, financial performance & quick operational desk
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-sans">
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => {
                  setDateMode('realtime');
                  fetchStats();
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dateMode === 'realtime'
                    ? 'bg-indigo-600 text-white shadow font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Real-Time
              </button>
              <button
                onClick={() => setDateMode('custom')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  dateMode === 'custom'
                    ? 'bg-indigo-600 text-white shadow font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Custom Range
              </button>
            </div>

            {dateMode === 'custom' && (
              <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent border-0 text-xs font-bold text-white focus:outline-none cursor-pointer p-0"
                />
                <span className="text-xs text-slate-400 font-bold">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent border-0 text-xs font-bold text-white focus:outline-none cursor-pointer p-0"
                />
                <button
                  onClick={() => {
                    if (customStartDate && customEndDate) {
                      fetchStats(customStartDate, customEndDate);
                    }
                  }}
                  disabled={!customStartDate || !customEndDate}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Apply
                </button>
              </div>
            )}

            <div className="flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 text-xs font-extrabold">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* 1. HERO MAIN ACTION CARDS GRID (4 Primary Actions) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Action 1: New Entry */}
          <button
            onClick={() => setCurrentTab && setCurrentTab('vehicle-entry')}
            className="flex items-center space-x-4 bg-gradient-to-tr from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 border border-indigo-500/30 rounded-2xl p-4 text-left transition-all active:scale-95 shadow-lg group cursor-pointer"
          >
            <div className="p-3 bg-white/10 rounded-xl text-white group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <span className="text-base font-black text-white block">New Entry</span>
              <span className="text-xs text-indigo-100/80 font-bold block">Check in vehicle</span>
            </div>
          </button>

          {/* Action 2: Vehicle List */}
          <button
            onClick={() => setCurrentTab && setCurrentTab('vehicles')}
            className="flex items-center space-x-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 text-left transition-all active:scale-95 shadow-lg group cursor-pointer"
          >
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <span className="text-base font-black text-white block">Vehicle List</span>
              <span className="text-xs text-slate-400 font-bold block">{stats.totalVehicles} Total Stock</span>
            </div>
          </button>

          {/* Action 3: Release Vehicle */}
          <button
            onClick={() => setReleaseWizardOpen(true)}
            className="flex items-center space-x-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 text-left transition-all active:scale-95 shadow-lg group cursor-pointer"
          >
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 group-hover:scale-110 transition-transform">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <span className="text-base font-black text-white block">Release Vehicle</span>
              <span className="text-xs text-slate-400 font-bold block">Check out vehicle</span>
            </div>
          </button>

          {/* Action 4: Pending Drafts */}
          <button
            onClick={() => setDraftsModalOpen(true)}
            className="flex items-center space-x-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 text-left transition-all active:scale-95 shadow-lg group cursor-pointer relative"
          >
            <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-black text-white block">Pending Drafts</span>
                {draftsCount > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {draftsCount}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 font-bold block">
                {draftsCount > 0 ? `${draftsCount} saved drafts` : 'No saved drafts'}
              </span>
            </div>
          </button>
        </div>

        {/* 2. YARD OPERATIONS SUMMARY METRICS GRID */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4 text-indigo-400" />
            <span>Yard Operations Summary</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: In Yard */}
            <button
              onClick={() => handleCountClick('PAKKA', 'all')}
              className="bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">In Yard</span>
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <LayoutGrid className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <span className="text-3xl font-black text-white tracking-tight font-display">{stats.totalVehicles}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-md">
                  Pakka: {stats.pakkaVehicles.total}
                </span>
                <span className="bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black px-2 py-0.5 rounded-md">
                  Kachha: {stats.kachhaVehicles.total}
                </span>
              </div>
            </button>

            {/* Metric 2: Today Entry */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Today Entry</span>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <span className="text-3xl font-black text-white tracking-tight font-display">{recentEntries.length}</span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">New check-ins logged today</span>
            </div>

            {/* Metric 3: Released */}
            <button
              onClick={() => handleThreeClick('RELEASED', 'today')}
              className="bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Released</span>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                  <KeyRound className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <span className="text-3xl font-black text-white tracking-tight font-display">{stats.releasedVehicles.today}</span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">Total released vehicles today</span>
            </button>

            {/* Metric 4: Today Revenue */}
            <button
              onClick={() => handleThreeClick('REVENUE', 'today')}
              className="bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 text-left transition-all active:scale-95 cursor-pointer flex flex-col justify-between"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Today Revenue</span>
                <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="my-2">
                <span className="text-3xl font-black text-white tracking-tight font-display">
                  ₹{stats.dailyRevenue.today.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <span className="text-xs text-slate-400 font-semibold">
                {stats.dailyRevenue.today.count} collections today
              </span>
            </button>
          </div>

          {/* Pending Yard Shifts Warning Banner */}
          <button
            onClick={() => setCurrentTab && setCurrentTab('vehicles')}
            className="w-full mt-3 bg-amber-950/40 hover:bg-amber-950/60 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between transition-all active:scale-98 text-left cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-black text-amber-300 block">🚚 Pending Yard Shifts</span>
                <span className="text-xs text-amber-400/80 font-semibold">Non-paneled bank vehicles queued for yard transfer</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-black text-amber-300">
                {(stats as any).shiftPendingCount || 0} Vehicles
              </span>
              <ChevronRight className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>

        {/* 3. QUICK TOOLS HORIZONTAL BAR */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span>Quick Tools</span>
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setCurrentTab && setCurrentTab('reports')}
              className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4 text-purple-400" />
              <span>Reports Analytics</span>
            </button>
            <button
              onClick={() => setCurrentTab && setCurrentTab('rates')}
              className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              <IndianRupee className="w-4 h-4 text-teal-400" />
              <span>Charges Calculator</span>
            </button>
            <button
              onClick={() => setCurrentTab && setCurrentTab('rates')}
              className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              <Building className="w-4 h-4 text-blue-400" />
              <span>Bank Master</span>
            </button>
            <button
              onClick={() => setCurrentTab && setCurrentTab('storage')}
              className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl text-slate-200 text-xs font-bold transition-all cursor-pointer"
            >
              <LayoutGrid className="w-4 h-4 text-emerald-400" />
              <span>Storage Management</span>
            </button>
          </div>
        </div>

        {/* 4. FINANCIAL PERFORMANCE SECTION */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <span>Financial Performance Overview</span>
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Financial Card 1: DAILY REVENUE */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="bg-blue-500/20 text-blue-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-blue-500/30 tracking-wider">
                    Total Earnings Overview
                  </span>
                  <h4 className="text-base font-black text-white uppercase tracking-wide mt-2">DAILY REVENUE</h4>
                  <p className="text-[11px] text-slate-400 font-bold">Pakka Stock Dues + Released Collections</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg">
                  ₹
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-6">
                <button
                  onClick={() => handleThreeClick('REVENUE', 'today')}
                  className="bg-slate-950 hover:bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center transition-all cursor-pointer"
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase block">TODAY</span>
                  <span className="text-sm font-black text-white block mt-1">₹{stats.dailyRevenue.today.amount.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Accrued: ₹{stats.dailyRevenue.today.accrued || 0}</span>
                </button>
                <button
                  onClick={() => handleThreeClick('REVENUE', 'this_month')}
                  className="bg-slate-950 hover:bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center transition-all cursor-pointer"
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase block">MONTH</span>
                  <span className="text-sm font-black text-white block mt-1">₹{stats.dailyRevenue.thisMonth.amount.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Accrued: ₹{stats.dailyRevenue.thisMonth.accrued || 0}</span>
                </button>
                <button
                  onClick={() => handleThreeClick('REVENUE', 'this_year')}
                  className="bg-slate-950 hover:bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center transition-all cursor-pointer"
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase block">YEAR</span>
                  <span className="text-sm font-black text-white block mt-1">₹{stats.dailyRevenue.thisYear.amount.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Accrued: ₹{stats.dailyRevenue.thisYear.accrued || 0}</span>
                </button>
              </div>
            </div>

            {/* Financial Card 2: KACHHA ACCRUED VALUE */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-rose-500/30 tracking-wider">
                    Kachha Liability
                  </span>
                  <h4 className="text-base font-black text-white uppercase tracking-wide mt-2">KACHHA ACCRUED VALUE</h4>
                  <p className="text-[11px] text-slate-400 font-bold">Accrued Kachha dues</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-rose-600 flex items-center justify-center text-white shadow-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-6">
                <button
                  onClick={() => handleThreeClick('LOSS', 'today')}
                  className="bg-slate-950 hover:bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center transition-all cursor-pointer"
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase block">TODAY</span>
                  <span className="text-sm font-black text-white block mt-1">₹{stats.dailyLoss.today.amount.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">{stats.dailyLoss.today.count} vehicles</span>
                </button>
                <button
                  onClick={() => handleThreeClick('LOSS', 'this_month')}
                  className="bg-slate-950 hover:bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center transition-all cursor-pointer"
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase block">MONTH</span>
                  <span className="text-sm font-black text-white block mt-1">₹{stats.dailyLoss.thisMonth.amount.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">{stats.dailyLoss.thisMonth.count} vehicles</span>
                </button>
                <button
                  onClick={() => handleThreeClick('LOSS', 'this_year')}
                  className="bg-slate-950 hover:bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center transition-all cursor-pointer"
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase block">YEAR</span>
                  <span className="text-sm font-black text-white block mt-1">₹{stats.dailyLoss.thisYear.amount.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">{stats.dailyLoss.thisYear.count} vehicles</span>
                </button>
              </div>
            </div>

            {/* Financial Card 3: PAKKA RUNNING CHARGES */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="bg-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase px-2.5 py-1 rounded-full border border-indigo-500/30 tracking-wider">
                    Pakka Liability
                  </span>
                  <h4 className="text-base font-black text-white uppercase tracking-wide mt-2">PAKKA RUNNING CHARGES</h4>
                  <p className="text-[11px] text-slate-400 font-bold">Active Pakka parking billing</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                  <Coins className="w-5 h-5" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-6">
                <button
                  onClick={() => handleCountClick('PAKKA', 'this_month')}
                  className="bg-slate-950 hover:bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center transition-all cursor-pointer"
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase block">THIS MONTH</span>
                  <span className="text-sm font-black text-white block mt-1">{stats.pakkaVehicles.thisMonth}</span>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Vehicles</span>
                </button>
                <button
                  onClick={() => handleCountClick('PAKKA', 'all')}
                  className="bg-slate-950 hover:bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center transition-all cursor-pointer"
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase block font-display">TOTAL STOCK</span>
                  <span className="text-sm font-black text-white block mt-1">{stats.pakkaVehicles.total}</span>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Pakka Active</span>
                </button>
                <button
                  onClick={() => handleThreeClick('REVENUE', 'this_month')}
                  className="bg-slate-950 hover:bg-slate-850 p-3 rounded-2xl border border-slate-800 text-center transition-all cursor-pointer"
                >
                  <span className="text-[9px] font-black text-slate-400 uppercase block">MONTH DUES</span>
                  <span className="text-sm font-black text-white block mt-1">₹{(stats.dailyRevenue.thisMonth.accrued || 0).toLocaleString('en-IN')}</span>
                  <span className="text-[9px] text-slate-500 font-bold block mt-0.5">Accrued</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 5. BANK-WISE SHARE & RECENT LOGS TABLES */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pt-2">
          {/* Bank Distribution */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between lg:col-span-1">
            <div>
              <h3 className="text-sm font-black text-white flex items-center space-x-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span className="uppercase tracking-wider">Bank Stock Breakdown</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Finance partner vehicles distribution</p>
            </div>

            <div className="space-y-3.5 my-5 flex-1 overflow-y-auto max-h-[260px] pr-1">
              {bankStats.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No bank records</p>
              ) : (
                (() => {
                  const total = bankStats.reduce((sum, b) => sum + b.count, 0) || 1;
                  return bankStats.map((item, idx) => {
                    const percent = Math.round((item.count / total) * 100);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-300">
                          <span>{item.bank}</span>
                          <span>{item.count} ({percent}%)</span>
                        </div>
                        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
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

          {/* Quick Offline Dues Calculator */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col justify-between lg:col-span-1">
            <div>
              <h3 className="text-sm font-black text-white flex items-center space-x-2">
                <IndianRupee className="w-4 h-4 text-emerald-400" />
                <span className="uppercase tracking-wider">Dues Estimator</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Quick customer parking charge check</p>
            </div>

            <div className="space-y-3.5 my-4 flex-1">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Days Parked</label>
                <input
                  type="number"
                  value={calcDays}
                  onChange={(e) => setCalcDays(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  min="1"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Rate Per Day (₹)</label>
                <input
                  type="number"
                  value={calcRate}
                  onChange={(e) => setCalcRate(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                  min="1"
                />
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 text-center mt-2">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider block">Estimated Dues</span>
                <span className="text-xl font-black text-emerald-300 block mt-0.5">₹{(calcDays * calcRate).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Recent In-Yard Entries Log */}
          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 lg:col-span-2 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-black text-white flex items-center space-x-2">
                <Truck className="w-4 h-4 text-indigo-400" />
                <span className="uppercase tracking-wider">Recent In-Yard Entries</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">Latest vehicle check-ins logged under tenant yard</p>
            </div>

            <div className="my-4 flex-1 overflow-x-auto min-h-[220px]">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-black tracking-wider text-[10px]">
                    <th className="pb-3 font-extrabold">Vehicle No</th>
                    <th className="pb-3 font-extrabold">Brand/Model</th>
                    <th className="pb-3 font-extrabold">Bank</th>
                    <th className="pb-3 font-extrabold">Status</th>
                    <th className="pb-3 font-extrabold">Yard Slot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-semibold">
                  {recentEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">No vehicles recorded yet</td>
                    </tr>
                  ) : (
                    recentEntries.slice(0, 5).map((v) => (
                      <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 font-black text-white uppercase tracking-wide">{v.vehicleNumber}</td>
                        <td className="py-3 text-slate-300 font-bold">{v.brand} {v.model}</td>
                        <td className="py-3 text-slate-400 font-bold">{v.bankName}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded font-black text-[9px] ${
                            v.yardStatus === 'KACHHA'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {v.yardStatus}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="font-bold text-slate-300 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
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
                                  {(() => {
                                    const pageSize = 15;
                                    const paginated = filtered.slice((modalPage - 1) * pageSize, modalPage * pageSize);
                                    return paginated.map((v) => (
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
                                    ));
                                  })()}
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
            {(() => {
              const pageSize = 15;
              const totalPages = Math.ceil(modalVehicles.length / pageSize) || 1;
              return (
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center text-slate-500 text-xs font-bold gap-3 px-6">
                  <div className="uppercase text-[10px] tracking-wider text-slate-400">
                    Showing Page {modalPage} of {totalPages} ({modalVehicles.length} total items)
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={modalPage <= 1}
                      onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={modalPage >= totalPages}
                      onClick={() => setModalPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* UNIFIED VEHICLE RELEASE DESK - Shared Modal Component */}
      <UnifiedReleaseModal
        isOpen={releaseWizardOpen}
        onClose={() => setReleaseWizardOpen(false)}
        onSuccess={handleReleaseSuccess}
      />

      {/* DRAFTS MODAL */}
      <DraftsModal
        isOpen={draftsModalOpen}
        onClose={() => setDraftsModalOpen(false)}
        onResumeDraft={(draftData) => {
          setDraftsModalOpen(false);
          setCurrentTab && setCurrentTab('vehicle-entry');
        }}
      />
    </div>
  );
};


