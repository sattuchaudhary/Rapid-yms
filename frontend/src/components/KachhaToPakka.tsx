import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToastStore } from '../store/toastStore';
import {
  FileCheck,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  Building,
  Calendar,
  File,
  Check,
  Search
} from 'lucide-react';

interface Vehicle {
  id: string;
  vehicleNumber: string;
  brand?: string;
  model?: string;
  vehicleType: string;
  yardStatus: string;
  entryDate: string;
  bankName?: string;
  loanAgreementNo?: string;
}

const REPO_KIT_DOCS = [
  { key: 'pre_intimation', label: 'Pre-Intimation Letter', description: 'Letter sent prior to repossession', icon: FileText },
  { key: 'post_intimation', label: 'Post-Intimation Letter', description: 'Letter submitted post repossession', icon: FileCheck },
  { key: 'yard_inventory', label: 'Yard Inventory Sheet', description: 'Physical inventory checklist at yard', icon: File },
  { key: 'bank_inventory', label: 'Bank Inventory Sheet', description: 'Official inventory submitted to bank', icon: Building },
];

export const KachhaToPakka: React.FC<{ onBack?: () => void; initialVehicleId?: string }> = ({ onBack, initialVehicleId }) => {
  const toast = useToastStore();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [uploadMethod, setUploadMethod] = useState<'single_pdf' | 'separate' | null>('separate');
  const [docs, setDocs] = useState<Record<string, File | null>>({
    pre_intimation: null,
    post_intimation: null,
    yard_inventory: null,
    bank_inventory: null,
    combined_pdf: null,
  });

  useEffect(() => {
    fetchKachhaVehicles();
  }, []);

  const fetchKachhaVehicles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/vehicles', { params: { yardStatus: 'KACHHA' } });
      const data = res.data?.data || res.data || [];
      setVehicles(Array.isArray(data) ? data : []);
      
      if (initialVehicleId) {
        const found = data.find((v: Vehicle) => v.id === initialVehicleId);
        if (found) setSelectedVehicle(found);
      }
    } catch (err: any) {
      toast.error('Failed to load Kachha vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (key: string, file: File | null) => {
    setDocs((prev) => ({ ...prev, [key]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) {
      toast.error('Please select a vehicle to convert');
      return;
    }

    if (uploadMethod === 'single_pdf' && !docs.combined_pdf) {
      toast.error('Please upload the combined PDF document');
      return;
    }

    if (uploadMethod === 'separate') {
      const missing = REPO_KIT_DOCS.filter((d) => !docs[d.key]);
      if (missing.length > 0) {
        toast.error(`Missing required document: ${missing[0].label}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // Create FormData if files need to be uploaded
      const formData = new FormData();
      if (uploadMethod === 'single_pdf' && docs.combined_pdf) {
        formData.append('combined_pdf', docs.combined_pdf);
      } else {
        REPO_KIT_DOCS.forEach((d) => {
          if (docs[d.key]) {
            formData.append(d.key, docs[d.key]!);
          }
        });
      }
      formData.append('vehicleId', selectedVehicle.id);
      formData.append('yardStatus', 'PAKKA');

      await api.post(`/vehicles/${selectedVehicle.id}/convert-pakka`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success(`Vehicle ${selectedVehicle.vehicleNumber} converted to PAKKA successfully!`);
      setSelectedVehicle(null);
      fetchKachhaVehicles();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to convert vehicle to Pakka');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter((v) =>
    v.vehicleNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.bankName && v.bankName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black text-white tracking-wide font-display">Kachha to Pakka Conversion</h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Verify repo kit documents & convert temporary entries into official yard inventory
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Vehicle Selection List */}
        <div className="lg:col-span-5 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-200 tracking-wide">Select Kachha Entry ({filteredVehicles.length})</h2>
            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Pending Verification
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search vehicle number, bank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <CheckCircle className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400 font-semibold">No pending Kachha entries found</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-1">
              {filteredVehicles.map((v) => {
                const isSelected = selectedVehicle?.id === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 shadow-md shadow-indigo-600/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white tracking-wider">{v.vehicleNumber}</span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {v.vehicleType}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>{v.bankName || 'Unknown Bank'}</span>
                      <span className="text-[11px] text-slate-500">
                        {v.entryDate ? new Date(v.entryDate).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Repo Kit Document Verification Form */}
        <div className="lg:col-span-7 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-6 space-y-6 shadow-xl">
          {!selectedVehicle ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
              <div className="p-4 bg-slate-800/50 rounded-2xl text-slate-500">
                <FileCheck className="w-10 h-10" />
              </div>
              <h3 className="text-base font-bold text-white">No Vehicle Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Choose a pending vehicle from the left column to upload repo kit documents and convert to Pakka status.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Selected Vehicle Info Banner */}
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-widest block">Selected Vehicle</span>
                  <p className="text-lg font-black text-white mt-0.5">{selectedVehicle.vehicleNumber}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedVehicle.brand} {selectedVehicle.model} • {selectedVehicle.bankName}
                  </p>
                </div>
                <div className="p-3 bg-indigo-600/20 rounded-xl border border-indigo-500/30">
                  <FileCheck className="w-6 h-6 text-indigo-400" />
                </div>
              </div>

              {/* Upload Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Repo Kit Upload Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUploadMethod('separate')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center space-x-3 ${
                      uploadMethod === 'separate'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="font-extrabold">Individual Documents</div>
                      <div className="text-[10px] text-slate-400 font-normal">Upload 4 separate papers</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMethod('single_pdf')}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all text-left flex items-center space-x-3 ${
                      uploadMethod === 'single_pdf'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="font-extrabold">Combined Repo Kit PDF</div>
                      <div className="text-[10px] text-slate-400 font-normal">Single PDF containing all pages</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Document Upload Fields */}
              {uploadMethod === 'single_pdf' ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300">Upload Combined Repo Kit (PDF)</label>
                  <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-center bg-slate-950/50 transition-colors">
                    <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => handleFileChange('combined_pdf', e.target.files?.[0] || null)}
                      className="hidden"
                      id="combined-pdf-input"
                    />
                    <label htmlFor="combined-pdf-input" className="cursor-pointer text-xs font-bold text-indigo-400 hover:underline">
                      {docs.combined_pdf ? docs.combined_pdf.name : 'Click to upload PDF or image file'}
                    </label>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {REPO_KIT_DOCS.map((doc) => {
                    const Icon = doc.icon;
                    const file = docs[doc.key];
                    return (
                      <div key={doc.key} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center space-x-2">
                          <Icon className="w-4 h-4 text-indigo-400" />
                          <span className="text-xs font-bold text-slate-200">{doc.label}</span>
                        </div>
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => handleFileChange(doc.key, e.target.files?.[0] || null)}
                          className="hidden"
                          id={`file-${doc.key}`}
                        />
                        <label
                          htmlFor={`file-${doc.key}`}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                            file
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <span className="truncate max-w-[180px]">{file ? file.name : 'Choose file...'}</span>
                          {file ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Upload className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 hover:from-indigo-500 hover:to-indigo-600 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Converting to Pakka...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm & Convert to Pakka Status</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
