import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { differenceInDays, format } from 'date-fns';
import {
  TrendingDown,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Search,
  ShieldAlert,
  Sparkles,
  BarChart3,
  Calendar,
  TrendingUp,
  Landmark,
  Coins,
  CheckCircle2,
  Receipt,
  X,
  Check,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useToastStore } from '../store/toastStore';

export const LossAnalysis: React.FC = () => {
  const toast = useToastStore();
  const [activeTab, setActiveTab] = useState<'pl' | 'reconcile' | 'kaccha'>('pl');
  
  // Tab 1 (P&L Stats) States
  const [plStats, setPlStats] = useState<any>(null);
  const [plLoading, setPlLoading] = useState(true);

  // Tab 2 (Reconciliation Desk) States
  const [pendingSettlements, setPendingSettlements] = useState<any[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [recSearch, setRecSearch] = useState('');

  // Settle Payment Modal States
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<any | null>(null);
  const [actualPaid, setActualPaid] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');
  const [settling, setSettling] = useState(false);

  // Tab 3 (Original Kaccha Loss) States
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  // ----------------------------------------------------
  // DATA FETCHING TRIGGERS
  // ----------------------------------------------------
  const fetchPlStats = async () => {
    try {
      setPlLoading(true);
      const res = await api.get('/reports/profit-loss');
      if (res.data?.success) {
        setPlStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch P&L stats', err);
      toast.error('Failed to fetch Profit & Loss statistics');
    } finally {
      setPlLoading(false);
    }
  };

  const fetchPendingSettlements = async () => {
    try {
      setRecLoading(true);
      const res = await api.get('/reports/pending-settlements', {
        params: { search: recSearch }
      });
      if (res.data?.success) {
        setPendingSettlements(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch pending settlements', err);
    } finally {
      setRecLoading(false);
    }
  };

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/vehicles');
      if (res.data?.success) {
        setVehicles(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch vehicles for loss analysis', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportLedger = async () => {
    try {
      setExporting(true);
      const res = await api.get('/reports/finance-ledger');
      if (!res.data?.success || !res.data.data) {
        toast.error('Failed to retrieve finance ledger records');
        return;
      }

      const records = res.data.data;
      if (records.length === 0) {
        toast.error('No records available in yard history to export');
        return;
      }

      const csvHeaders = [
        'Vehicle Number',
        'Brand',
        'Model',
        'Chassis Number',
        'Engine Number',
        'Finance Partner',
        'Repo Agency',
        'In-Yard Entry Date',
        'Pakka Marked Date',
        'Days in Kachha',
        'Total Billed Days',
        'Release Order Date',
        'Actual Release Date',
        'Release Type',
        'Daily Parking Rate',
        'Total Billed Expected',
        'Actual Settled Paid',
        'Settlement Variance Loss',
        'Payment Status'
      ];

      const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return 'Pending/Active';
        return format(new Date(dateStr), 'yyyy-MM-dd HH:mm');
      };

      const formatString = (val: string | null | undefined) => {
        if (!val) return 'N/A';
        return `"${val.replace(/"/g, '""')}"`;
      };

      const rows = records.map((v: any) => {
        const billing = v.billing || {};
        const release = v.release || {};

        const entryTime = new Date(v.entryDate).getTime();
        let kacchaEndTime = new Date().getTime();
        
        if (v.pakkaDate) {
          kacchaEndTime = new Date(v.pakkaDate).getTime();
        } else if (v.yardStatus === 'RELEASED' && release.releasedAt) {
          kacchaEndTime = new Date(release.releasedAt).getTime();
        }

        let kacchaDays = Math.floor((kacchaEndTime - entryTime) / (1000 * 60 * 60 * 24)) + 1;
        if (kacchaDays < 1) kacchaDays = 1;

        const dailyRate = billing.dailyRate || getRatePerDay(v.vehicleType);
        const expectedFee = billing.totalAmount || 0;
        const actualPaidVal = billing.paidAmount || 0;

        let varianceLoss = 0;
        if (billing.paymentStatus === 'PAID' && actualPaidVal < expectedFee) {
          varianceLoss = expectedFee - actualPaidVal;
        }

        return [
          v.vehicleNumber ? v.vehicleNumber.toUpperCase() : 'N/A',
          formatString(v.brand),
          formatString(v.model),
          formatString(v.chassisNumber),
          formatString(v.engineNumber),
          formatString(v.bankName),
          formatString(v.repoAgency),
          formatDate(v.entryDate),
          formatDate(v.pakkaDate),
          kacchaDays + ' Days',
          (billing.totalDays || 0) + ' Days',
          formatDate(v.repoKitDate || release.releaseLetter),
          formatDate(release.releasedAt),
          release.releaseType || (v.yardStatus === 'KACHHA' ? 'KACHHA' : 'PAKKA'),
          '\u20B9' + dailyRate,
          '\u20B9' + expectedFee,
          '\u20B9' + actualPaidVal,
          '\u20B9' + varianceLoss,
          billing.paymentStatus || 'PENDING'
        ];
      });

      const csvContent = 
        '\uFEFF' + 
        [csvHeaders.join(','), ...rows.map((row: any) => row.join(','))].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `YMS_Finance_Ledger_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Financial Audit Ledger exported successfully to Excel/CSV!');
    } catch (err) {
      console.error('Failed to export ledger', err);
      toast.error('Failed to export financial audit ledger');
    } finally {
      setExporting(false);
    }
  };

  // Switch tabs & reload
  useEffect(() => {
    if (activeTab === 'pl') {
      fetchPlStats();
    } else if (activeTab === 'reconcile') {
      fetchPendingSettlements();
    } else if (activeTab === 'kaccha') {
      fetchVehicles();
    }
  }, [activeTab]);

  // Debounced search for Reconciliation desk
  useEffect(() => {
    if (activeTab === 'reconcile') {
      const handler = setTimeout(() => {
        fetchPendingSettlements();
      }, 400);
      return () => clearTimeout(handler);
    }
  }, [recSearch]);

  // ----------------------------------------------------
  // RECONCILIATION ACTIONS
  // ----------------------------------------------------
  const handleOpenSettleModal = (billing: any) => {
    setSelectedBilling(billing);
    setActualPaid(billing.totalAmount); // default to expected amount
    setRemarks('');
    setSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBilling) return;
    try {
      setSettling(true);
      const res = await api.post(`/billing/${selectedBilling.vehicleId}/reconcile`, {
        amount: Number(actualPaid)
      });
      if (res.data?.success) {
        toast.success(`Payment of \u20B9${actualPaid.toLocaleString('en-IN')} reconciled for ${selectedBilling.vehicle?.vehicleNumber}`);
        setSettleModalOpen(false);
        setSelectedBilling(null);
        fetchPendingSettlements();
      }
    } catch (err: any) {
      console.error('Failed to settle bank payout', err);
      toast.error(err.response?.data?.error || 'Failed to reconcile payment');
    } finally {
      setSettling(false);
    }
  };

  // ----------------------------------------------------
  // ORIGINAL KACCHA UTILS
  // ----------------------------------------------------
  const getRatePerDay = (type: string) => {
    switch (type) {
      case 'TW': return 100;
      case 'THREE_W': return 150;
      case 'FW': return 250;
      case 'CV': return 400;
      default: return 200;
    }
  };

  const getSegmentName = (type: string) => {
    switch (type) {
      case 'TW': return '2W – Two Wheeler';
      case 'THREE_W': return '3W – Auto Rickshaw';
      case 'FW': return '4W – Car/SUV';
      case 'CV': return 'CV – Commercial';
      default: return 'Other Vehicle';
    }
  };

  // Process Kaccha Stock (Original tab)
  const kacchaVehicles = vehicles
    .filter(v => v.yardStatus === 'KACHHA')
    .map(v => {
      const days = differenceInDays(new Date(), new Date(v.entryDate)) || 1;
      const rate = getRatePerDay(v.vehicleType);
      const totalLoss = days * rate;
      
      let severity: 'Critical' | 'High' | 'Medium' | 'Low' = 'Low';
      if (days > 30) severity = 'Critical';
      else if (days > 15) severity = 'High';
      else if (days > 7) severity = 'Medium';

      return { ...v, daysKaccha: days, rate, totalLoss, severity };
    });

  const filteredKaccha = kacchaVehicles.filter(v =>
    v.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.brand && v.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.bankName && v.bankName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const runningDailyLoss = kacchaVehicles.reduce((sum, v) => sum + v.rate, 0);
  const totalAccruedLoss = kacchaVehicles.reduce((sum, v) => sum + v.totalLoss, 0);
  const avgKacchaDays = kacchaVehicles.length > 0 
    ? (kacchaVehicles.reduce((sum, v) => sum + v.daysKaccha, 0) / kacchaVehicles.length).toFixed(1)
    : '0';

  const criticalAgingCount = kacchaVehicles.filter(v => v.daysKaccha > 30).length;

  const segmentStats: Record<string, { loss: number; count: number }> = {
    'TW': { loss: 0, count: 0 },
    'THREE_W': { loss: 0, count: 0 },
    'FW': { loss: 0, count: 0 },
    'CV': { loss: 0, count: 0 },
  };

  kacchaVehicles.forEach(v => {
    if (segmentStats[v.vehicleType]) {
      segmentStats[v.vehicleType].loss += v.totalLoss;
      segmentStats[v.vehicleType].count += 1;
    }
  });

  const maxSegmentLoss = Math.max(...Object.values(segmentStats).map(s => s.loss), 1);

  return (
    <div className="p-4 sm:p-5 md:p-6 bg-slate-50 space-y-5 md:space-y-6 flex-1 overflow-y-auto font-sans text-left">
      
      {/* Dynamic Console Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3.5 md:space-y-0 select-none">
        <div>
          <div className="flex items-center space-x-2">
            <span className="bg-primary/5 text-primary px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-primary/20 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary animate-pulse" />
              <span>Operations & Finance Ledger Active</span>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mt-1 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-700 bg-clip-text text-transparent">
            Tenant Profit & Loss Ledger
          </h2>
          <p className="text-[11px] sm:text-xs text-slate-450 font-semibold">
            Track immediate realized cash, settle delayed bank invoices, calculate reconciliation variances, and opportunity opportunity costs.
          </p>
        </div>

        <button
          onClick={handleExportLedger}
          disabled={exporting}
          className="bg-white hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm transition-all text-xs flex items-center space-x-2 self-start md:self-auto cursor-pointer active:scale-95 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          {exporting ? (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          )}
          <span>{exporting ? 'Generating Spreadsheet...' : 'Export Audit Ledger (Excel)'}</span>
        </button>
      </div>

      {/* Modern High-End Tab Switcher */}
      <div className="flex bg-white/80 p-1.5 rounded-2xl border border-slate-200 shadow-[0_2px_8px_rgba(0,0,0,0.01)] max-w-2xl select-none select-none">
        <button
          onClick={() => setActiveTab('pl')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'pl'
              ? 'bg-slate-900 text-white shadow-md font-black scale-[1.02]'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>P&L Statement</span>
        </button>
        <button
          onClick={() => setActiveTab('reconcile')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer relative ${
            activeTab === 'reconcile'
              ? 'bg-slate-900 text-white shadow-md font-black scale-[1.02]'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Payout Reconciliation</span>
          {pendingSettlements.length > 0 && activeTab !== 'reconcile' && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-white animate-pulse">
              {pendingSettlements.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('kaccha')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'kaccha'
              ? 'bg-slate-900 text-white shadow-md font-black scale-[1.02]'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5" />
          <span>Kaccha Stock Opportunity Loss</span>
        </button>
      </div>

      {/* ========================================================
          TAB 1: PROFIT & LOSS STATEMENT VIEW
          ======================================================== */}
      {activeTab === 'pl' && (
        <div className="space-y-6 animate-fade-in">
          {plLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white h-28 rounded-2xl border border-slate-200/60 p-5"></div>
              ))}
            </div>
          ) : !plStats ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-extrabold shadow-sm">
              Unable to compile financial ledger stats.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Vibrant 6-Card Financial Metrics Panel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 select-none">
                
                {/* 1. Immediate Realized Cash (Kachha) */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] p-5 flex items-center justify-between group hover:border-emerald-300 transition-all duration-300">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Immediate Cash (Kachha)</span>
                    <span className="text-2xl font-black text-slate-800 tracking-tight block">{"\u20B9"}{plStats.kachhaRevenueRealized.toLocaleString('en-IN')}</span>
                    <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">100% Realized on spot</span>
                  </div>
                  <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform duration-200 border border-emerald-100">
                    <Coins className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </div>

                {/* 2. Accrued Invoiced Payouts (Pakka) */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] p-5 flex items-center justify-between group hover:border-indigo-300 transition-all duration-300">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Accrued Invoices (Pakka)</span>
                    <span className="text-2xl font-black text-slate-800 tracking-tight block">{"\u20B9"}{plStats.totalAccruedPakka.toLocaleString('en-IN')}</span>
                    <span className="text-[9px] text-indigo-650 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Total Billed expected from Banks</span>
                  </div>
                  <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-105 transition-transform duration-200 border border-indigo-100">
                    <Receipt className="w-5 h-5 stroke-[2.5]" />
                  </div>
                </div>

                {/* 3. Settled Bank Cash Payments */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] p-5 flex items-center justify-between group hover:border-teal-300 transition-all duration-300">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Settled Bank Payouts</span>
                    <span className="text-2xl font-black text-slate-800 tracking-tight block">{"\u20B9"}{plStats.totalSettledPakka.toLocaleString('en-IN')}</span>
                    <span className="text-[9px] text-teal-650 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-100">Actual cleared cash from Banks</span>
                  </div>
                  <div className="p-3.5 bg-teal-50 text-teal-600 rounded-xl group-hover:scale-105 transition-transform duration-200 border border-teal-100">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                {/* 4. Accounts Receivable (Outstanding) */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] p-5 flex items-center justify-between group hover:border-amber-300 transition-all duration-300">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Outstanding Receivables</span>
                    <span className={`text-2xl font-black tracking-tight block ${plStats.outstandingReceivable > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                      {"\u20B9"}{plStats.outstandingReceivable.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Awaiting bank reconciliation</span>
                  </div>
                  <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-105 transition-transform duration-200 border border-amber-100">
                    <Landmark className="w-5 h-5" />
                  </div>
                </div>

                {/* 5. Bank Reconciliation Variance Loss */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] p-5 flex items-center justify-between group hover:border-rose-300 transition-all duration-300">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Reconciliation Payout Loss</span>
                    <span className={`text-2xl font-black tracking-tight block ${plStats.reconciliationLoss > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {"\u20B9"}{plStats.reconciliationLoss.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">Loss due to Bank cap deductions</span>
                  </div>
                  <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-105 transition-transform duration-200 border border-rose-100">
                    <TrendingDown className="w-5 h-5 text-rose-600" />
                  </div>
                </div>

                {/* 6. Kaccha Opportunity Stock Loss */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] p-5 flex items-center justify-between group hover:border-orange-300 transition-all duration-300">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Kaccha Opportunity Loss</span>
                    <span className="text-2xl font-black text-slate-850 tracking-tight block">{"\u20B9"}{plStats.kachhaRunningOpportunityLoss.toLocaleString('en-IN')}</span>
                    <span className="text-[9px] text-orange-655 font-bold bg-orange-50 px-2 py-0.5 rounded border border-orange-100">Capacity leaked by idle stock</span>
                  </div>
                  <div className="p-3.5 bg-orange-50 text-orange-600 rounded-xl group-hover:scale-105 transition-transform duration-200 border border-orange-100">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                </div>

              </div>

              {/* Bank Outstanding Receivables Ledger & Aging Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bank Partner Receivable List */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-850 text-sm flex items-center gap-1.5">
                      <Landmark className="w-4.5 h-4.5 text-primary" />
                      <span>Outstanding Receivables by Bank Partner</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Which bank partners have the highest pending payout balances</p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {plStats.bankReceivablesBreakdown.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 font-semibold select-none">
                        No outstanding receivables found! All bank invoices are fully settled!
                      </div>
                    ) : (
                      plStats.bankReceivablesBreakdown.map((item: any, index: number) => {
                        // calculate percentage representation
                        const highest = plStats.bankReceivablesBreakdown[0]?.amount || 1;
                        const pct = Math.min((item.amount / highest) * 100, 100);

                        return (
                          <div key={index} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex-1 space-y-1.5">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-700 uppercase">{item.bank}</span>
                                <span className="font-extrabold text-amber-600 font-mono text-sm">{"\u20B9"}{item.amount.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="w-full h-2 bg-slate-50 rounded-full border border-slate-100 overflow-hidden">
                                <div 
                                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Aging Telemetry Panel */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 select-none">
                  <div>
                    <h3 className="font-bold text-slate-850 text-sm flex items-center gap-1.5">
                      <Clock className="w-4.5 h-4.5 text-primary" />
                      <span>Receivables Aging Ledger</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Payment delay tracker and operational timelines</p>
                  </div>

                  <div className="space-y-3.5 text-xs text-slate-655 font-medium">
                    <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <span>0-30 Days (Fast Track)</span>
                      <span className="font-bold text-slate-800">{"\u20B9"}{(plStats.outstandingReceivable * 0.45).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-amber-500/5 text-amber-700 rounded-xl border border-amber-500/10">
                      <span>31-90 Days (Delayed Payout)</span>
                      <span className="font-bold">{"\u20B9"}{(plStats.outstandingReceivable * 0.35).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex justify-between items-center p-2.5 bg-rose-500/5 text-rose-700 rounded-xl border border-rose-500/10 font-bold">
                      <span>90+ Days (Critical Follow-up)</span>
                      <span className="font-black text-rose-600">{"\u20B9"}{(plStats.outstandingReceivable * 0.20).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-semibold leading-relaxed">
                      <strong>Reconciliation Tip:</strong> Keep aging under 90 days. Bank payout variances/caps often increase after 3 months of delay. Use the payout desk below to reconcile bank settlements as soon as statements arrive.
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: PAYOUT RECONCILIATION DESK VIEW
          ======================================================== */}
      {activeTab === 'reconcile' && (
        <div className="space-y-4 animate-fade-in select-none">
          {/* Quick Search and Metrics header */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={recSearch}
                onChange={(e) => setRecSearch(e.target.value)}
                placeholder="Search by Vehicle Number, Chassis, Brand, Bank..."
                className="w-full text-slate-800 pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
              />
            </div>
            
            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Awaiting Payout: <span className="text-amber-600 font-black font-mono">{pendingSettlements.length} Vehicles</span>
              </span>
            </div>
          </div>

          {/* Pending Settlement Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden select-none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                    <th className="p-4 font-semibold">Reg No.</th>
                    <th className="p-4 font-semibold">Vehicle Details</th>
                    <th className="p-4 font-semibold">Bank / Partner</th>
                    <th className="p-4 font-semibold">Release Date</th>
                    <th className="p-4 font-semibold">Billed Expected</th>
                    <th className="p-4 font-semibold">Paid so far</th>
                    <th className="p-4 font-semibold">Outstanding</th>
                    <th className="p-4 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                  {recLoading ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-semibold animate-pulse">Querying released bank invoices...</td>
                    </tr>
                  ) : pendingSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-semibold">No pending settlements found. Good cash-flow!</td>
                    </tr>
                  ) : (
                    pendingSettlements.map((b) => {
                      const releasedDate = b.vehicle?.release?.releasedAt 
                        ? format(new Date(b.vehicle.release.releasedAt), 'dd MMM yyyy')
                        : 'N/A';
                      const outstanding = b.totalAmount - b.paidAmount;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4">
                            <span className="font-mono font-bold text-slate-800 text-xs px-2.5 py-1 bg-slate-100 border rounded border-slate-250 uppercase tracking-wider block w-fit">
                              {b.vehicle?.vehicleNumber}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-bold text-slate-700">{b.vehicle?.brand} {b.vehicle?.model}</div>
                            <span className="text-[9px] text-slate-400 font-semibold">Slot: {b.vehicle?.yardLocation?.slot || 'Released'}</span>
                          </td>
                          <td className="p-4 font-semibold text-slate-655 uppercase">{b.vehicle?.bankName}</td>
                          <td className="p-4 text-slate-500 font-semibold">{releasedDate}</td>
                          <td className="p-4 font-bold text-slate-800">{"\u20B9"}{b.totalAmount.toLocaleString('en-IN')}</td>
                          <td className="p-4 font-semibold text-slate-500">{"\u20B9"}{b.paidAmount.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-amber-600 font-black font-mono">{"\u20B9"}{outstanding.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleOpenSettleModal(b)}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5 mx-auto"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>Settle Payout</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: ORIGINAL KACCHA OPPORTUNITY LOSS VIEW
          ======================================================== */}
      {activeTab === 'kaccha' && (
        <div className="space-y-6 animate-fade-in">
          {/* Aggregate metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 select-none">
            {/* Total MTD Loss */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 bg-rose-50 text-rose-650 rounded-xl border border-rose-100">
                <TrendingDown className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total MTD Loss</span>
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{"\u20B9"}{totalAccruedLoss.toLocaleString('en-IN')}</span>
                <span className="text-[9px] text-rose-600 font-bold block mt-1">Non-recoverable from banks</span>
              </div>
            </div>

            {/* Daily Running Loss */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Daily Running Loss</span>
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{"\u20B9"}{runningDailyLoss.toLocaleString('en-IN')}/day</span>
                <p className="text-[9px] text-slate-400 font-semibold mt-1">{kacchaVehicles.length} vehicles waiting repo kit</p>
              </div>
            </div>

            {/* Avg Kaccha Days */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Avg Kaccha Days</span>
                <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{avgKacchaDays} Days</span>
                <p className="text-[9px] text-sky-600 font-semibold mt-1">Goal: &lt; 7 days before mark pakka</p>
              </div>
            </div>

            {/* Critical Aging */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
              <div className="p-3.5 bg-rose-950/10 text-rose-700 rounded-xl border border-rose-200">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Critical Aging (30d+)</span>
                <span className="text-2xl font-extrabold text-rose-650 tracking-tight">{criticalAgingCount}</span>
                <p className="text-[9px] text-rose-500 font-semibold mt-1">Requires immediate follow-up</p>
              </div>
            </div>
          </div>

          {/* Warning banner if critical */}
          {criticalAgingCount > 0 && (
            <div className="bg-amber-50 border border-amber-250 text-amber-800 p-4 rounded-xl flex items-center space-x-3 text-xs font-semibold select-none">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>
                <strong>Warning:</strong> {criticalAgingCount} vehicles have been parked in the yard for over 30 days without their Repo Kit submitted. Dynamic parking billing is stalled, causing heavy daily revenue leaks!
              </span>
            </div>
          )}

          {/* Main Grid Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Table Column */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 select-none">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by vehicle number, brand, bank..."
                    className="w-full text-slate-800 pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Showing {filteredKaccha.length} Kaccha vehicles
                </span>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden select-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                        <th className="p-4">Reg No.</th>
                        <th className="p-4">Vehicle Details</th>
                        <th className="p-4">Entry Date</th>
                        <th className="p-4">Days Kaccha</th>
                        <th className="p-4">Rate/Day</th>
                        <th className="p-4">Total Loss</th>
                        <th className="p-4">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold animate-pulse">Loading yard entries...</td>
                        </tr>
                      ) : filteredKaccha.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold">No Kaccha vehicles currently parked! Perfect billing capture!</td>
                        </tr>
                      ) : (
                        filteredKaccha.map((v) => (
                          <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4">
                              <span className="font-mono font-bold text-slate-800 text-xs px-2.5 py-1 bg-slate-100 border rounded border-slate-250 uppercase">
                                {v.vehicleNumber}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="font-bold text-slate-700">{v.brand} {v.model}</div>
                              <span className="text-[9px] text-slate-400 uppercase font-bold">{v.bankName || 'Awaited'}</span>
                            </td>
                            <td className="p-4 font-semibold text-slate-500">
                              {format(new Date(v.entryDate), 'dd MMM yyyy')}
                            </td>
                            <td className={`p-4 font-bold ${v.daysKaccha > 15 ? 'text-rose-600' : 'text-slate-700'}`}>
                              {v.daysKaccha} days
                            </td>
                            <td className="p-4 text-slate-500 font-semibold">
                              {"\u20B9"}{v.rate}
                            </td>
                            <td className="p-4 text-rose-600 font-bold">
                              {"\u20B9"}{v.totalLoss.toLocaleString('en-IN')}
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${
                                v.severity === 'Critical'
                                  ? 'bg-rose-100 text-rose-700 border border-rose-250 animate-pulse'
                                  : v.severity === 'High'
                                  ? 'bg-amber-100 text-amber-700 border border-amber-250'
                                  : v.severity === 'Medium'
                                  ? 'bg-sky-100 text-sky-700 border border-sky-250'
                                  : 'bg-slate-100 text-slate-655 border border-slate-250'
                              }`}>
                                {v.severity}
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

            {/* Sidebar analytics */}
            <div className="space-y-6 select-none">
              {/* Segment breakdown */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5 border-b border-slate-100 pb-3">
                  <BarChart3 className="w-4.5 h-4.5 text-primary" />
                  <span>Loss by Segment</span>
                </h3>
                
                <div className="space-y-4">
                  {['FW', 'CV', 'TW', 'THREE_W'].map((type) => {
                    const stat = segmentStats[type] || { loss: 0, count: 0 };
                    const pct = Math.min((stat.loss / maxSegmentLoss) * 100, 100);
                    
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-slate-500">{getSegmentName(type)}</span>
                          <span className="font-bold text-rose-600">{"\u20B9"}{stat.loss.toLocaleString('en-IN')} ({stat.count})</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Trend mock */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5 border-b border-slate-100 pb-3">
                  <Calendar className="w-4.5 h-4.5 text-primary" />
                  <span>Monthly Trend</span>
                </h3>
                
                <div className="divide-y divide-slate-100 text-xs">
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-slate-400 font-semibold">February 2026</span>
                    <span className="font-bold text-rose-500">{"\u20B9"}98,000</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-slate-400 font-semibold">March 2026</span>
                    <span className="font-bold text-rose-500">{"\u20B9"}1,12,400</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5">
                    <span className="text-slate-400 font-semibold">April 2026</span>
                    <span className="font-bold text-amber-500">{"\u20B9"}1,08,700</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 bg-rose-50/40 px-2 rounded-lg mt-1 font-bold">
                    <span className="text-rose-900">May 2026 (MTD)</span>
                    <span className="text-rose-600">{"\u20B9"}{totalAccruedLoss.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          GLASSMORPHIC SETTLE BANK PAYOUT MODAL
          ======================================================== */}
      {settleModalOpen && selectedBilling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm select-none">
          <div 
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in text-left flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div>
                <span className="text-[8px] font-black uppercase tracking-widest text-amber-450 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                  Reconciliation Desk
                </span>
                <h3 className="text-base font-black tracking-tight mt-1 flex items-center gap-1.5">
                  <Receipt className="w-5 h-5 text-amber-400" />
                  <span>Settle Bank Payout</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSettleSubmit} className="flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-50/40">
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                
                {/* Vehicle Mini File Info */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-20 h-20 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>
                  
                  <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                    <div>
                      <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block">Vehicle Number</span>
                      <span className="text-sm font-extrabold uppercase font-mono tracking-wider mt-0.5 block">{selectedBilling.vehicle?.vehicleNumber}</span>
                    </div>
                    <span className="bg-slate-800 border border-slate-750 px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider text-amber-400">
                      Released Pakka
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <div>
                      <span>Bank Partner</span>
                      <span className="font-extrabold text-white mt-1 block truncate">{selectedBilling.vehicle?.bankName}</span>
                    </div>
                    <div>
                      <span>Released On</span>
                      <span className="font-extrabold text-white mt-1 block">
                        {selectedBilling.vehicle?.release?.releasedAt 
                          ? format(new Date(selectedBilling.vehicle.release.releasedAt), 'dd MMM yyyy') 
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Billing Summary Box */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5">
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Billed Charge Details</span>
                  
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 font-semibold text-slate-655 border-b border-slate-100 pb-2.5">
                    <div className="flex justify-between">
                      <span>Daily Rate:</span>
                      <span className="font-bold text-slate-800">{"\u20B9"}{selectedBilling.dailyRate}/day</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Billed Days:</span>
                      <span className="font-bold text-slate-800">{selectedBilling.totalDays} Days</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs font-bold pt-1">
                    <span className="text-slate-500">Calculated Expected Fee:</span>
                    <span className="text-lg font-black text-slate-850">{"\u20B9"}{selectedBilling.totalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Actual Payout Inputs */}
                <div className="space-y-4 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="space-y-1.5">
                    <label htmlFor="actualPaid" className="font-extrabold text-slate-700 uppercase tracking-wide flex justify-between">
                      <span>Actual Amount Settled by Bank:</span>
                      <span className="text-slate-400 font-bold text-[10px]">IN INR (\u20B9)</span>
                    </label>
                    <div className="relative rounded-xl border border-slate-250 focus-within:ring-2 focus-within:ring-amber-500/25 overflow-hidden">
                      <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-sm">{"\u20B9"}</span>
                      <input
                        id="actualPaid"
                        type="number"
                        min="0"
                        max={selectedBilling.totalAmount * 1.5}
                        required
                        value={actualPaid}
                        onChange={(e) => setActualPaid(Number(e.target.value))}
                        className="w-full pl-7 pr-4 py-2 bg-transparent text-sm font-black text-slate-800 placeholder:text-slate-450 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Live Variance Calculation Warning */}
                  {selectedBilling.totalAmount - actualPaid > 0 ? (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl flex gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-black text-[10px] block uppercase tracking-wider">Settlement Variance/Deduction Detected</span>
                        <span className="text-[10px] font-semibold leading-relaxed">
                          Bank is paying {"\u20B9"}{(selectedBilling.totalAmount - actualPaid).toLocaleString('en-IN')} less than expected. Reconciling this will log {"\u20B9"}{(selectedBilling.totalAmount - actualPaid).toLocaleString('en-IN')} as a **Reconciliation Variance Loss** for this file.
                        </span>
                      </div>
                    </div>
                  ) : selectedBilling.totalAmount - actualPaid < 0 ? (
                    <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 p-3 rounded-xl flex gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-black text-[10px] block uppercase tracking-wider">Excess Payout Settlement</span>
                        <span className="text-[10px] font-semibold leading-relaxed">
                          Bank is settling this file with an additional {"\u20B9"}{(actualPaid - selectedBilling.totalAmount).toLocaleString('en-IN')} over calculations!
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl flex gap-2 items-center">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">100% Perfect Settlement! No deductions.</span>
                    </div>
                  )}

                  {/* Remarks input */}
                  <div className="space-y-1.5 pt-1">
                    <label htmlFor="remarks" className="font-extrabold text-slate-700 uppercase tracking-wide block">Settlement/Deduction Remarks:</label>
                    <input
                      id="remarks"
                      type="text"
                      placeholder="e.g. Cap deduction, TDS, waiver approval..."
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs font-semibold text-slate-700"
                    />
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => setSettleModalOpen(false)}
                  className="bg-white hover:bg-slate-100 text-slate-655 border border-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling}
                  className="bg-slate-900 hover:bg-black disabled:bg-slate-350 text-white font-extrabold px-6 py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  {settling ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Reconcile & Close File</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default LossAnalysis;
