import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import {
  Save,
  Building2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Coins,
  Settings2,
  X,
  PlusCircle,
  HelpCircle,
  Layers,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

interface Bank {
  id: string;
  name: string;
  isThirdParty: boolean;
  parentId: string | null;
  parent?: {
    id: string;
    name: string;
  };
  parkingRates?: ParkingRate[];
}

interface ParkingRate {
  id?: string;
  bankId: string;
  vehicleType: 'TW' | 'THREE_W' | 'FW' | 'CV';
  dailyRate: number;
}

interface PendingSubBank {
  name: string;
  rates: {
    TW: number | '';
    THREE_W: number | '';
    FW: number | '';
    CV: number | '';
  };
}

export const RateMaster: React.FC = () => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [rates, setRates] = useState<ParkingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Accordion control for main banks/third parties
  const [expandedBanks, setExpandedBanks] = useState<Record<string, boolean>>({});

  // --- NEW WORKFLOW STATES: POPUP CREATION MODAL ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [partnerType, setPartnerType] = useState<'direct' | 'third_party' | null>(null);

  // Direct Bank Form States (Prefilled with empty strings)
  const [directName, setDirectName] = useState('');
  const [directRates, setDirectRates] = useState<Record<'TW' | 'THREE_W' | 'FW' | 'CV', number | ''>>({
    TW: '',
    THREE_W: '',
    FW: '',
    CV: '',
  });

  // Third Party Form States (Prefilled with empty strings)
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [subBanksList, setSubBanksList] = useState<PendingSubBank[]>([
    {
      name: '',
      rates: { TW: '', THREE_W: '', FW: '', CV: '' }
    }
  ]);

  // Edit Tariff Modal State
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [editingRates, setEditingRates] = useState<Record<'TW' | 'THREE_W' | 'FW' | 'CV', number | ''>>({
    TW: '',
    THREE_W: '',
    FW: '',
    CV: '',
  });
  const [savingRates, setSavingRates] = useState(false);

  // --- ADD SUB-BANK TO EXISTING THIRD PARTY STATES ---
  const [isAddSubModalOpen, setIsAddSubModalOpen] = useState(false);
  const [targetThirdParty, setTargetThirdParty] = useState<Bank | null>(null);
  const [newSubName, setNewSubName] = useState('');
  const [newSubRates, setNewSubRates] = useState<Record<'TW' | 'THREE_W' | 'FW' | 'CV', number | ''>>({
    TW: '',
    THREE_W: '',
    FW: '',
    CV: '',
  });
  const [savingNewSub, setSavingNewSub] = useState(false);

  const toast = useToastStore();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [banksRes, ratesRes] = await Promise.all([
        api.get('/banks'),
        api.get('/rates')
      ]);

      if (banksRes.data?.success) {
        setBanks(banksRes.data.data);
      }
      if (ratesRes.data?.success) {
        setRates(ratesRes.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch bank/rate configuration', err);
      toast.error('Failed to load bank and rate settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Modal Open Reset
  const handleOpenCreateModal = () => {
    setPartnerType(null);
    setCreateStep(1);
    setDirectName('');
    setDirectRates({ TW: '', THREE_W: '', FW: '', CV: '' });
    setThirdPartyName('');
    setSubBanksList([{ name: '', rates: { TW: '', THREE_W: '', FW: '', CV: '' } }]);
    setIsCreateModalOpen(true);
  };

  const handleCreateDirectBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directName.trim()) {
      toast.error('Please enter a valid Bank Name');
      return;
    }

    // Strict validation for null / empty rates
    const { TW, THREE_W, FW, CV } = directRates;
    if (TW === '' || THREE_W === '' || FW === '' || CV === '') {
      toast.error('All vehicle daily rates (2W, 3W, 4W, CV) are mandatory! Please input manually.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/banks', {
        name: directName.trim(),
        isThirdParty: false,
        rates: {
          TW: Number(TW),
          THREE_W: Number(THREE_W),
          FW: Number(FW),
          CV: Number(CV),
        }
      });

      if (res.data?.success) {
        toast.success(`Direct Bank "${directName}" successfully registered!`);
        setIsCreateModalOpen(false);
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create direct bank');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateThirdParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thirdPartyName.trim()) {
      toast.error('Please enter a valid Third-Party Partner Name');
      return;
    }

    // Filter out invalid/empty sub banks
    const validSubBanks = subBanksList.filter(sb => sb.name.trim() !== '');
    if (validSubBanks.length === 0) {
      toast.error('Please add at least one Sub-Bank with pricing.');
      return;
    }

    // Check if any rates are empty in the sub-banks
    for (const sb of validSubBanks) {
      const { TW, THREE_W, FW, CV } = sb.rates;
      if (TW === '' || THREE_W === '' || FW === '' || CV === '') {
        toast.error(`Pricing rates for sub-bank "${sb.name}" cannot be empty! Please input manually.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await api.post('/banks', {
        name: thirdPartyName.trim(),
        isThirdParty: true,
        subBanks: validSubBanks.map(sb => ({
          name: sb.name.trim(),
          rates: {
            TW: Number(sb.rates.TW),
            THREE_W: Number(sb.rates.THREE_W),
            FW: Number(sb.rates.FW),
            CV: Number(sb.rates.CV),
          }
        }))
      });

      if (res.data?.success) {
        toast.success(`Third Party Network "${thirdPartyName}" with ${validSubBanks.length} sub-banks successfully registered!`);
        setIsCreateModalOpen(false);
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create third party network');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSubBankRow = () => {
    setSubBanksList([
      ...subBanksList,
      {
        name: '',
        rates: { TW: '', THREE_W: '', FW: '', CV: '' }
      }
    ]);
  };

  const handleRemoveSubBankRow = (index: number) => {
    if (subBanksList.length === 1) {
      toast.error('At least one sub-bank configuration is required.');
      return;
    }
    const updated = [...subBanksList];
    updated.splice(index, 1);
    setSubBanksList(updated);
  };

  const handleSubBankNameChange = (index: number, val: string) => {
    const updated = [...subBanksList];
    updated[index].name = val;
    setSubBanksList(updated);
  };

  const handleSubBankRateChange = (index: number, vehicleType: 'TW' | 'THREE_W' | 'FW' | 'CV', val: string) => {
    const updated = [...subBanksList];
    updated[index].rates[vehicleType] = val === '' ? '' : Number(val);
    setSubBanksList(updated);
  };

  const handleDeleteBank = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?\nAll associated sub-banks and rates configurations will be permanently deleted!`)) {
      return;
    }

    try {
      setLoading(true);
      const res = await api.delete(`/banks/${id}`);
      if (res.data?.success) {
        toast.success(`"${name}" deleted successfully`);
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete bank configuration');
    } finally {
      setLoading(false);
    }
  };

  // Open Edit Tariff modal
  const handleOpenEditModal = (bank: Bank) => {
    setEditingBank(bank);
    const bankRates = rates.filter(r => r.bankId === bank.id);
    const ratesMap = {
      TW: '' as number | '',
      THREE_W: '' as number | '',
      FW: '' as number | '',
      CV: '' as number | ''
    };

    bankRates.forEach(r => {
      if (r.vehicleType in ratesMap) {
        ratesMap[r.vehicleType] = r.dailyRate;
      }
    });

    setEditingRates(ratesMap);
  };

  const handleSaveEditedRates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank) return;

    const { TW, THREE_W, FW, CV } = editingRates;
    if (TW === '' || THREE_W === '' || FW === '' || CV === '') {
      toast.error('All daily rates (2W, 3W, 4W, CV) are required to update.');
      return;
    }

    try {
      setSavingRates(true);
      const types = ['TW', 'THREE_W', 'FW', 'CV'] as const;
      const promises = types.map(type => {
        const dailyRate = editingRates[type];
        return api.post('/rates', {
          bankId: editingBank.id,
          vehicleType: type,
          dailyRate: Number(dailyRate)
        });
      });

      await Promise.all(promises);
      toast.success(`Rates updated successfully for "${editingBank.name}"!`);
      setEditingBank(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update rates');
    } finally {
      setSavingRates(false);
    }
  };

  // --- ADD SUB-BANK TO EXISTING THIRD PARTY NETWORK HANDLERS ---
  const handleOpenAddSubModal = (thirdParty: Bank) => {
    setTargetThirdParty(thirdParty);
    setNewSubName('');
    setNewSubRates({ TW: '', THREE_W: '', FW: '', CV: '' });
    setIsAddSubModalOpen(true);
  };

  const handleAddSubBankToNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetThirdParty) return;
    if (!newSubName.trim()) {
      toast.error('Please enter a valid Sub-Bank Name');
      return;
    }

    const { TW, THREE_W, FW, CV } = newSubRates;
    if (TW === '' || THREE_W === '' || FW === '' || CV === '') {
      toast.error('All daily rates (2W, 3W, 4W, CV) are required! Please input manually.');
      return;
    }

    try {
      setSavingNewSub(true);
      const res = await api.post('/banks', {
        name: newSubName.trim(),
        isThirdParty: false,
        parentId: targetThirdParty.id,
        rates: {
          TW: Number(TW),
          THREE_W: Number(THREE_W),
          FW: Number(FW),
          CV: Number(CV),
        }
      });

      if (res.data?.success) {
        toast.success(`Sub-bank "${newSubName}" successfully added to "${targetThirdParty.name}"!`);
        setIsAddSubModalOpen(false);
        
        // Auto expand parent accordion
        setExpandedBanks(prev => ({ ...prev, [targetThirdParty.id]: true }));
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add sub-bank to network');
    } finally {
      setSavingNewSub(false);
    }
  };

  const toggleExpand = (bankId: string) => {
    setExpandedBanks(prev => ({ ...prev, [bankId]: !prev[bankId] }));
  };

  const getVehicleTypeName = (type: string) => {
    switch (type) {
      case 'TW': return '2W – Two Wheeler';
      case 'THREE_W': return '3W – Auto Rickshaw';
      case 'FW': return '4W – Car/SUV';
      case 'CV': return 'CV – Commercial';
      default: return type;
    }
  };

  // Lists splitting
  const mainDirectBanks = banks.filter(b => !b.parentId && !b.isThirdParty);
  const thirdPartyPartners = banks.filter(b => !b.parentId && b.isThirdParty);
  const getSubBanks = (parentId: string) => banks.filter(b => b.parentId === parentId);

  const getRateValue = (bankId: string, type: 'TW' | 'THREE_W' | 'FW' | 'CV') => {
    const rate = rates.find(r => r.bankId === bankId && r.vehicleType === type);
    return rate ? rate.dailyRate : null;
  };

  // Stats calculation
  const totalDirectCount = mainDirectBanks.length;
  const totalThirdPartyCount = thirdPartyPartners.length;
  const totalSubBanksCount = banks.filter(b => b.parentId !== null).length;

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-50/50 space-y-6 md:space-y-8 flex-1 overflow-y-auto font-sans select-none max-w-7xl mx-auto w-full">
      
      {/* Premium Header with Create Bank Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 border-b border-slate-100 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-indigo-600 animate-pulse" />
            <span>Bank & Parking Rate Management</span>
          </h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Establish custom financial channels. Define direct banking partnerships or set up third-party networks with multi-nested sub-banks.
          </p>
        </div>

        {/* Create Bank Action Trigger */}
        <button
          onClick={handleOpenCreateModal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-indigo-600/10 flex items-center gap-2 active:scale-95 transition-all text-sm self-start md:self-auto"
        >
          <Plus className="w-5 h-5" />
          <span>Create Bank / Partner</span>
        </button>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Direct Finance Card */}
        <div className="relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-300">
          <div className="space-y-1.5 z-10">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Direct Finance Banks</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{totalDirectCount}</span>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Active</span>
            </div>
          </div>
          <div className="p-4 bg-indigo-50 group-hover:bg-indigo-100/80 rounded-2xl transition-colors duration-300 z-10">
            <Building2 className="w-7 h-7 text-indigo-600" />
          </div>
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-indigo-100/30 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-500"></div>
        </div>

        {/* Third Party Networks Card */}
        <div className="relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-300">
          <div className="space-y-1.5 z-10">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Third-Party Channels</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{totalThirdPartyCount}</span>
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Networks</span>
            </div>
          </div>
          <div className="p-4 bg-amber-50 group-hover:bg-amber-100/80 rounded-2xl transition-colors duration-300 z-10">
            <Layers className="w-7 h-7 text-amber-600" />
          </div>
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-amber-100/30 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-500"></div>
        </div>

        {/* Total Rates Configured Card */}
        <div className="relative overflow-hidden bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-300">
          <div className="space-y-1.5 z-10">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Sub-Banks Managed</span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-800 tracking-tight">{totalSubBanksCount}</span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Nested</span>
            </div>
          </div>
          <div className="p-4 bg-emerald-50 group-hover:bg-emerald-100/80 rounded-2xl transition-colors duration-300 z-10">
            <Coins className="w-7 h-7 text-emerald-600" />
          </div>
          <div className="absolute right-0 bottom-0 w-32 h-32 bg-emerald-100/30 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-500"></div>
        </div>
      </div>

      {/* Main Full-Width Configurations List */}
      <div className="space-y-6 select-none">
        
        {loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400 font-bold shadow-sm select-none animate-pulse">
            Syncing live finance channels registry...
          </div>
        ) : banks.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center text-slate-400 font-bold shadow-sm select-none">
            No financial networks registered. Click the **"Create Bank / Partner"** button above to get started.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs select-none">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-450 font-extrabold uppercase tracking-widest text-[9px]">
                      <th className="p-3.5 pl-6 w-[30%]">Bank Name / Partner</th>
                      <th className="p-3.5 w-[15%]">Type</th>
                      <th className="p-3.5 text-center w-[10%]">2W Rate</th>
                      <th className="p-3.5 text-center w-[10%]">3W Rate</th>
                      <th className="p-3.5 text-center w-[10%]">4W Rate</th>
                      <th className="p-3.5 text-center w-[10%]">CV Rate</th>
                      <th className="p-3.5 text-right pr-6 w-[15%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-650 font-semibold">
                    
                    {/* DIRECT BANKS ROWS */}
                    {mainDirectBanks.map(directBank => (
                      <tr key={directBank.id} className="hover:bg-slate-50/40 transition-colors duration-200 group">
                        <td className="p-3.5 pl-6 font-extrabold text-slate-800 text-xs">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-indigo-500" />
                            <span className="tracking-tight">{directBank.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="bg-indigo-50 text-indigo-600 font-extrabold uppercase tracking-widest text-[8px] px-2 py-0.5 rounded">
                            Direct Bank
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-extrabold text-indigo-650 text-xs">
                          {getRateValue(directBank.id, 'TW') !== null ? `\u20B9${getRateValue(directBank.id, 'TW')}` : '—'}
                        </td>
                        <td className="p-3.5 text-center font-extrabold text-indigo-650 text-xs">
                          {getRateValue(directBank.id, 'THREE_W') !== null ? `\u20B9${getRateValue(directBank.id, 'THREE_W')}` : '—'}
                        </td>
                        <td className="p-3.5 text-center font-extrabold text-indigo-650 text-xs">
                          {getRateValue(directBank.id, 'FW') !== null ? `\u20B9${getRateValue(directBank.id, 'FW')}` : '—'}
                        </td>
                        <td className="p-3.5 text-center font-extrabold text-indigo-650 text-xs">
                          {getRateValue(directBank.id, 'CV') !== null ? `\u20B9${getRateValue(directBank.id, 'CV')}` : '—'}
                        </td>
                        <td className="p-3.5 text-right pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditModal(directBank)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition-colors"
                              title="Configure Rates"
                            >
                              <Settings2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBank(directBank.id, directBank.name)}
                              className="p-1 hover:bg-rose-50 rounded text-slate-500 hover:text-rose-600 transition-colors"
                              title="Delete Bank"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* THIRD PARTY NETWORKS ROWS */}
                    {thirdPartyPartners.map(thirdParty => {
                      const subs = getSubBanks(thirdParty.id);
                      const isExpanded = expandedBanks[thirdParty.id];
                      
                      return (
                        <React.Fragment key={thirdParty.id}>
                          {/* Parent Row */}
                          <tr
                            onClick={() => toggleExpand(thirdParty.id)}
                            className="hover:bg-slate-50/40 transition-colors duration-200 cursor-pointer bg-slate-50/20"
                          >
                            <td className="p-3.5 pl-6 font-extrabold text-slate-800 text-xs">
                              <div className="flex items-center gap-2">
                                <div className="text-slate-400 group-hover:text-slate-600 transition-colors shrink-0">
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </div>
                                <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                                <span className="tracking-tight">{thirdParty.name}</span>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className="bg-amber-50 text-amber-600 font-extrabold uppercase tracking-widest text-[8px] px-2 py-0.5 rounded">
                                Third Party
                              </span>
                            </td>
                            <td colSpan={4} className="p-3.5 text-slate-455 text-[10px] font-bold italic tracking-wide">
                              {subs.length > 0 
                                ? `${subs.length} active sub-banks registered under channel (click row to expand)` 
                                : 'No sub-banks registered under this network'}
                            </td>
                            <td className="p-3.5 text-right pr-6" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleOpenAddSubModal(thirdParty)}
                                  className="p-1 hover:bg-slate-150 rounded text-slate-500 hover:text-amber-600 transition-colors"
                                  title="Add Sub-Bank to Network"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteBank(thirdParty.id, thirdParty.name)}
                                  className="p-1 hover:bg-rose-50 rounded text-slate-500 hover:text-rose-600 transition-colors"
                                  title="Delete Network"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Nested Sub Banks Rows */}
                          {isExpanded && subs.map(subBank => (
                            <tr key={subBank.id} className="bg-slate-50/5 border-l-4 border-amber-400 hover:bg-slate-50/25 transition-colors duration-150">
                              <td className="p-3 pl-12 font-bold text-slate-700 text-xs tracking-tight">
                                <span>{subBank.name}</span>
                              </td>
                              <td className="p-3">
                                <span className="bg-emerald-50 text-emerald-600 font-extrabold uppercase tracking-widest text-[7px] px-1.5 py-0.5 rounded">
                                  Sub-bank
                                </span>
                              </td>
                              <td className="p-3 text-center font-bold text-emerald-600 text-xs">
                                {getRateValue(subBank.id, 'TW') !== null ? `\u20B9${getRateValue(subBank.id, 'TW')}` : '—'}
                              </td>
                              <td className="p-3 text-center font-bold text-emerald-600 text-xs">
                                {getRateValue(subBank.id, 'THREE_W') !== null ? `\u20B9${getRateValue(subBank.id, 'THREE_W')}` : '—'}
                              </td>
                              <td className="p-3 text-center font-bold text-emerald-600 text-xs">
                                {getRateValue(subBank.id, 'FW') !== null ? `\u20B9${getRateValue(subBank.id, 'FW')}` : '—'}
                              </td>
                              <td className="p-3 text-center font-bold text-emerald-600 text-xs">
                                {getRateValue(subBank.id, 'CV') !== null ? `\u20B9${getRateValue(subBank.id, 'CV')}` : '—'}
                              </td>
                              <td className="p-3 text-right pr-6">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleOpenEditModal(subBank)}
                                    className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-emerald-600 transition-colors"
                                    title="Configure Rates"
                                  >
                                    <Settings2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBank(subBank.id, subBank.name)}
                                    className="p-1 hover:bg-rose-50 rounded text-slate-500 hover:text-rose-600 transition-colors"
                                    title="Delete Sub Bank"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}

                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Premium Cards View */}
            <div className="block md:hidden space-y-4 pb-12">
              {/* Direct Banks Grid Section */}
              {mainDirectBanks.length > 0 && (
                <div className="space-y-3.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block pl-1">
                    Direct Banking Channels
                  </span>
                  
                  {mainDirectBanks.map(directBank => (
                    <div
                      key={directBank.id}
                      className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 text-left relative"
                    >
                      {/* Title Header */}
                      <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-100 bg-slate-50 text-indigo-600 rounded-xl border border-slate-100">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <span className="font-extrabold text-slate-800 text-sm">{directBank.name}</span>
                        </div>
                        <span className="bg-indigo-50 text-indigo-600 font-extrabold uppercase tracking-widest text-[8px] px-2 py-0.5 rounded">
                          Direct
                        </span>
                      </div>

                      {/* Pricing 2x2 Grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 text-center">
                          <span className="text-[9px] font-bold text-slate-455 uppercase tracking-wide block">2W Rate</span>
                          <span className="font-black text-indigo-650 mt-1 block">
                            {getRateValue(directBank.id, 'TW') !== null ? `\u20B9${getRateValue(directBank.id, 'TW')}` : '—'}
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 text-center">
                          <span className="text-[9px] font-bold text-slate-455 uppercase tracking-wide block">3W Rate</span>
                          <span className="font-black text-indigo-650 mt-1 block">
                            {getRateValue(directBank.id, 'THREE_W') !== null ? `\u20B9${getRateValue(directBank.id, 'THREE_W')}` : '—'}
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 text-center">
                          <span className="text-[9px] font-bold text-slate-455 uppercase tracking-wide block">4W Rate</span>
                          <span className="font-black text-indigo-650 mt-1 block">
                            {getRateValue(directBank.id, 'FW') !== null ? `\u20B9${getRateValue(directBank.id, 'FW')}` : '—'}
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 text-center">
                          <span className="text-[9px] font-bold text-slate-455 uppercase tracking-wide block">CV Rate</span>
                          <span className="font-black text-indigo-650 mt-1 block">
                            {getRateValue(directBank.id, 'CV') !== null ? `\u20B9${getRateValue(directBank.id, 'CV')}` : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Actions Footer Panel */}
                      <div className="flex items-center justify-end gap-2 border-t border-slate-50 pt-3">
                        <button
                          onClick={() => handleOpenEditModal(directBank)}
                          className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                          <span>Tariff Settings</span>
                        </button>
                        <button
                          onClick={() => handleDeleteBank(directBank.id, directBank.name)}
                          className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-2 rounded-xl active:scale-95 transition-all border border-rose-105"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Third Party Agencies Section */}
              {thirdPartyPartners.length > 0 && (
                <div className="space-y-3.5 pt-2">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block pl-1">
                    Third-Party Partners / Networks
                  </span>

                  {thirdPartyPartners.map(thirdParty => {
                    const subs = getSubBanks(thirdParty.id);
                    const isExpanded = expandedBanks[thirdParty.id];

                    return (
                      <div
                        key={thirdParty.id}
                        className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4 text-left relative"
                      >
                        {/* Title Header */}
                        <div
                          onClick={() => toggleExpand(thirdParty.id)}
                          className="flex items-center justify-between border-b border-slate-50 pb-3 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-xl">
                              <Layers className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-800 text-sm block">{thirdParty.name}</span>
                              <span className="text-[8px] font-bold text-slate-400 block mt-0.5">
                                {subs.length} active nested sub-channels
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-50 text-amber-600 font-extrabold uppercase tracking-widest text-[8px] px-2 py-0.5 rounded">
                              Third Party
                            </span>
                            <div className="text-slate-400">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expandable nested scroll layout */}
                        {isExpanded && (
                          <div className="space-y-4 pt-1">
                            {subs.length === 0 ? (
                              <p className="text-[10px] text-slate-400 italic text-center font-bold">
                                No sub-banks registered under network.
                              </p>
                            ) : (
                              subs.map(subBank => (
                                <div
                                  key={subBank.id}
                                  className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3 text-left relative"
                                >
                                  {/* Sub-bank header */}
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <span className="font-extrabold text-slate-700 text-xs">{subBank.name}</span>
                                    <span className="bg-emerald-50 text-emerald-600 font-extrabold uppercase tracking-widest text-[7px] px-1.5 py-0.5 rounded">
                                      Sub-bank
                                    </span>
                                  </div>

                                  {/* Sub pricing grid */}
                                  <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                                    <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                                      <span className="text-slate-400 font-bold block mb-0.5">2W</span>
                                      <span className="font-extrabold text-emerald-600">
                                        {getRateValue(subBank.id, 'TW') !== null ? `\u20B9${getRateValue(subBank.id, 'TW')}` : '—'}
                                      </span>
                                    </div>
                                    <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                                      <span className="text-slate-400 font-bold block mb-0.5">3W</span>
                                      <span className="font-extrabold text-emerald-600">
                                        {getRateValue(subBank.id, 'THREE_W') !== null ? `\u20B9${getRateValue(subBank.id, 'THREE_W')}` : '—'}
                                      </span>
                                    </div>
                                    <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                                      <span className="text-slate-400 font-bold block mb-0.5">4W</span>
                                      <span className="font-extrabold text-emerald-600">
                                        {getRateValue(subBank.id, 'FW') !== null ? `\u20B9${getRateValue(subBank.id, 'FW')}` : '—'}
                                      </span>
                                    </div>
                                    <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                                      <span className="text-slate-400 font-bold block mb-0.5">CV</span>
                                      <span className="font-extrabold text-emerald-600">
                                        {getRateValue(subBank.id, 'CV') !== null ? `\u20B9${getRateValue(subBank.id, 'CV')}` : '—'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Actions Row */}
                                  <div className="flex items-center justify-end gap-1.5 pt-1">
                                    <button
                                      onClick={() => handleOpenEditModal(subBank)}
                                      className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-650 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                                    >
                                      <Settings2 className="w-3 h-3" />
                                      <span>Edit Tariff</span>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteBank(subBank.id, subBank.name)}
                                      className="bg-white hover:bg-rose-50 p-1.5 border border-slate-200 text-rose-500 rounded-lg active:scale-95 transition-all"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        {/* Central Partner action button row */}
                        <div className="flex items-center justify-end gap-2 border-t border-slate-50 pt-3" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenAddSubModal(thirdParty)}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Sub-Bank</span>
                          </button>
                          <button
                            onClick={() => handleDeleteBank(thirdParty.id, thirdParty.name)}
                            className="bg-rose-50 text-rose-600 hover:bg-rose-100 p-2 rounded-xl active:scale-95 transition-all border border-rose-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- NEW STEP-BY-STEP POPUP CREATION MODAL --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden relative">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {/* STEP 1: OPERATIONAL MODE SELECTION */}
            {createStep === 1 && (
              <div className="p-8 space-y-6">
                <div className="text-center space-y-1 pb-2">
                  <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest block">Step 1 of 2</span>
                  <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">Register New Financial Partner</h3>
                  <p className="text-sm text-slate-400 font-semibold">Select the type of financing channel you are establishing.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Option A: Direct Bank */}
                  <button
                    type="button"
                    onClick={() => {
                      setPartnerType('direct');
                      setCreateStep(2);
                    }}
                    className="p-6 rounded-3xl border-2 border-slate-150 hover:border-indigo-600 bg-white text-left transition-all duration-300 group hover:shadow-xl hover:shadow-indigo-600/5 space-y-4"
                  >
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl w-fit group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                      <Building2 className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-800 text-lg flex items-center gap-1.5">
                        <span>Direct Bank</span>
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-0 group-hover:translate-x-1 duration-300" />
                      </h4>
                      <p className="text-xs text-slate-455 font-medium leading-relaxed">
                        Create a single bank system (e.g. State Bank of India) with dedicated daily rates defined directly.
                      </p>
                    </div>
                  </button>

                  {/* Option B: Third-Party Partner */}
                  <button
                    type="button"
                    onClick={() => {
                      setPartnerType('third_party');
                      setCreateStep(2);
                    }}
                    className="p-6 rounded-3xl border-2 border-slate-150 hover:border-amber-600 bg-white text-left transition-all duration-300 group hover:shadow-xl hover:shadow-amber-600/5 space-y-4"
                  >
                    <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl w-fit group-hover:bg-amber-600 group-hover:text-white transition-all duration-300">
                      <Layers className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-800 text-lg flex items-center gap-1.5">
                        <span>Third-Party Network</span>
                        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-0 group-hover:translate-x-1 duration-300" />
                      </h4>
                      <p className="text-xs text-slate-455 font-medium leading-relaxed">
                        Create a central grouping channel (e.g. Samil Repo) that manages multiple sub-banks with custom pricing scales.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: CONFIGURATION & TARIFFS */}
            {createStep === 2 && partnerType === 'direct' && (
              <form onSubmit={handleCreateDirectBank} className="p-8 space-y-6">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest block">Step 2 of 2</span>
                    <h3 className="text-xl font-extrabold text-slate-800 tracking-tight mt-1">Configure Direct Bank</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateStep(1)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Bank Naming *</label>
                    <input
                      type="text"
                      required
                      value={directName}
                      onChange={(e) => setDirectName(e.target.value)}
                      placeholder="e.g. State Bank of India"
                      className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-colors shadow-sm"
                    />
                  </div>

                  {/* Pricing Fields Grid (Prefilled with empty string/null) */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3.5 text-left">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-1 gap-2">
                      <span className="text-[10px] font-extrabold text-slate-455 uppercase tracking-widest">Enter Daily Rates (\u20B9 Per Day)</span>
                      <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-fit">Manual Input Req.</span>
                    </div>

                    {/* 2W */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                      <label className="text-xs font-bold text-slate-650">2W – Two Wheeler *</label>
                      <div className="relative w-full sm:w-36 shrink-0">
                        <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-bold">{"\u20B9"}</span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={directRates.TW}
                          onChange={(e) => setDirectRates({ ...directRates, TW: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="e.g. 100"
                          className="w-full text-right text-slate-800 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-indigo-650 bg-white"
                        />
                      </div>
                    </div>

                    {/* 3W */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                      <label className="text-xs font-bold text-slate-650">3W – Auto/Cargo *</label>
                      <div className="relative w-full sm:w-36 shrink-0">
                        <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-bold">{"\u20B9"}</span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={directRates.THREE_W}
                          onChange={(e) => setDirectRates({ ...directRates, THREE_W: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="e.g. 150"
                          className="w-full text-right text-slate-800 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-indigo-650 bg-white"
                        />
                      </div>
                    </div>

                    {/* 4W */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                      <label className="text-xs font-bold text-slate-650">4W – Sedan/SUV *</label>
                      <div className="relative w-full sm:w-36 shrink-0">
                        <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-bold">{"\u20B9"}</span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={directRates.FW}
                          onChange={(e) => setDirectRates({ ...directRates, FW: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="e.g. 250"
                          className="w-full text-right text-slate-800 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-indigo-650 bg-white"
                        />
                      </div>
                    </div>

                    {/* CV */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                      <label className="text-xs font-bold text-slate-650">CV – Commercial *</label>
                      <div className="relative w-full sm:w-36 shrink-0">
                        <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-bold">{"\u20B9"}</span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={directRates.CV}
                          onChange={(e) => setDirectRates({ ...directRates, CV: e.target.value === '' ? '' : Number(e.target.value) })}
                          placeholder="e.g. 400"
                          className="w-full text-right text-slate-800 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-indigo-650 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-2xl text-xs transition-colors active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-indigo-600/10 active:scale-95 disabled:opacity-50"
                  >
                    <PlusCircle className="w-4.5 h-4.5" />
                    <span>{submitting ? 'Registering...' : 'Register Direct Bank'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: CONFIGURATION & TARIFFS - THIRD PARTY */}
            {createStep === 2 && partnerType === 'third_party' && (
              <form onSubmit={handleCreateThirdParty} className="p-8 space-y-5">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest block">Step 2 of 2</span>
                    <h3 className="text-xl font-extrabold text-slate-800 tracking-tight mt-1">Configure Third-Party Network</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateStep(1)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Third-Party Network Name *</label>
                    <input
                      type="text"
                      required
                      value={thirdPartyName}
                      onChange={(e) => setThirdPartyName(e.target.value)}
                      placeholder="e.g. Samil Repo Agency"
                      className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-600/10 focus:border-amber-600 transition-colors shadow-sm"
                    />
                  </div>

                  {/* Sub Banks Configs */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold text-slate-455 uppercase tracking-widest">Sub-Banks & Tariffs List ({subBanksList.length}) *</span>
                      <button
                        type="button"
                        onClick={handleAddSubBankRow}
                        className="text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Sub-Bank</span>
                      </button>
                    </div>

                    <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
                      {subBanksList.map((subBank, idx) => (
                        <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 relative space-y-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveSubBankRow(idx)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-rose-500 transition-colors"
                            title="Remove Sub-bank"
                          >
                            <X className="w-4 h-4" />
                          </button>

                          <div className="space-y-1.5 pr-6">
                            <label className="text-[9px] font-bold text-slate-455 uppercase tracking-wider block">Sub-Bank Naming *</label>
                            <input
                              type="text"
                              required
                              value={subBank.name}
                              onChange={(e) => handleSubBankNameChange(idx, e.target.value)}
                              placeholder="e.g. HDFC Bank"
                              className="w-full text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold focus:outline-none focus:border-amber-600 bg-white"
                            />
                          </div>

                          {/* Sub rates */}
                          <div className="grid grid-cols-4 gap-2 text-[10px]">
                            <div>
                              <label className="text-slate-400 font-bold block mb-1">2W (\u25C4) *</label>
                              <input
                                type="number"
                                min="0"
                                required
                                value={subBank.rates.TW}
                                onChange={(e) => handleSubBankRateChange(idx, 'TW', e.target.value)}
                                className="w-full text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 font-extrabold focus:outline-none bg-white text-right"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 font-bold block mb-1">3W (\u25C4) *</label>
                              <input
                                type="number"
                                min="0"
                                required
                                value={subBank.rates.THREE_W}
                                onChange={(e) => handleSubBankRateChange(idx, 'THREE_W', e.target.value)}
                                className="w-full text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 font-extrabold focus:outline-none bg-white text-right"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 font-bold block mb-1">4W (\u25C4) *</label>
                              <input
                                type="number"
                                min="0"
                                required
                                value={subBank.rates.FW}
                                onChange={(e) => handleSubBankRateChange(idx, 'FW', e.target.value)}
                                className="w-full text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 font-extrabold focus:outline-none bg-white text-right"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 font-bold block mb-1">CV (\u25C4) *</label>
                              <input
                                type="number"
                                min="0"
                                required
                                value={subBank.rates.CV}
                                onChange={(e) => handleSubBankRateChange(idx, 'CV', e.target.value)}
                                className="w-full text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 font-extrabold focus:outline-none bg-white text-right"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-2xl text-xs transition-colors active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-amber-600/10 active:scale-95 disabled:opacity-50"
                  >
                    <PlusCircle className="w-4.5 h-4.5" />
                    <span>{submitting ? 'Publishing...' : 'Publish Partner Network'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ADD SUB-BANK TO NETWORK MODAL OVERLAY */}
      {isAddSubModalOpen && targetThirdParty && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden relative">
            <button
              onClick={() => setIsAddSubModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <form onSubmit={handleAddSubBankToNetwork} className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3 pr-6">
                <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest block">Add Sub-Bank Channel</span>
                <h4 className="text-lg font-extrabold text-slate-800 tracking-tight mt-1">{targetThirdParty.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Configure daily pricing rates for the new nested sub-bank</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Sub-Bank Naming *</label>
                  <input
                    type="text"
                    required
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    className="w-full text-slate-800 px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-600/10 focus:border-amber-600 transition-colors shadow-sm bg-white"
                  />
                </div>

                {/* Sub-bank Rates Setup */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-extrabold text-slate-455 uppercase tracking-widest">Daily Rates (\u20B9 Per Day)</span>
                    <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Required</span>
                  </div>

                  {/* TW */}
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-bold text-slate-650">2W – Two Wheeler *</label>
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-bold">{"\u20B9"}</span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newSubRates.TW}
                        onChange={(e) => setNewSubRates({ ...newSubRates, TW: e.target.value === '' ? '' : Number(e.target.value) })}
                        placeholder="e.g. 100"
                        className="w-full text-right text-slate-800 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-amber-600 bg-white"
                      />
                    </div>
                  </div>

                  {/* THREE_W */}
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-bold text-slate-655">3W – Auto/Cargo *</label>
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-bold">{"\u20B9"}</span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newSubRates.THREE_W}
                        onChange={(e) => setNewSubRates({ ...newSubRates, THREE_W: e.target.value === '' ? '' : Number(e.target.value) })}
                        placeholder="e.g. 150"
                        className="w-full text-right text-slate-850 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-amber-600 bg-white"
                      />
                    </div>
                  </div>

                  {/* FW */}
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-bold text-slate-655">4W – Sedan/SUV *</label>
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-bold">{"\u20B9"}</span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newSubRates.FW}
                        onChange={(e) => setNewSubRates({ ...newSubRates, FW: e.target.value === '' ? '' : Number(e.target.value) })}
                        placeholder="e.g. 250"
                        className="w-full text-right text-slate-850 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-amber-600 bg-white"
                      />
                    </div>
                  </div>

                  {/* CV */}
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-xs font-bold text-slate-655">CV – Commercial *</label>
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-3.5 top-2 text-slate-400 text-xs font-bold">{"\u20B9"}</span>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newSubRates.CV}
                        onChange={(e) => setNewSubRates({ ...newSubRates, CV: e.target.value === '' ? '' : Number(e.target.value) })}
                        placeholder="e.g. 400"
                        className="w-full text-right text-slate-850 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-amber-600 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal footer controls */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddSubModalOpen(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold py-2.5 rounded-xl text-xs transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNewSub}
                  className="flex-[2] bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-amber-600/10 active:scale-95 disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{savingNewSub ? 'Registering...' : 'Add Sub-Bank'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* EDIT TARIFF MODAL OVERLAY */}
      {editingBank && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 select-none animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden relative">
            <button
              onClick={() => setEditingBank(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <form onSubmit={handleSaveEditedRates} className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3 pr-6">
                <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest block">Configure Parking Tariff</span>
                <h4 className="text-lg font-extrabold text-slate-800 tracking-tight mt-1">{editingBank.name}</h4>
                {editingBank.parentId && (
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Nested sub-bank of Third Party network</p>
                )}
              </div>

              {/* Tariff Inputs Grid */}
              <div className="space-y-4">
                {/* TW */}
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs font-bold text-slate-600">{getVehicleTypeName('TW')}</label>
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-3.5 top-2 text-slate-455 text-xs font-bold">{"\u20B9"}</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editingRates.TW}
                      onChange={(e) => setEditingRates({ ...editingRates, TW: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full text-right text-slate-850 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                </div>

                {/* THREE_W */}
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs font-bold text-slate-600">{getVehicleTypeName('THREE_W')}</label>
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-3.5 top-2 text-slate-455 text-xs font-bold">{"\u20B9"}</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editingRates.THREE_W}
                      onChange={(e) => setEditingRates({ ...editingRates, THREE_W: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full text-right text-slate-850 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                </div>

                {/* FW */}
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs font-bold text-slate-600">{getVehicleTypeName('FW')}</label>
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-3.5 top-2 text-slate-455 text-xs font-bold">{"\u20B9"}</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editingRates.FW}
                      onChange={(e) => setEditingRates({ ...editingRates, FW: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full text-right text-slate-850 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                </div>

                {/* CV */}
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs font-bold text-slate-600">{getVehicleTypeName('CV')}</label>
                  <div className="relative w-32 shrink-0">
                    <span className="absolute left-3.5 top-2 text-slate-455 text-xs font-bold">{"\u20B9"}</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editingRates.CV}
                      onChange={(e) => setEditingRates({ ...editingRates, CV: e.target.value === '' ? '' : Number(e.target.value) })}
                      className="w-full text-right text-slate-850 pl-6 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs font-extrabold focus:outline-none focus:border-indigo-600 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Edit Modal controls */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingBank(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl text-xs transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRates}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-indigo-600/10 active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingRates ? 'Saving tariff...' : 'Apply Tariff'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default RateMaster;
