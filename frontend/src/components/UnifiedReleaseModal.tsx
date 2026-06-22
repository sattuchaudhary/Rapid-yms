import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  X,
  KeyRound,
  Search,
  CheckCircle,
  Printer,
  Upload,
  Camera,
  Leaf,
} from 'lucide-react';
import { useToastStore } from '../store/toastStore';
import { compressImage } from '../utils/imageCompressor';

interface UnifiedReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialVehicle?: any;
  onSuccess?: (result?: any) => void;
}

export const UnifiedReleaseModal: React.FC<UnifiedReleaseModalProps> = ({
  isOpen,
  onClose,
  initialVehicle,
  onSuccess,
}) => {
  const toast = useToastStore();

  // Basic States
  const [activeInYardVehicles, setActiveInYardVehicles] = useState<any[]>([]);
  const [releaseSearchTerm, setReleaseSearchTerm] = useState('');
  const [selectedRelVehicle, setSelectedRelVehicle] = useState<any | null>(null);

  // Form States
  const [relCategory, setRelCategory] = useState<'PAKKA' | 'KACHHA' | 'SPECIAL'>('PAKKA');
  const [relDate, setRelDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [relLetterDate, setRelLetterDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [relGracePeriod, setRelGracePeriod] = useState<number>(0);
  const [relParkingRate, setRelParkingRate] = useState<number>(150);

  // Special/Dispute States
  const [disputeCondition, setDisputeCondition] = useState<'FREE' | 'PAID'>('FREE');
  const [disputeCalcMethod, setDisputeCalcMethod] = useState<'CALCULATED' | 'MANUAL'>('CALCULATED');
  const [disputeManualFee, setDisputeManualFee] = useState<number>(0);

  // Document Uploads States
  const [isThirdPartyRel, setIsThirdPartyRel] = useState(false);
  const [relDocs, setRelDocs] = useState<{
    releaseLetter?: string;
    ownerIdProof?: string;
    thirdPartyIdProof?: string;
    handoverPhoto?: string;
  }>({});
  const [relUploadingDocs, setRelUploadingDocs] = useState<{
    releaseLetter?: boolean;
    ownerIdProof?: boolean;
    thirdPartyIdProof?: boolean;
    handoverPhoto?: boolean;
  }>({});

  // Submit & Success states
  const [isSubmittingRelease, setIsSubmittingRelease] = useState(false);
  const [releaseSuccessResult, setReleaseSuccessResult] = useState<any | null>(null);

  // Initialize and load active stock inside the yard
  useEffect(() => {
    if (!isOpen) return;

    // Reset everything
    setReleaseSearchTerm('');
    setRelDocs({});
    setRelUploadingDocs({});
    setReleaseSuccessResult(null);
    setIsThirdPartyRel(false);

    // If an initial vehicle is provided, bypass search step and select it directly
    if (initialVehicle) {
      handleSelectRelVehicle(initialVehicle);
    } else {
      setSelectedRelVehicle(null);
      loadActiveVehicles();
    }
  }, [isOpen, initialVehicle]);

  const loadActiveVehicles = async () => {
    try {
      const res = await api.get('/vehicles', { params: { limit: 1000 } });
      if (res.data?.success) {
        const list = res.data.data.filter((v: any) => v.yardStatus === 'KACHHA' || v.yardStatus === 'PAKKA');
        setActiveInYardVehicles(list);
      }
    } catch (err) {
      console.error('Failed to load active vehicles for release', err);
    }
  };

  const handleSelectRelVehicle = (vehicle: any) => {
    setSelectedRelVehicle(vehicle);
    setReleaseSearchTerm('');

    if (vehicle.yardStatus === 'PAKKA') {
      setRelCategory('PAKKA');
    } else {
      setRelCategory('KACHHA');
    }

    if (vehicle.billing?.dailyRate) {
      setRelParkingRate(vehicle.billing.dailyRate);
    } else if (vehicle.parkingRates?.dailyRate) {
      setRelParkingRate(vehicle.parkingRates.dailyRate);
    } else {
      const defaultRates: any = { TW: 50, THREE_W: 100, FW: 150, CV: 250 };
      setRelParkingRate(defaultRates[vehicle.vehicleType] || 100);
    }

    if (vehicle.entryDate) {
      setRelLetterDate(new Date(vehicle.entryDate).toISOString().split('T')[0]);
    }
  };

  const calculateReleaseFees = () => {
    if (!selectedRelVehicle) return 0;

    const end = new Date(relDate);

    if (relCategory === 'PAKKA') {
      const start = new Date(relLetterDate);
      const diffTime = end.getTime() - start.getTime();
      let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) diffDays = 0;

      const billableDays = Math.max(0, diffDays - relGracePeriod);
      return billableDays * relParkingRate;
    } else if (relCategory === 'KACHHA') {
      const start = new Date(selectedRelVehicle.entryDate);
      const diffTime = end.getTime() - start.getTime();
      let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays < 1) diffDays = 1;

      return diffDays * relParkingRate;
    } else {
      if (disputeCondition === 'FREE') return 0;
      if (disputeCalcMethod === 'MANUAL') return disputeManualFee;

      const start = new Date(selectedRelVehicle.entryDate);
      const diffTime = end.getTime() - start.getTime();
      let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays < 1) diffDays = 1;

      return diffDays * relParkingRate;
    }
  };

  const handleRelDocUpload = async (
    docType: 'releaseLetter' | 'ownerIdProof' | 'thirdPartyIdProof' | 'handoverPhoto',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRelUploadingDocs(prev => ({ ...prev, [docType]: true }));
    try {
      const compressedFile = await compressImage(file, 1280, 0.8);
      const res = await api.get(
        `/uploads/presigned-url?fileType=${compressedFile.type}&fileSize=${compressedFile.size}&folder=releases`
      );
      if (res.data?.success) {
        const { uploadUrl, publicUrl } = res.data.data;
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': compressedFile.type },
          body: compressedFile,
        });

        if (!uploadRes.ok) throw new Error('Cloud storage upload failed');

        setRelDocs(prev => ({ ...prev, [docType]: publicUrl }));
        toast.success(`${docType.replace(/([A-Z])/g, ' $1').toUpperCase()} uploaded successfully!`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`File upload failed: ${err.message || err}`);
    } finally {
      setRelUploadingDocs(prev => ({ ...prev, [docType]: false }));
    }
  };

  const handleDirectReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRelVehicle) return;

    if (relCategory === 'PAKKA' && !relDocs.releaseLetter) {
      toast.error('Release Letter is required for regular release');
      return;
    }
    if (!relDocs.ownerIdProof) {
      toast.error("Owner's ID Proof is required");
      return;
    }
    if (isThirdPartyRel && !relDocs.thirdPartyIdProof) {
      toast.error("Third-Person's ID Proof is required for third-party handover");
      return;
    }
    if (!relDocs.handoverPhoto) {
      toast.error('Customer Handover Photo is required');
      return;
    }

    const fees = calculateReleaseFees();

    setIsSubmittingRelease(true);
    try {
      const payload = {
        releaseType: relCategory,
        releaseLetter: relDocs.releaseLetter,
        customerIdProof: relDocs.ownerIdProof,
        thirdPartyIdProof: relDocs.thirdPartyIdProof,
        handoverPhoto1: relDocs.handoverPhoto,
        handoverPhoto2: relDocs.thirdPartyIdProof,
        paidAmount: fees,
        totalAmount: fees,
        approvedTillDate: relCategory === 'PAKKA' ? relDate : undefined,
      };

      const res = await api.post(`/releases/${selectedRelVehicle.id}/direct`, payload);
      if (res.data?.success) {
        toast.success('Vehicle successfully released from yard!');
        setReleaseSuccessResult(res.data.data);
        if (onSuccess) {
          onSuccess(res.data.data);
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Failed to process vehicle release');
    } finally {
      setIsSubmittingRelease(false);
    }
  };

  const handlePrintRelTicket = () => {
    if (!releaseSuccessResult) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Gate Pass Ticket - ${releaseSuccessResult.gatePassNumber}</title>
          <style>
            body {
              font-family: monospace;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #000;
            }
            .ticket {
              display: inline-block;
              border: 1px dashed #000;
              padding: 20px;
              width: 280px;
            }
            .title {
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .subtitle {
              font-size: 10px;
              color: #555;
              margin-bottom: 15px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin: 4px 0;
              border-bottom: 1px dotted #ccc;
              padding-bottom: 2px;
            }
            .footer {
              margin-top: 20px;
              font-size: 8px;
              color: #777;
            }
          </style>
        </head>
        <body onload="window.print();window.close();">
          <div class="ticket">
            <div class="title">YARDPRO TICKET</div>
            <div class="subtitle">SECURE EXIT CLEARANCE</div>
            <div class="row">
              <span>GP NUMBER:</span>
              <strong>${releaseSuccessResult.gatePassNumber}</strong>
            </div>
            <div class="row">
              <span>PLATE NO:</span>
              <strong>${selectedRelVehicle.vehicleNumber}</strong>
            </div>
            <div class="row">
              <span>CATEGORY:</span>
              <strong>${relCategory}</strong>
            </div>
            <div class="row">
              <span>FINANCIER:</span>
              <strong>${selectedRelVehicle.bankName}</strong>
            </div>
            <div class="row">
              <span>RELEASED AT:</span>
              <strong>${new Date().toLocaleString('en-IN')}</strong>
            </div>
            <div class="row" style="border-bottom: none; margin-top: 10px;">
              <span>TOTAL PAID:</span>
              <strong>\u20B9${calculateReleaseFees().toLocaleString('en-IN')}</strong>
            </div>
            <div class="footer">
              Eco-Friendly Operations<br />
              No Physical Paper Billing Logged
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm select-none font-sans animate-fade-in">
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="text-left">
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-450 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              Operations Desk
            </span>
            <h3 className="text-base sm:text-lg font-black tracking-tight mt-1 bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              Unified Vehicle Release Desk
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              Settle parking tariffs, verify compliance proofs, and issue gate-out clearances.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-all active:scale-90"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 flex flex-col min-h-0">
          {!selectedRelVehicle ? (
            /* STEP 1: Search & Select Vehicle */
            <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto w-full py-10 space-y-6">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-500 animate-bounce">
                <KeyRound className="w-8 h-8" />
              </div>
              <div className="text-center space-y-1.5">
                <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                  Search Parking Yard Inventory
                </h4>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Type the license plate number, brand, model, or bank name of any active in-yard vehicle to initiate checkout processing.
                </p>
              </div>

              {/* Interactive Auto-Suggest Box */}
              <div className="w-full relative">
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Active Vehicles (e.g. MH12, ICICI, Swift)..."
                    value={releaseSearchTerm}
                    onChange={e => setReleaseSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-250 rounded-2xl pl-11 pr-4 py-3 text-sm font-semibold text-slate-850 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 shadow-sm transition-all"
                  />
                  {releaseSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setReleaseSearchTerm('')}
                      className="absolute right-3 top-3 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-500 px-2 py-1 rounded-lg font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Suggestions List: Display list always, filters when typing, shows active by default */}
                <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-lg max-h-[250px] overflow-y-auto divide-y divide-slate-100 text-left">
                  {(() => {
                    const term = releaseSearchTerm.trim().toLowerCase();
                    const filtered = term
                      ? activeInYardVehicles.filter(
                          (v: any) =>
                            v.vehicleNumber?.toLowerCase().includes(term) ||
                            v.brand?.toLowerCase().includes(term) ||
                            v.model?.toLowerCase().includes(term) ||
                            v.bankName?.toLowerCase().includes(term)
                        )
                      : activeInYardVehicles;

                    if (filtered.length === 0) {
                      return (
                        <div className="p-5 text-center text-xs text-slate-400 font-semibold">
                          {term
                            ? `No active in-yard vehicles match "${releaseSearchTerm}"`
                            : 'No active vehicles currently in yard'}
                        </div>
                      );
                    }

                    return (
                      <>
                        {!term && (
                          <div className="px-4 py-2 bg-slate-50 text-[9px] font-black text-slate-450 uppercase tracking-widest sticky top-0 border-b border-slate-150 z-10">
                            Active In-Yard Stock ({filtered.length})
                          </div>
                        )}
                        {filtered.map(v => (
                          <button
                            type="button"
                            key={v.id}
                            onClick={() => handleSelectRelVehicle(v)}
                            className="w-full px-5 py-3 hover:bg-slate-50 flex items-center justify-between text-left transition-colors cursor-pointer"
                          >
                            <div>
                              <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                                {v.vehicleNumber}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold mt-0.5 block">
                                {v.brand || 'N/A'} {v.model || ''} • {v.bankName}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded font-black text-[8px] uppercase tracking-wider ${
                                v.yardStatus === 'PAKKA'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                  : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}
                            >
                              {v.yardStatus}
                            </span>
                          </button>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : releaseSuccessResult ? (
            /* STEP 3: SUCCESS GATE PASS VISUAL */
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-6 min-h-0 overflow-y-auto">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center animate-pulse shadow-lg shadow-emerald-500/5">
                <CheckCircle className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase">
                  Handover Dispatched Successfully!
                </h4>
                <p className="text-xs text-slate-500 font-semibold max-w-sm">
                  Vehicle <strong>{selectedRelVehicle.vehicleNumber}</strong> has cleared audit checks. The allocated slot in Zone{' '}
                  {selectedRelVehicle.yardLocation?.zone || 'A'} Slot {selectedRelVehicle.yardLocation?.slot || 'N/A'}{' '}
                  is now released and ready for active reuse.
                </p>
              </div>

              {/* Printed Ticket Card */}
              <div className="border-2 border-dashed border-slate-200 bg-white p-5 rounded-3xl text-center space-y-4 max-w-xs w-full shadow-md select-none font-mono">
                <div className="border-b border-dashed border-slate-250 pb-2">
                  <span className="font-extrabold text-xs text-slate-800 uppercase tracking-widest block">YARDPRO TICKET</span>
                  <span className="text-[8px] text-emerald-600 uppercase tracking-widest block font-bold mt-0.5">
                    SECURE EXIT CLEARANCE
                  </span>
                </div>
                <div className="space-y-2 text-left text-[10px] text-slate-650">
                  <div className="flex justify-between border-b border-dotted border-slate-100 pb-0.5">
                    <span>GP NUMBER:</span>
                    <span className="font-bold text-slate-850">{releaseSuccessResult.gatePassNumber}</span>
                  </div>
                  <div className="flex justify-between border-b border-dotted border-slate-100 pb-0.5">
                    <span>PLATE NO:</span>
                    <span className="font-bold text-slate-850 uppercase">{selectedRelVehicle.vehicleNumber}</span>
                  </div>
                  <div className="flex justify-between border-b border-dotted border-slate-100 pb-0.5">
                    <span>CATEGORY:</span>
                    <span className="font-bold text-slate-850">{relCategory}</span>
                  </div>
                  <div className="flex justify-between border-b border-dotted border-slate-100 pb-0.5">
                    <span>FINANCIER:</span>
                    <span className="font-bold text-slate-850 uppercase truncate max-w-[130px]">
                      {selectedRelVehicle.bankName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>TOTAL PAID:</span>
                    <span className="font-bold text-emerald-600">
                      {"\u20B9"}{calculateReleaseFees().toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePrintRelTicket}
                  className="w-full bg-slate-900 hover:bg-black text-white font-bold py-2 rounded-xl text-[10px] flex items-center justify-center space-x-1.5 transition-all shadow-md active:scale-95 cursor-pointer uppercase tracking-wider"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Exit Pass</span>
                </button>
              </div>

              <div className="flex items-center space-x-3 pt-4">
                {!initialVehicle && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRelVehicle(null);
                      setReleaseSuccessResult(null);
                      loadActiveVehicles();
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-650 font-bold px-6 py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-sm"
                  >
                    Release Another Vehicle
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-emerald-600/10"
                >
                  Done & Exit Desk
                </button>
              </div>
            </div>
          ) : (
            /* STEP 2: COMPLETE THE RELEASE WIZARD FORM */
            <form
              onSubmit={handleDirectReleaseSubmit}
              className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 text-left min-h-0 overflow-y-auto"
            >
              {/* LEFT CONSOLE: Vehicle Info & Calculation */}
              <div className="space-y-6 flex flex-col justify-between">
                {/* Vehicle Profile Card */}
                <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-md relative overflow-hidden flex flex-col justify-between h-fit shrink-0">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="absolute left-0 bottom-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

                  <div className="z-10">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[8px] uppercase tracking-widest font-black text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded">
                          Target Stock File
                        </span>
                        <div className="border border-slate-700 bg-slate-950 px-3 py-1 rounded-xl text-lg font-black tracking-widest text-slate-100 uppercase font-mono mt-2.5 inline-flex items-center gap-2 shadow-inner">
                          <span className="w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                          <span>{selectedRelVehicle.vehicleNumber}</span>
                        </div>
                      </div>
                      {!initialVehicle && (
                        <button
                          type="button"
                          onClick={() => setSelectedRelVehicle(null)}
                          className="text-[9px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-lg border border-slate-700 transition-colors"
                        >
                          Change Vehicle
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3.5 border-t border-slate-800/80 pt-4 mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <div>
                        <span>Brand / Model</span>
                        <span className="font-extrabold text-white mt-1 block truncate">
                          {selectedRelVehicle.brand || 'N/A'} {selectedRelVehicle.model || ''}
                        </span>
                      </div>
                      <div>
                        <span>Financier Partner</span>
                        <span className="font-extrabold text-white mt-1 block truncate font-mono">
                          {selectedRelVehicle.bankName}
                        </span>
                      </div>
                      <div>
                        <span>Entry Check-In</span>
                        <span className="font-extrabold text-white mt-1 block font-mono">
                          {selectedRelVehicle.entryDate
                            ? new Date(selectedRelVehicle.entryDate).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span>Allocated slot</span>
                        <span className="font-extrabold text-amber-400 mt-1 block">
                          Slot {selectedRelVehicle.yardLocation?.slot || 'Unallocated'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Release Category Selector */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-4 shrink-0">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    Select Release Option / Category
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'PAKKA', label: 'Regular (Pakka)', desc: 'Repo kit submitted' },
                      { key: 'KACHHA', label: 'Direct (Kaccha)', desc: 'No repo kit filled' },
                      { key: 'SPECIAL', label: 'Dispute / Dispute', desc: 'Police call/Special cases' },
                    ].map(cat => {
                      const isActive = relCategory === cat.key;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          onClick={() => setRelCategory(cat.key as any)}
                          className={`p-3 rounded-2xl border text-center flex flex-col justify-between h-20 transition-all cursor-pointer ${
                            isActive
                              ? 'border-amber-500 bg-amber-500/5 text-amber-700 shadow-[0_2px_8px_rgba(245,158,11,0.08)] scale-[1.02] font-extrabold'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-slate-355 hover:bg-slate-50/50'
                          }`}
                        >
                          <span className="text-xs font-black block leading-tight">{cat.label}</span>
                          <span className="text-[7px] text-slate-400 leading-normal block mt-1">{cat.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Inputs form based on selected release type */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-4 shrink-0">
                  <div className="border-b border-slate-100 pb-2">
                    <h5 className="text-[11px] font-black uppercase text-slate-800 tracking-wider">
                      Release Parameters
                    </h5>
                  </div>

                  {relCategory === 'PAKKA' && (
                    <div className="space-y-4 animate-fade-in text-left">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Release Letter Date
                          </label>
                          <input
                            type="date"
                            required
                            max={relDate}
                            value={relLetterDate}
                            onChange={e => setRelLetterDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Yard Release Date
                          </label>
                          <input
                            type="date"
                            required
                            value={relDate}
                            onChange={e => setRelDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Bank Grace Period (Days)
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={relGracePeriod}
                            onChange={e => setRelGracePeriod(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Tariff Rate Per Day (\u25C4)
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={relParkingRate}
                            onChange={e => setRelParkingRate(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {relCategory === 'KACHHA' && (
                    <div className="space-y-4 animate-fade-in text-left">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Yard Release Date
                          </label>
                          <input
                            type="date"
                            required
                            value={relDate}
                            onChange={e => setRelDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            Tariff Rate Per Day (\u25C4)
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={relParkingRate}
                            onChange={e => setRelParkingRate(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {relCategory === 'SPECIAL' && (
                    <div className="space-y-4 animate-fade-in text-left">
                      {/* Toggle Free vs Paid */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Dispute Condition
                        </label>
                        <div className="flex border border-slate-200 rounded-xl p-1 w-full bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setDisputeCondition('FREE')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                              disputeCondition === 'FREE'
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-250/20'
                                : 'text-slate-450 hover:text-slate-700'
                            }`}
                          >
                            Free Release ({"\u20B9"}0)
                          </button>
                          <button
                            type="button"
                            onClick={() => setDisputeCondition('PAID')}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                              disputeCondition === 'PAID'
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-250/20'
                                : 'text-slate-450 hover:text-slate-700'
                            }`}
                          >
                            Paid Release
                          </button>
                        </div>
                      </div>

                      {disputeCondition === 'PAID' && (
                        <div className="space-y-4 pt-1 animate-fade-in text-left">
                          <div className="space-y-1.5 text-left">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                              Fee Calculation Type
                            </label>
                            <div className="flex border border-slate-200 rounded-xl p-1 w-full bg-slate-50">
                              <button
                                type="button"
                                onClick={() => setDisputeCalcMethod('CALCULATED')}
                                className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                                  disputeCalcMethod === 'CALCULATED' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-455'
                                }`}
                              >
                                Calculate from Entry
                              </button>
                              <button
                                type="button"
                                onClick={() => setDisputeCalcMethod('MANUAL')}
                                className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${
                                  disputeCalcMethod === 'MANUAL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-455'
                                }`}
                              >
                                Manual Flat Fee
                              </button>
                            </div>
                          </div>

                          {disputeCalcMethod === 'MANUAL' ? (
                            <div className="space-y-1 animate-fade-in text-left">
                              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                Manual Flat Fee Amount (\u25C4)
                              </label>
                              <input
                                type="number"
                                required
                                min="0"
                                value={disputeManualFee}
                                onChange={e => setDisputeManualFee(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none font-mono"
                              />
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-4 animate-fade-in text-left">
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Yard Release Date
                                </label>
                                <input
                                  type="date"
                                  required
                                  value={relDate}
                                  onChange={e => setRelDate(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Rate Per Day (\u25C4)
                                </label>
                                <input
                                  type="number"
                                  required
                                  min="0"
                                  value={relParkingRate}
                                  onChange={e => setRelParkingRate(Math.max(0, parseInt(e.target.value) || 0))}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none font-mono"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Calculation Real-Time Card */}
                <div className="bg-gradient-to-tr from-slate-900 to-indigo-950 text-white rounded-3xl p-5 border border-indigo-950/60 shadow-md space-y-4 shrink-0 mt-auto text-left">
                  <span className="text-[8px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-500/20 border border-indigo-500/20 px-2.5 py-0.5 rounded-full block w-fit">
                    Accrued Calculations
                  </span>

                  <div className="text-[10px] text-slate-300 leading-relaxed font-semibold">
                    {relCategory === 'PAKKA' && (
                      <p>
                        Formula: Max(0, (ReleaseDate - ReleaseLetterDate) - GraceDays) * DailyRate
                        <br />
                        Math: ({(() => {
                          const d = Math.ceil(
                            (new Date(relDate).getTime() - new Date(relLetterDate).getTime()) / (1000 * 60 * 60 * 24)
                          );
                          return d < 0 ? 0 : d;
                        })()} Days - {relGracePeriod} Grace) * {"\u20B9"}{relParkingRate} / day
                      </p>
                    )}
                    {relCategory === 'KACHHA' && (
                      <p>
                        Formula: (ReleaseDate - EntryDate + 1) * DailyRate (Inclusive of first day)
                        <br />
                        Math:{' '}
                        {(() => {
                          const d =
                            Math.floor(
                              (new Date(relDate).getTime() - new Date(selectedRelVehicle.entryDate).getTime()) /
                                (1000 * 60 * 60 * 24)
                            ) + 1;
                          return d < 1 ? 1 : d;
                        })()}{' '}
                        Days * {"\u20B9"}{relParkingRate} / day
                      </p>
                    )}
                    {relCategory === 'SPECIAL' && (
                      <p>
                        {disputeCondition === 'FREE' ? (
                          <span>Dispute condition: Released for Free under compliance settlement.</span>
                        ) : disputeCalcMethod === 'MANUAL' ? (
                          <span>Manual Dispute Overriding Flat Fee Settle.</span>
                        ) : (
                          <span>
                            Formula: (ReleaseDate - EntryDate + 1) * DailyRate
                            <br />
                            Math:{' '}
                            {(() => {
                              const d =
                                Math.floor(
                                  (new Date(relDate).getTime() - new Date(selectedRelVehicle.entryDate).getTime()) /
                                    (1000 * 60 * 60 * 24)
                                ) + 1;
                              return d < 1 ? 1 : d;
                            })()}{' '}
                            Days * {"\u20B9"}{relParkingRate} / day
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-800 pt-3.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Total Parking Due
                    </span>
                    <span className="text-2xl font-black text-amber-400 font-mono">
                      {"\u20B9"}{calculateReleaseFees().toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* RIGHT CONSOLE: Compliance Documents Upload & Capture */}
              <div className="space-y-6 flex flex-col justify-between">
                {/* Compliance Checklist and Uploads Card */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <h5 className="text-[11px] font-black uppercase text-slate-800 tracking-wider text-left">
                      Required Settle Documents
                    </h5>
                  </div>

                  <div className="space-y-3.5">
                    {/* 1. Release Letter (PAKKA ONLY) */}
                    {relCategory === 'PAKKA' && (
                      <div className="space-y-1 text-left">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Official Release Letter (Required)
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            disabled={relUploadingDocs.releaseLetter}
                            onClick={() => document.getElementById('modal-rel-upload-letter')?.click()}
                            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-dashed text-xs font-bold transition-all ${
                              relDocs.releaseLetter
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                            }`}
                          >
                            <Upload className="w-4 h-4 shrink-0" />
                            <span>
                              {relUploadingDocs.releaseLetter
                                ? 'Uploading...'
                                : relDocs.releaseLetter
                                ? 'Letter Loaded ✓'
                                : 'Upload Release Letter'}
                            </span>
                          </button>
                          <input
                            id="modal-rel-upload-letter"
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={e => handleRelDocUpload('releaseLetter', e)}
                          />
                        </div>
                      </div>
                    )}

                    {/* 2. Owner's ID Proof */}
                    <div className="space-y-1 text-left">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Owner's Aadhaar / ID Proof (Required)
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          disabled={relUploadingDocs.ownerIdProof}
                          onClick={() => document.getElementById('modal-rel-upload-ownerid')?.click()}
                          className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-dashed text-xs font-bold transition-all ${
                            relDocs.ownerIdProof
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                          }`}
                        >
                          <Upload className="w-4 h-4 shrink-0" />
                          <span>
                            {relUploadingDocs.ownerIdProof
                              ? 'Uploading...'
                              : relDocs.ownerIdProof
                              ? 'Owner ID Loaded ✓'
                              : 'Upload Owner ID Proof'}
                          </span>
                        </button>
                        <input
                          id="modal-rel-upload-ownerid"
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={e => handleRelDocUpload('ownerIdProof', e)}
                        />
                      </div>
                    </div>

                    {/* 3. Third-Person Handover Toggle */}
                    <div className="flex items-center space-x-2 border-t border-slate-100/80 pt-3 select-none text-left">
                      <input
                        type="checkbox"
                        id="modal-rel-third-person-toggle"
                        checked={isThirdPartyRel}
                        onChange={e => setIsThirdPartyRel(e.target.checked)}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                      />
                      <label
                        htmlFor="modal-rel-third-person-toggle"
                        className="text-[10px] font-black text-slate-600 uppercase tracking-wide cursor-pointer"
                      >
                        Is Third-Person Handover?
                      </label>
                    </div>

                    {/* 4. Third-Person ID Proof */}
                    {isThirdPartyRel && (
                      <div className="space-y-1 text-left animate-fade-in">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Authorized Recipient ID Proof (Required)
                        </span>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            disabled={relUploadingDocs.thirdPartyIdProof}
                            onClick={() => document.getElementById('modal-rel-upload-thirdpartyid')?.click()}
                            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-dashed text-xs font-bold transition-all ${
                              relDocs.thirdPartyIdProof
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100/50'
                            }`}
                          >
                            <Upload className="w-4 h-4 shrink-0" />
                            <span>
                              {relUploadingDocs.thirdPartyIdProof
                                ? 'Uploading...'
                                : relDocs.thirdPartyIdProof
                                ? 'Recipient ID Loaded ✓'
                                : 'Upload Recipient ID'}
                            </span>
                          </button>
                          <input
                            id="modal-rel-upload-thirdpartyid"
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={e => handleRelDocUpload('thirdPartyIdProof', e)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Handover delivery picture capture */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-2 text-left">
                    <h5 className="text-[11px] font-black uppercase text-slate-800 tracking-wider">
                      Gate Handover Photograph
                    </h5>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      disabled={relUploadingDocs.handoverPhoto}
                      onClick={() => document.getElementById('modal-rel-upload-handover-photo')?.click()}
                      className={`w-full aspect-[21/9] rounded-2xl border border-dashed flex flex-col items-center justify-center text-center p-4 transition-all relative overflow-hidden ${
                        relDocs.handoverPhoto
                          ? 'border-emerald-300 bg-emerald-950/5 text-emerald-600'
                          : 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100/50'
                      }`}
                    >
                      {relUploadingDocs.handoverPhoto ? (
                        <>
                          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-1"></div>
                          <span className="text-[9px] font-bold">Saving photo...</span>
                        </>
                      ) : relDocs.handoverPhoto ? (
                        <>
                          <img
                            src={relDocs.handoverPhoto}
                            alt="handover delivery"
                            className="w-full h-full object-cover absolute inset-0 opacity-40"
                          />
                          <span className="z-10 bg-emerald-900 text-white font-extrabold px-3 py-1 rounded-full text-[9px] uppercase tracking-wider border border-emerald-500">
                            Photo Captured ✓
                          </span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-6 h-6 mb-1 text-slate-400 shrink-0" />
                          <span className="text-xs font-black uppercase tracking-wide">
                            Capture Customer Handover Photo
                          </span>
                          <span className="text-[8px] text-slate-400 mt-0.5">Device camera automatically triggered</span>
                        </>
                      )}
                    </button>
                    <input
                      id="modal-rel-upload-handover-photo"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => handleRelDocUpload('handoverPhoto', e)}
                    />
                  </div>
                </div>

                {/* Settle and submit button panel */}
                <div className="flex gap-3 pt-2">
                  {!initialVehicle && (
                    <button
                      type="button"
                      onClick={() => setSelectedRelVehicle(null)}
                      className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-650 font-bold px-4 py-3 rounded-2xl text-xs transition-all active:scale-95 shadow-sm cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmittingRelease}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:text-slate-400 text-slate-950 font-black py-3 rounded-2xl shadow-lg shadow-amber-500/10 text-xs uppercase tracking-widest transition-all active:scale-98 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    {isSubmittingRelease ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                        <span>Verifying & Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Handover & Gate Pass</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center text-slate-450 text-[8px] font-black uppercase tracking-widest px-6 shrink-0">
          <span className="flex items-center gap-1">
            <Leaf className="w-3.5 h-3.5 text-emerald-600" /> Digital first gate-out paperless audit.
          </span>
          <span>YMS Release CommandCenter</span>
        </div>
      </div>
    </div>
  );
};
