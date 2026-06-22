import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  Search,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';
import { VehicleDetailsDrawer } from './VehicleDetailsDrawer';

export const VehicleList: React.FC = () => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


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
  const [statusFilter, setStatusFilter] = useState('');

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
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, statusFilter]);

  const fetchVehicles = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter) params.vehicleType = typeFilter;
      if (statusFilter) params.yardStatus = statusFilter;

      const res = await api.get('/vehicles', { params });
      if (res.data?.success) {
        const fetchedVehicles = res.data.data || [];
        setVehicles(fetchedVehicles);
        setTotalPages(res.data.totalPages || 1);
        setTotalRecords(res.data.total || 0);

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
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [debouncedSearch, typeFilter, statusFilter, page]);

  const openDetails = (vehicle: any) => {
    setSelectedVehicle(vehicle);
    setDrawerOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-50 space-y-6 md:space-y-8 flex-1 overflow-y-auto relative">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Active Yard Stock Console</h2>
          <p className="text-sm text-slate-500 font-medium">Search vehicle slots, track status workflows, manage dynamic billing and approvals</p>
        </div>
      </div>

      {/* Filters & Search Console */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:max-w-md select-none">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Vehicle / Chassis No / Repo Agent..."
            className="w-full text-slate-800 pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto select-none">
          <div className="flex items-center space-x-1.5 bg-slate-100/50 px-3 py-1.5 rounded-xl border border-slate-200/50">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Filters</span>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">All Categories</option>
            <option value="TW">2-Wheeler (TW)</option>
            <option value="THREE_W">3-Wheeler (THREE_W)</option>
            <option value="FW">4-Wheeler (FW)</option>
            <option value="CV">Commercial Vehicle (CV)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="">All Yard Statuses</option>
            <option value="KACHHA">Kachha Entry</option>
            <option value="PAKKA">Pakka Entry</option>
            <option value="RELEASED">Released/Gate Out</option>
          </select>
        </div>
      </div>

      {/* Desktop Stock Table */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden select-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                <th className="p-4 font-semibold">Vehicle Number</th>
                <th className="p-4 font-semibold">Brand / Model</th>
                <th className="p-4 font-semibold">Bank / Repo Partner</th>
                <th className="p-4 font-semibold">Entry Date</th>
                <th className="p-4 font-semibold">Yard Status</th>
                <th className="p-4 font-semibold">Yard Location slot</th>
                <th className="p-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold">Loading stock files...</td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-semibold">No matching vehicles inside yard</td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => openDetails(v)}
                    className="hover:bg-slate-50/60 cursor-pointer transition-colors group"
                  >
                    <td className="p-4 font-bold text-slate-800 uppercase tracking-tight">{v.vehicleNumber}</td>
                    <td className="p-4">{v.brand || 'N/A'} {v.model || ''}</td>
                    <td className="p-4">
                      <div>{v.bankName}</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">{v.repoAgency || 'Swift Agency'}</div>
                    </td>
                    <td className="p-4">{new Date(v.entryDate).toLocaleDateString('en-IN')}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[9px] ${
                          v.yardStatus === 'KACHHA'
                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                            : v.yardStatus === 'PAKKA'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {v.yardStatus}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {v.yardLocation?.slot || 'Unallocated'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 flex items-center justify-between select-none">
          <div className="text-xs font-semibold text-slate-500">
            Showing <span className="font-bold text-slate-800">{vehicles.length}</span> of <span className="font-bold text-slate-800">{totalRecords}</span> vehicles
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-slate-500">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Premium Mobile Cards Feed */}
      <div className="block md:hidden space-y-4 select-none pb-8">
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-extrabold shadow-sm animate-pulse">
            Analyzing active yard telemetry...
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-extrabold shadow-sm">
            No matching vehicles inside yard
          </div>
        ) : (
          vehicles.map((v) => (
            <div
              key={v.id}
              onClick={() => openDetails(v)}
              className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm active:scale-[0.98] hover:shadow-md transition-all duration-200 text-left space-y-4 relative group"
            >
              {/* Top row: License Plate Tag + Status Badge */}
              <div className="flex items-center justify-between">
                {/* License Plate Style */}
                <div className="border border-slate-300 bg-slate-50 px-2.5 py-0.5 rounded-lg text-xs font-black tracking-widest text-slate-800 uppercase shadow-sm font-mono flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping"></span>
                  <span>{v.vehicleNumber}</span>
                </div>
                
                {/* Status Badge */}
                <span
                  className={`px-3 py-0.5 rounded-full font-extrabold text-[9px] uppercase tracking-wider ${
                    v.yardStatus === 'KACHHA'
                      ? 'bg-amber-100 text-amber-700 border border-amber-200'
                      : v.yardStatus === 'PAKKA'
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {v.yardStatus}
                </span>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs border-t border-slate-100 pt-3.5">
                <div>
                  <span className="text-[9px] font-bold text-slate-455 uppercase tracking-wide block">Brand / Model</span>
                  <span className="font-extrabold text-slate-700 mt-0.5 block truncate">
                    {v.brand || 'N/A'} {v.model || ''}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-455 uppercase tracking-wide block">Location Slot</span>
                  <span className="font-extrabold text-slate-700 mt-0.5 block">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[9px] font-mono border border-slate-250 font-bold">
                      {v.yardLocation?.slot || 'Unallocated'}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-455 uppercase tracking-wide block">Partner / Agency</span>
                  <span className="font-extrabold text-slate-700 mt-0.5 block truncate">
                    {v.bankName}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-455 uppercase tracking-wide block">Entry Date</span>
                  <span className="font-extrabold text-slate-700 mt-0.5 block">
                    {new Date(v.entryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Dynamic Billing Estimate banner */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-450 text-[10px] font-bold uppercase tracking-wider">Dynamic Accrued Charge</span>
                <span className="font-extrabold text-indigo-650 font-mono text-sm">
                  {"\u20B9"}{((v.parkingRates?.dailyRate || 150) * Math.max(1, Math.ceil((new Date().getTime() - new Date(v.entryDate).getTime()) / (1000 * 60 * 60 * 24)))).toLocaleString('en-IN')}
                </span>
              </div>

              {/* Chevron icon right center */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-50 group-hover:bg-indigo-50 p-1.5 rounded-full border border-slate-200 shadow-sm transition-all duration-200 flex items-center justify-center">
                <ChevronRight className="w-3.5 h-3.5 text-slate-450 group-hover:text-indigo-600" />
              </div>
            </div>
          ))
        )}

        {/* Mobile Pagination Control */}
        <div className="bg-white rounded-3xl border border-slate-200 p-4 flex items-center justify-between">
          <div className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
            Page <span className="text-slate-800 font-extrabold">{page}</span> of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-650 disabled:opacity-50 active:scale-95 transition-all shadow-sm"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-655 disabled:opacity-50 active:scale-95 transition-all shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      </div>
                     {/* Full-Screen Vehicle Details Drawer (Eco & User-Friendly Workspace) */}
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
