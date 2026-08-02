import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';
import {
  Search,
  SlidersHorizontal,
  ChevronRight,
  Download,
  Car,
  Truck,
  Building,
  Calendar,
  AlertTriangle,
  RefreshCw,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { VehicleDetailsDrawer } from './VehicleDetailsDrawer';

export const VehicleList: React.FC = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters State
  const [search, setSearch] = useState(() => {
    return localStorage.getItem('yms_vehicle_list_search') || '';
  });
  const [debouncedSearch, setDebouncedSearch] = useState(() => {
    return localStorage.getItem('yms_vehicle_list_search') || '';
  });
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'KACHHA' | 'PAKKA' | 'RELEASED' | 'SHIFT_PENDING'>('ALL');

  // Stats Counters
  const [stats, setStats] = useState({
    all: 0,
    pakka: 0,
    kachha: 0,
    shiftPending: 0,
    released: 0,
  });

  // Selected Vehicle for Drawer Details
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const redirectSearch = localStorage.getItem('yms_vehicle_list_search');
    if (redirectSearch) {
      localStorage.removeItem('yms_vehicle_list_search');
      localStorage.setItem('yms_vehicle_list_auto_open', 'true');
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, statusFilter]);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter) params.vehicleType = typeFilter;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'SHIFT_PENDING') {
          params.shiftStatus = 'SHIFT_PENDING';
        } else {
          params.yardStatus = statusFilter;
        }
      }

      const res = await api.get('/vehicles', { params });
      if (res.data?.success) {
        const fetchedVehicles = res.data.data || [];
        setVehicles(fetchedVehicles);
        setTotalPages(res.data.totalPages || 1);
        setTotalRecords(res.data.total || 0);

        // Calculate stats counts from current context or response meta
        if (res.data.stats) {
          setStats({
            all: res.data.stats.all || res.data.total || 0,
            pakka: res.data.stats.pakka || 0,
            kachha: res.data.stats.kachha || 0,
            shiftPending: res.data.stats.shiftPending || 0,
            released: res.data.stats.released || 0,
          });
        } else {
          // Fallback stats
          const all = res.data.total || fetchedVehicles.length;
          const pakka = fetchedVehicles.filter((v: any) => v.yardStatus === 'PAKKA').length;
          const kachha = fetchedVehicles.filter((v: any) => v.yardStatus === 'KACHHA').length;
          const released = fetchedVehicles.filter((v: any) => v.yardStatus === 'RELEASED').length;
          const shiftPending = fetchedVehicles.filter((v: any) => v.shiftStatus === 'SHIFT_PENDING' || v.shiftStatus === 'SHIFT_INITIATED').length;
          setStats({ all, pakka, kachha, shiftPending, released });
        }

        // Auto open if marked for auto-open on redirection
        const autoOpen = localStorage.getItem('yms_vehicle_list_auto_open');
        if (autoOpen === 'true') {
          localStorage.removeItem('yms_vehicle_list_auto_open');
          if (fetchedVehicles.length > 0) {
            openDetails(fetchedVehicles[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load stock list', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [debouncedSearch, typeFilter, statusFilter, page]);

  const openDetails = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setDrawerOpen(true);
  };

  // Helper functions
  const getDailyRate = (type: string) => {
    if (type === 'TW') return 50;
    if (type === 'THREE_W') return 100;
    if (type === 'CV') return 400;
    return 150;
  };

  const getDurationDays = (entryDateStr: string | null) => {
    if (!entryDateStr) return 1;
    const entryDate = new Date(entryDateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - entryDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  };

  const handleExportCSV = async () => {
    if (vehicles.length === 0) {
      alert('There is no vehicle data available to export.');
      return;
    }

    try {
      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return '';
        let str = String(val).replace(/"/g, '""');
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          str = `"${str}"`;
        }
        return str;
      };

      const headers = [
        'Serial No',
        'Vehicle Number',
        'Category',
        'Brand',
        'Model',
        'Bank Name',
        'Chassis Number',
        'Engine Number',
        'Customer Name',
        'Customer Phone',
        'Repo Details',
        'Entry Date',
        'Status',
        'Location Slot',
        'Total Days',
        'Total Charges'
      ];

      const rows = vehicles.map(v => {
        const days = getDurationDays(v.entryDate);
        const rate = getDailyRate(v.vehicleType);
        const totalCharges = v.yardStatus === 'KACHHA' ? 0 : days * rate;
        
        let loc = 'Unallocated';
        if (v.yardLocation) {
          loc = `${v.yardLocation.zone} - ${v.yardLocation.slot}`;
        }

        return [
          escapeCSV(v.serialNumber || 'N/A'),
          escapeCSV((v.vehicleNumber || '').toUpperCase()),
          escapeCSV(v.vehicleType),
          escapeCSV(v.brand),
          escapeCSV(v.model),
          escapeCSV(v.bankName),
          escapeCSV(v.chassisNumber),
          escapeCSV(v.engineNumber),
          escapeCSV(v.customerName),
          escapeCSV(v.customerPhone),
          escapeCSV(v.repoAgency),
          escapeCSV(v.entryDate ? new Date(v.entryDate).toLocaleString('en-IN') : 'N/A'),
          escapeCSV(v.yardStatus),
          escapeCSV(loc),
          escapeCSV(days),
          escapeCSV(totalCharges)
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `YMS_Stock_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('CSV Export failed:', err);
      alert('Could not export vehicle list CSV.');
    }
  };

  const defaultPhoto = 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?w=300';

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-950 space-y-6 flex-1 overflow-y-auto relative text-slate-100 font-sans">
      
      {/* 1. Header Bar matching Mobile App Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 select-none border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <Car className="w-6 h-6 text-indigo-400" />
            <h2 className="text-2xl font-black text-white tracking-tight font-mono uppercase">Vehicle Inventory Stock</h2>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Real-time yard inventory console • Search vehicle plates, manage status workflows & release passes
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => fetchVehicles()}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-all text-xs font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh Stock List"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2.5 rounded-xl shadow-md transition-all text-xs flex items-center space-x-2 uppercase tracking-wider cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Stock CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Search Bar & Category Filter Controls */}
      <div className="bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search input */}
        <div className="relative w-full md:max-w-md select-none">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Plate Number, Chassis, Engine, Bank or Owner..."
            className="w-full text-white bg-slate-950 pl-10 pr-10 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500 text-xs font-semibold placeholder-slate-500 uppercase tracking-wide font-mono"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category dropdown & Filter indicator */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto select-none justify-end">
          <div className="flex items-center space-x-1.5 bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs font-bold text-slate-300">
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span className="uppercase text-[10px] tracking-wider font-extrabold">Category Filter:</span>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs font-bold text-white bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">All Categories (2W / 3W / FW / CV)</option>
            <option value="TW">2-Wheeler (TW)</option>
            <option value="THREE_W">3-Wheeler (3W)</option>
            <option value="FW">4-Wheeler (FW)</option>
            <option value="CV">Commercial Vehicle (CV)</option>
          </select>
        </div>
      </div>

      {/* 3. Horizontal Filter Tabs Bar (Matching Mobile App Status Filter Pills) */}
      <div className="bg-slate-900/60 rounded-2xl border border-slate-800 p-2 overflow-x-auto select-none scrollbar-none">
        <div className="flex items-center space-x-2 min-w-max">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            All Stock ({stats.all})
          </button>

          <button
            onClick={() => setStatusFilter('PAKKA')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'PAKKA'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Pakka / In Yard ({stats.pakka})
          </button>

          <button
            onClick={() => setStatusFilter('KACHHA')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'KACHHA'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-950 text-slate-400 hover:text-amber-400 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Kachha Entry ({stats.kachha})
          </button>

          <button
            onClick={() => setStatusFilter('SHIFT_PENDING')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
              statusFilter === 'SHIFT_PENDING'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'bg-amber-950/30 text-amber-400 hover:bg-amber-950/50 border border-amber-800/60'
            }`}
          >
            <span>🚚 Shift Pending</span>
            {stats.shiftPending > 0 && (
              <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[9px] font-mono font-black">
                {stats.shiftPending}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('RELEASED')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'RELEASED'
                ? 'bg-indigo-900 text-indigo-100 shadow-md border border-indigo-700'
                : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            Released Gate Out ({stats.released})
          </button>
        </div>
      </div>

      {/* 4. Desktop Table View */}
      <div className="hidden lg:block bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-xl overflow-hidden select-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase font-extrabold tracking-wider text-[10px]">
                <th className="p-4 font-semibold">Vehicle Details</th>
                <th className="p-4 font-semibold">Category & Model</th>
                <th className="p-4 font-semibold">Financer / Repo Agency</th>
                <th className="p-4 font-semibold">In-Gate Stay</th>
                <th className="p-4 font-semibold">Yard Slot</th>
                <th className="p-4 font-semibold">Accrued Due</th>
                <th className="p-4 font-semibold">Yard Status</th>
                <th className="p-4 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 font-bold">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading stock inventory from yard database...</span>
                    </div>
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 font-bold italic">
                    No matching vehicles found for the selected filter or search query.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => {
                  const days = getDurationDays(v.entryDate);
                  const rate = getDailyRate(v.vehicleType);
                  const totalCharges = v.yardStatus === 'KACHHA' ? 0 : days * rate;
                  const frontPhoto = v.photos?.find((p: any) => p.photoType === 'front' || p.photoType === 'front_view')?.s3Url || v.photos?.[0]?.s3Url || defaultPhoto;

                  return (
                    <tr
                      key={v.id}
                      onClick={() => openDetails(v)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors group"
                    >
                      {/* Vehicle Number & Photo */}
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="relative w-12 h-10 rounded-lg overflow-hidden border border-slate-800 bg-slate-950 shrink-0">
                            <img src={frontPhoto} alt={v.vehicleNumber} className="w-full h-full object-cover" />
                            {v.serialNumber !== undefined && v.serialNumber !== null && (
                              <span className="absolute bottom-0 right-0 bg-black/80 text-amber-400 px-1 text-[8px] font-mono font-bold">
                                #{v.serialNumber}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="font-black text-white font-mono text-sm tracking-wider uppercase block">
                              {v.vehicleNumber}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              INV-{new Date(v.entryDate || Date.now()).getFullYear()}-{v.id.substring(0, 6).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Brand & Model */}
                      <td className="p-4">
                        <span className="font-bold text-slate-200 block">{v.brand || 'Unknown'} {v.model || ''}</span>
                        <span className="text-[10px] text-indigo-400 font-extrabold uppercase block mt-0.5">
                          {v.vehicleType === 'TW' ? '2-Wheeler (TW)' : v.vehicleType === 'THREE_W' ? '3-Wheeler (3W)' : v.vehicleType === 'CV' ? 'Commercial (CV)' : '4-Wheeler (FW)'}
                        </span>
                      </td>

                      {/* Financer & Repo */}
                      <td className="p-4">
                        <span className="font-bold text-white block">{v.bankName || 'N/A'}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{v.repoAgency || 'Standard Partner'}</span>
                      </td>

                      {/* In-Gate Stay */}
                      <td className="p-4">
                        <span className="font-bold text-slate-200 font-mono block">{days} Days</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {v.entryDate ? new Date(v.entryDate).toLocaleDateString('en-IN') : 'N/A'}
                        </span>
                      </td>

                      {/* Yard Slot */}
                      <td className="p-4">
                        <span className="font-bold text-slate-300 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono">
                          {v.yardLocation ? `${v.yardLocation.slot} (Z-${v.yardLocation.zone})` : 'Unallocated'}
                        </span>
                      </td>

                      {/* Accrued Due */}
                      <td className="p-4">
                        <span className="font-black text-indigo-400 font-mono text-sm block">
                          {"\u20B9"}{totalCharges.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">{"\u20B9"}{rate}/day</span>
                      </td>

                      {/* Yard Status Pill */}
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full font-extrabold text-[9px] uppercase tracking-wider ${
                            v.yardStatus === 'KACHHA'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : v.yardStatus === 'PAKKA'
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          }`}
                        >
                          {v.yardStatus === 'KACHHA' ? 'Kachha' : v.yardStatus === 'PAKKA' ? 'In Yard' : v.yardStatus}
                        </span>
                      </td>

                      {/* Action Chevron */}
                      <td className="p-4 text-right">
                        <div className="p-2 rounded-xl bg-slate-950 group-hover:bg-indigo-600 text-slate-400 group-hover:text-white transition-all inline-flex items-center justify-center">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-slate-950 border-t border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 select-none">
          <div className="text-xs font-semibold text-slate-400">
            Showing <span className="font-bold text-white">{vehicles.length}</span> of <span className="font-bold text-white">{totalRecords}</span> vehicles
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-xs font-bold text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-slate-400 px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900 text-xs font-bold text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* 5. Mobile & Tablet Cards Feed (Matching Mobile App Vehicle Cards 1:1) */}
      <div className="block lg:hidden space-y-4 select-none pb-12">
        {loading ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center text-slate-400 font-bold animate-pulse">
            Loading stock inventory...
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center text-slate-400 font-bold">
            No matching vehicles inside yard
          </div>
        ) : (
          vehicles.map((v) => {
            const days = getDurationDays(v.entryDate);
            const rate = getDailyRate(v.vehicleType);
            const totalCharges = v.yardStatus === 'KACHHA' ? 0 : days * rate;
            const frontPhoto = v.photos?.find((p: any) => p.photoType === 'front' || p.photoType === 'front_view')?.s3Url || v.photos?.[0]?.s3Url || defaultPhoto;

            return (
              <div
                key={v.id}
                onClick={() => openDetails(v)}
                className="bg-slate-900 rounded-2xl border border-slate-800 p-4 shadow-md active:scale-[0.98] hover:border-slate-700 transition-all duration-200 text-left space-y-3.5 relative group cursor-pointer"
              >
                {/* Header row: License Plate & Status Pill */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shrink-0">
                      <img src={frontPhoto} alt={v.vehicleNumber} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <div className="border border-slate-700 bg-slate-950 px-2 py-0.5 rounded-lg text-xs font-black tracking-widest text-white uppercase font-mono">
                        {v.vehicleNumber}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {v.brand || 'Unknown'} {v.model || ''}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full font-extrabold text-[9px] uppercase tracking-wider ${
                      v.yardStatus === 'KACHHA'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : v.yardStatus === 'PAKKA'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                    }`}
                  >
                    {v.yardStatus === 'KACHHA' ? 'Kachha' : v.yardStatus === 'PAKKA' ? 'In Yard' : v.yardStatus}
                  </span>
                </div>

                {/* Info parameters */}
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800/80 pt-3">
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Financer Bank</span>
                    <span className="font-bold text-slate-200 mt-0.5 block truncate">{v.bankName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block">Yard Slot</span>
                    <span className="font-bold text-indigo-400 mt-0.5 block font-mono">
                      {v.yardLocation ? `${v.yardLocation.slot} (Z-${v.yardLocation.zone})` : 'Unallocated'}
                    </span>
                  </div>
                </div>

                {/* Dynamic Accrued Charges Banner */}
                <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    {days} Days Stay
                  </span>
                  <span className="font-black text-indigo-400 font-mono text-sm">
                    {"\u20B9"}{totalCharges.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Chevron icon right arrow */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-950 group-hover:bg-indigo-600 p-1.5 rounded-full border border-slate-800 transition-all flex items-center justify-center">
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                </div>
              </div>
            );
          })
        )}

        {/* Mobile Pagination Control */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex items-center justify-between select-none">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Page <span className="text-white font-extrabold">{page}</span> of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold text-slate-300 disabled:opacity-40 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-950 text-xs font-bold text-slate-300 disabled:opacity-40 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Full-Screen Vehicle Details Drawer */}
      {drawerOpen && selectedVehicle && (
        <VehicleDetailsDrawer
          vehicle={selectedVehicle}
          onClose={() => {
            setDrawerOpen(false);
            fetchVehicles();
          }}
          onRefreshList={fetchVehicles}
        />
      )}
    </div>
  );
};
