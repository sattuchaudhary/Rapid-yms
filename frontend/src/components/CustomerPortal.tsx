import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, Check, X, ShieldAlert, ArrowLeft, UploadCloud, AlertCircle, 
  Loader2, Camera, Info, Calendar, DollarSign, Download, Signature, 
  Warehouse, ShieldCheck, HelpCircle, FileText, CheckCircle2 
} from 'lucide-react';

interface CustomerPortalProps {
  onBackToLogin: () => void;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({ onBackToLogin }) => {
  // Search Form State
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchResult, setSearchResult] = useState<any | null>(null);

  // Active View Tab inside details ('status' or 'release')
  const [activeTab, setActiveTab] = useState<'status' | 'release'>('status');

  // Lightbox view for check-in photographs
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // Release Request Form State
  const [releaseType, setReleaseType] = useState('BANK');
  const [submittingRelease, setSubmittingRelease] = useState(false);
  const [releaseSuccess, setReleaseSuccess] = useState(false);
  const [releaseError, setReleaseError] = useState('');

  // Uploaded files public URLs
  const [uploadedLetter, setUploadedLetter] = useState('');
  const [uploadedId, setUploadedId] = useState('');
  const [uploadedReceipt, setUploadedReceipt] = useState('');

  // File uploading feedback loading states
  const [uploadingLetter, setUploadingLetter] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Digital Signature Pad Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  // Resolve subdomain and tenant branding dynamically
  const [tenantBranding, setTenantBranding] = useState<any | null>(null);

  useEffect(() => {
    // Attempt resolving custom branding if subdomain loaded
    const resolveBranding = async () => {
      try {
        const res = await axios.get(`/api/tenants/resolve?host=${window.location.host}`);
        if (res.data?.success && res.data?.data) {
          setTenantBranding(res.data.data);
        }
      } catch (e) {
        console.warn('⚠️ Could not resolve subdomain branding:', e);
      }
    };
    resolveBranding();
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    setSearching(true);
    setSearchResult(null);
    setReleaseSuccess(false);

    try {
      const res = await axios.get('/api/public/vehicles/track', {
        params: {
          vehicleNumber,
          verificationCode,
          host: window.location.host
        }
      });
      if (res.data?.success) {
        setSearchResult(res.data.data);
        if (res.data.tenant) {
          setTenantBranding(res.data.tenant);
        }
      }
    } catch (err: any) {
      setSearchError(err.response?.data?.error || 'Vehicle not found or verification credentials incorrect.');
    } finally {
      setSearching(false);
    }
  };

  // Safe file upload helper to get S3 presigned URL and PUT raw data
  const handleFileUpload = async (
    file: File, 
    folder: string, 
    setUploading: (val: boolean) => void, 
    setPublicUrl: (val: string) => void
  ) => {
    setUploading(true);
    try {
      // 1. Get Public S3 Presigned URL from Backend
      const presignedRes = await axios.get('/api/public/uploads/presigned-url', {
        params: {
          fileType: file.type,
          fileSize: file.size,
          folder,
          host: window.location.host
        }
      });

      if (presignedRes.data?.success) {
        const { uploadUrl, publicUrl } = presignedRes.data.data;

        // 2. Direct S3 Upload via PUT Command
        await axios.put(uploadUrl, file, {
          headers: { 'Content-Type': file.type }
        });

        setPublicUrl(publicUrl);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to upload document. Please ensure file type is valid.');
    } finally {
      setUploading(false);
    }
  };

  // Interactive Digital Signature Drawing Event Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#4f46e5'; // Premium indigo stroke
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  // Convert Drawn canvas signature to blob, get public presigned URL and upload to S3
  const uploadSignatureBlob = async (): Promise<string> => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSigned) return '';

    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return resolve('');
        try {
          const presignedRes = await axios.get('/api/public/uploads/presigned-url', {
            params: {
              fileType: 'image/png',
              folder: 'signatures',
              host: window.location.host
            }
          });

          if (presignedRes.data?.success) {
            const { uploadUrl, publicUrl } = presignedRes.data.data;
            await axios.put(uploadUrl, blob, {
              headers: { 'Content-Type': 'image/png' }
            });
            resolve(publicUrl);
          } else {
            resolve('');
          }
        } catch (e) {
          console.warn('⚠️ Signature S3 upload failed, falling back to empty:', e);
          resolve('');
        }
      }, 'image/png');
    });
  };

  const handleReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReleaseError('');
    setSubmittingRelease(true);

    try {
      let signatureUrl = '';
      if (hasSigned) {
        signatureUrl = await uploadSignatureBlob();
      }

      const res = await axios.post('/api/public/vehicles/release-request', {
        vehicleId: searchResult.id,
        releaseType,
        releaseLetter: uploadedLetter,
        customerIdProof: uploadedId,
        paymentReceipt: uploadedReceipt,
        customerSign: signatureUrl,
        host: window.location.host
      });

      if (res.data?.success) {
        setReleaseSuccess(true);
        // Refresh vehicle state
        const refreshedRes = await axios.get('/api/public/vehicles/track', {
          params: {
            vehicleNumber,
            verificationCode,
            host: window.location.host
          }
        });
        if (refreshedRes.data?.success) {
          setSearchResult(refreshedRes.data.data);
        }
      }
    } catch (err: any) {
      setReleaseError(err.response?.data?.error || 'Failed to submit release request. Try again.');
    } finally {
      setSubmittingRelease(false);
    }
  };

  // Dynamic progress stepper helper
  const getStepProgress = (status: string) => {
    if (status === 'RELEASED') return 3;
    if (status === 'GATE_PASS_ISSUED') return 3;
    if (status === 'PAKKA') return 2;
    return 1; // Default enters Kachha
  };

  const activeStep = searchResult ? getStepProgress(searchResult.yardStatus) : 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden pb-12 relative">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      {/* 1. Header Branding Navigation Bar */}
      <header className="max-w-7xl w-full mx-auto px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-900/60 z-30 select-none relative">
        <div className="flex items-center space-x-3">
          {tenantBranding?.logo ? (
            <div className="p-1 bg-slate-900 border border-slate-800 rounded-xl">
              <img src={tenantBranding.logo} alt="Yard Logo" className="w-9 h-9 object-cover rounded-lg" />
            </div>
          ) : (
            <div className="p-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl">
              <Warehouse className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-sm font-black uppercase tracking-wider text-white">
              {tenantBranding ? tenantBranding.yardName : 'Yard Management System'}
            </h1>
            <p className="text-[10px] text-slate-500 font-bold tracking-tight">
              {tenantBranding ? tenantBranding.address : 'Multi-Tenant Industrial Operations Portal'}
            </p>
          </div>
        </div>

        <button 
          onClick={onBackToLogin}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-300 transition-colors text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Staff Login</span>
        </button>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 pt-8 z-20 flex flex-col items-center">
        
        {/* 2. Vehicle Search Container if no active result found */}
        {!searchResult ? (
          <div className="w-full max-w-lg mt-8 bg-slate-900 border border-slate-800/80 p-8 rounded-[28px] shadow-2xl relative">
            <div className="text-center space-y-2 mb-8">
              <div className="p-3 bg-primary/10 border border-primary/20 text-primary rounded-2xl inline-block">
                <Search className="w-6 h-6 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white uppercase">Track Seized Vehicle</h2>
              <p className="text-xs text-slate-400 font-semibold leading-relaxed px-6">
                Enter your vehicle registration plate number and security verification code to view real-time inventory checklists and outstanding dues.
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="space-y-5">
              {searchError && (
                <div className="bg-rose-950/30 border border-rose-900/40 text-rose-400 p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2.5 animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle Registration Number</label>
                <input
                  type="text"
                  required
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  placeholder="e.g. MH-12-PQ-8899"
                  className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-bold tracking-wider placeholder-slate-600 uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Chassis / Engine Number Verification</label>
                  <div className="group relative">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500 hover:text-slate-400 cursor-pointer" />
                    <div className="absolute right-0 bottom-6 hidden group-hover:block bg-slate-800 text-[9px] text-slate-300 font-medium p-2.5 rounded-lg border border-slate-700 w-48 shadow-xl z-50">
                      Security Check: Enter the exact last 5 digits of your vehicle's Chassis Number, Engine Number, or registered customer phone number.
                    </div>
                  </div>
                </div>
                <input
                  type="password"
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter last 5 digits"
                  className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-bold tracking-widest placeholder-slate-600"
                />
              </div>

              <button
                type="submit"
                disabled={searching}
                className="w-full bg-primary hover:bg-primary/95 disabled:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 transition-all text-xs flex items-center justify-center space-x-2"
              >
                {searching ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Locating vehicle profile...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search Seizure Database</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          
          // 3. Complete Loaded Vehicle Profile Tracking Dashboard
          <div className="w-full space-y-6">
            
            {/* Top Overview Quick Status Bar */}
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-indigo-950/40 border border-indigo-900/40 text-indigo-400 rounded-2xl">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h2 className="text-lg font-black tracking-tight text-white uppercase">{searchResult.vehicleNumber}</h2>
                    <span className="bg-primary/10 border border-primary/20 text-primary text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full">
                      {searchResult.brand} {searchResult.model}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-semibold tracking-tight mt-0.5">
                    Chassis: {searchResult.chassisNumber ? `••••••••${searchResult.chassisNumber.substring(searchResult.chassisNumber.length - 6)}` : 'N/A'} • Engine: {searchResult.engineNumber ? `••••••••${searchResult.engineNumber.substring(searchResult.engineNumber.length - 6)}` : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Reset Search Button */}
              <button 
                onClick={() => { setSearchResult(null); setVehicleNumber(''); setVerificationCode(''); }}
                className="self-start md:self-auto px-4 py-2 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-slate-300 transition-colors text-[10px] font-bold uppercase tracking-wider shrink-0"
              >
                Track Another Vehicle
              </button>
            </div>

            {/* Stepper Progress Map */}
            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl shadow-xl space-y-4">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Real-time Location Status Map</span>
              
              <div className="relative pt-2 pb-6 px-4">
                {/* Stepper active bar */}
                <div className="absolute left-10 right-10 top-6 h-1 bg-slate-800 -z-10 rounded-full">
                  <div 
                    className="h-full bg-indigo-500 transition-all duration-500 rounded-full"
                    style={{ width: activeStep === 1 ? '0%' : activeStep === 2 ? '50%' : '100%' }}
                  />
                </div>

                <div className="flex justify-between items-center text-center">
                  {/* Step 1: Kachha */}
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md border transition-all ${
                      activeStep >= 1 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}>
                      1
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Seizure Logged</span>
                    <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider">Kachha Status</span>
                  </div>

                  {/* Step 2: Pakka */}
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md border transition-all ${
                      activeStep >= 2 ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}>
                      {activeStep > 2 ? <Check className="w-4 h-4" /> : '2'}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Inventory Verified</span>
                    <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-wider">Pakka Status</span>
                  </div>

                  {/* Step 3: Released */}
                  <div className="flex flex-col items-center space-y-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-md border transition-all ${
                      activeStep >= 3 ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}>
                      {activeStep >= 3 ? <Check className="w-4 h-4" /> : '3'}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Released Out</span>
                    <span className="text-[8px] text-emerald-400 font-bold uppercase tracking-wider">Dispatched Pass</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Tabs Layout */}
            <div className="flex border-b border-slate-850/60 shrink-0">
              <button
                onClick={() => setActiveTab('status')}
                className={`px-6 py-3 border-b-2 font-bold uppercase tracking-wider text-xs transition-colors ${
                  activeTab === 'status' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Yard Inventory & Dues
              </button>
              {searchResult.yardStatus !== 'RELEASED' && (
                <button
                  onClick={() => setActiveTab('release')}
                  className={`px-6 py-3 border-b-2 font-bold uppercase tracking-wider text-xs transition-colors ${
                    activeTab === 'release' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-300'
                  }`}
                >
                  Digital Release Request
                </button>
              )}
            </div>

            {/* Tab Panel Content */}
            <div className="space-y-6">
              {activeTab === 'status' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Left Column: Handover details and accessories list */}
                  <div className="md:col-span-2 space-y-6">
                    
                    {/* Vehicle General Profile Details Grid */}
                    <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl shadow-xl space-y-4">
                      <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center space-x-2">
                        <Info className="w-4 h-4 text-primary" />
                        <span>Seizure Details</span>
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900/80">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Vehicle Class</p>
                          <p className="text-slate-200 mt-1 uppercase">
                            {searchResult.vehicleType === 'TW' ? '2-Wheeler' : 
                             searchResult.vehicleType === 'THREE_W' ? '3-Wheeler' : 
                             searchResult.vehicleType === 'FW' ? '4-Wheeler (Car/SUV)' : 'Commercial Truck'}
                          </p>
                        </div>
                        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900/80">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Seizing Bank Node</p>
                          <p className="text-slate-200 mt-1">{searchResult.bankName}</p>
                        </div>
                        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900/80">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Seizure Agency</p>
                          <p className="text-slate-200 mt-1">{searchResult.repoAgency || 'Standard Recovery'}</p>
                        </div>
                        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-900/80">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Yard Entrance Date</p>
                          <p className="text-slate-200 mt-1 flex items-center space-x-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{new Date(searchResult.entryDate).toLocaleDateString()}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Accessories checklist items list */}
                    <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl shadow-xl space-y-4">
                      <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                        <span>Accessories Checklist</span>
                      </h3>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {searchResult.inventory?.map((item: any) => (
                          <div 
                            key={item.id} 
                            className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                              item.isPresent 
                                ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300' 
                                : 'bg-rose-950/10 border-rose-900/20 text-rose-400'
                            }`}
                          >
                            <span className="uppercase">{item.itemName}</span>
                            {item.isPresent ? (
                              <div className="p-0.5 bg-emerald-900/40 text-emerald-400 rounded-md shrink-0">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            ) : (
                              <div className="p-0.5 bg-rose-950/60 text-rose-500 rounded-md shrink-0">
                                <X className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Inspection photos grid */}
                    {searchResult.photos && searchResult.photos.length > 0 && (
                      <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl shadow-xl space-y-4">
                        <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center space-x-2">
                          <Camera className="w-4 h-4 text-primary" />
                          <span>Check-in Photographs</span>
                        </h3>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {searchResult.photos.map((photo: any) => (
                            <div 
                              key={photo.id}
                              onClick={() => setLightboxPhoto(photo.s3Url)}
                              className="group aspect-video rounded-xl bg-slate-950 border border-slate-900 overflow-hidden relative cursor-zoom-in"
                            >
                              <img 
                                src={photo.s3Url} 
                                alt={photo.photoType} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-350"
                              />
                              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Search className="w-5 h-5 text-white" />
                              </div>
                              <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-slate-950/80 border border-slate-800 text-[8px] uppercase font-black text-slate-300 rounded">
                                {photo.photoType.replace('_', ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Real-time Accrued Parking Charges / Dues statement */}
                  <div className="space-y-6">
                    <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
                      {/* Abstract decorative graphic */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>

                      <h3 className="text-xs uppercase font-extrabold text-slate-400 tracking-wider flex items-center space-x-2">
                        <DollarSign className="w-4 h-4 text-primary" />
                        <span>Parking Dues Summary</span>
                      </h3>

                      {searchResult.billing ? (
                        <div className="space-y-5 text-xs font-semibold">
                          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-900 text-center">
                            <span className="text-[9px] uppercase font-extrabold text-slate-500 tracking-wider block">Total Outstanding Balance</span>
                            <span className="text-3xl font-black text-white block mt-1 tracking-tight">
                              ₹{searchResult.billing.paymentStatus === 'PAID' ? '0.00' : (searchResult.billing.totalAmount - searchResult.billing.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                            
                            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider mt-3 bg-slate-900 border border-slate-800/80">
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                searchResult.billing.paymentStatus === 'PAID' ? 'bg-emerald-500 animate-ping' : 'bg-rose-500 animate-pulse'
                              }`}></span>
                              <span className={searchResult.billing.paymentStatus === 'PAID' ? 'text-emerald-400' : 'text-rose-400'}>
                                {searchResult.billing.paymentStatus === 'PAID' ? 'Dues Cleared' : 'Pending Payment'}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2.5 pt-2 border-t border-slate-850/60">
                            <div className="flex justify-between">
                              <span className="text-slate-500">Daily Tariff Rate</span>
                              <span className="text-slate-200">₹{searchResult.billing.dailyRate.toFixed(2)}/day</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Total Seizure Days</span>
                              <span className="text-slate-200">{searchResult.billing.totalDays} Days</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">Accumulated Bill</span>
                              <span className="text-slate-200">₹{searchResult.billing.totalAmount.toFixed(2)}</span>
                            </div>
                            {searchResult.billing.paidAmount > 0 && (
                              <div className="flex justify-between text-emerald-400">
                                <span>Amount Paid</span>
                                <span>- ₹{searchResult.billing.paidAmount.toFixed(2)}</span>
                              </div>
                            )}
                          </div>

                          {/* Gate pass download once dispatched */}
                          {searchResult.release && searchResult.release.gatePassUrl && (
                            <a
                              href={searchResult.release.gatePassUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full bg-emerald-600 hover:bg-emerald-550 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-950/20 text-xs flex items-center justify-center space-x-2"
                            >
                              <Download className="w-4 h-4" />
                              <span>Download Gate Pass PDF</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed">No billing ledger attached to this vehicle.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Release request module */}
              {activeTab === 'release' && searchResult.yardStatus !== 'RELEASED' && (
                <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800/80 p-8 rounded-3xl shadow-xl relative">
                  
                  {releaseSuccess ? (
                    <div className="text-center space-y-4 py-8">
                      <div className="w-16 h-16 bg-emerald-950/40 border border-emerald-900/40 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-950/20 animate-bounce">
                        <Check className="w-8 h-8 stroke-[3]" />
                      </div>
                      <h3 className="text-lg font-black uppercase text-white tracking-wide">Release Request Submitted!</h3>
                      <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-sm mx-auto px-4">
                        Your release application, documents, and digital signature have been securely uploaded to our database. Our yard officers will verify your paperwork shortly.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleReleaseSubmit} className="space-y-6">
                      <div className="space-y-1 mb-4 text-center">
                        <h3 className="text-sm font-black text-white uppercase tracking-wider">Release Request Paperwork</h3>
                        <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                          Submit authorization forms and sign electronically to initiate the check-out process.
                        </p>
                      </div>

                      {releaseError && (
                        <div className="bg-rose-950/30 border border-rose-900/40 text-rose-400 p-3.5 rounded-xl text-xs font-semibold flex items-center space-x-2.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{releaseError}</span>
                        </div>
                      )}

                      {/* Release Type Field */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Release Type</label>
                        <select
                          value={releaseType}
                          onChange={(e) => setReleaseType(e.target.value)}
                          className="w-full bg-slate-950 text-slate-200 px-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-bold"
                        >
                          <option value="BANK">Bank Authorized Repossession Release</option>
                          <option value="CUSTOMER">Direct Customer Handover / Clearance</option>
                          <option value="EXECUTIVE">Authorized Agent Handover</option>
                        </select>
                      </div>

                      {/* Document upload drop zones grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* 1. Bank Release letter */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bank Release Letter</span>
                          <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl bg-slate-950/60 p-4 transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, 'release_letters', setUploadingLetter, setUploadedLetter);
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            {uploadingLetter ? (
                              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            ) : uploadedLetter ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <UploadCloud className="w-5 h-5 text-slate-500" />
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wider mt-2 block text-slate-400">
                              {uploadingLetter ? 'Uploading...' : uploadedLetter ? 'File Stored' : 'Select Letter'}
                            </span>
                          </div>
                        </div>

                        {/* 2. Customer ID proof */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer Identity card</span>
                          <div className="relative border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl bg-slate-950/60 p-4 transition-colors flex flex-col items-center justify-center text-center cursor-pointer">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(file, 'id_proofs', setUploadingId, setUploadedId);
                              }}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            {uploadingId ? (
                              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                            ) : uploadedId ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <UploadCloud className="w-5 h-5 text-slate-500" />
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wider mt-2 block text-slate-400">
                              {uploadingId ? 'Uploading...' : uploadedId ? 'File Stored' : 'Select ID Card'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 3. HTML5 Canvas signature pad */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Customer Digital Signature</label>
                          {hasSigned && (
                            <button
                              type="button"
                              onClick={clearSignature}
                              className="text-[9px] font-extrabold uppercase tracking-wider text-rose-500 hover:underline"
                            >
                              Clear Signature
                            </button>
                          )}
                        </div>

                        <div className="border border-slate-800 rounded-xl bg-slate-950 overflow-hidden relative">
                          <canvas
                            ref={canvasRef}
                            width={500}
                            height={150}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                            className="w-full h-[150px] bg-slate-950/60 cursor-crosshair block"
                          />
                          {!hasSigned && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[10px] uppercase font-bold text-slate-600 tracking-wider">
                              Draw signature in this box
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submittingRelease || uploadingLetter || uploadingId || uploadingReceipt}
                        className="w-full bg-primary hover:bg-primary/95 disabled:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20 text-xs flex items-center justify-center space-x-2"
                      >
                        {submittingRelease ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Uploading signed agreements to S3...</span>
                          </>
                        ) : (
                          <>
                            <Signature className="w-4 h-4" />
                            <span>Submit Signed Release Application</span>
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 4. Full screen interactive photography Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4 select-none animate-fade-in">
          <button 
            onClick={() => setLightboxPhoto(null)}
            className="absolute top-6 right-6 p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
          
          <img 
            src={lightboxPhoto} 
            alt="Check-in Zoom View" 
            className="max-w-full max-h-[80vh] object-contain rounded-2xl border border-slate-800 shadow-2xl animate-scale-in"
          />
        </div>
      )}
    </div>
  );
};
export default CustomerPortal;
