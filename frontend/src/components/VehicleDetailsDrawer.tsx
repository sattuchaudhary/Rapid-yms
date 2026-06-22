import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { compressImage } from '../utils/imageCompressor';
import { UnifiedReleaseModal } from './UnifiedReleaseModal';
import {
  ChevronLeft,
  X,
  Edit,
  Trash2,
  Layers,
  Calendar,
  Clock,
  DollarSign,
  User,
  Phone,
  FileText,
  FileCheck,
  ShieldCheck,
  Camera,
  Award,
  UserCheck,
  CreditCard,
  Printer,
  AlertTriangle,
  Share2,
  Copy,
  MessageSquare,
  Mail,
  Sparkles,
  Leaf
} from 'lucide-react';

interface VehicleDetailsDrawerProps {
  vehicle: any;
  onClose: () => void;
  onRefreshList: () => void;
}

export const VehicleDetailsDrawer: React.FC<VehicleDetailsDrawerProps> = ({
  vehicle,
  onClose,
  onRefreshList,
}) => {
  const { user } = useAuthStore();
  const toast = useToastStore();

  // Local state for loaded vehicle (so updates reflect immediately inside the drawer)
  const [vehicleDetails, setVehicleDetails] = useState<any>(vehicle);
  const [billingInfo, setBillingInfo] = useState<any | null>(null);
  
  // Tab control state
  const [activeTab, setActiveTab] = useState<'dossier' | 'financials' | 'media'>('dossier');

  // Sharing dropdown state
  const [isShareDropdownOpen, setIsShareDropdownOpen] = useState(false);

  // Unified Release Modal state
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);

  // Lightbox and edit modal states
  const [activeLightboxPhoto, setActiveLightboxPhoto] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [editFormData, setEditFormData] = useState({
    vehicleNumber: '',
    chassisNumber: '',
    engineNumber: '',
    brand: '',
    model: '',
    color: '',
    bankName: '',
    repoAgency: '',
    customerName: '',
    customerPhone: '',
    yardLocationId: '',
    yardStatus: 'KACHHA' as any,
  });

  // Action states (Billing payment & release processes)
  const [paymentAmount, setPaymentAmount] = useState('');
  const [approvedTillDate, setApprovedTillDate] = useState('');
  const [handoverPhotos, setHandoverPhotos] = useState({
    p1: '', p2: '', p3: '',
  });

  // Photo re-upload & Repo Kit states
  const [selectedUploadAngle, setSelectedUploadAngle] = useState('');
  const [uploadingGalleryPhoto, setUploadingGalleryPhoto] = useState(false);
  const [repoKitDateInput, setRepoKitDateInput] = useState(new Date().toISOString().substring(0, 10));
  const [repoKitPhotos, setRepoKitPhotos] = useState<Record<string, string>>({
    pre_intimation: '',
    post_intimation: '',
    yard_inventory: '',
    bank_inventory: '',
  });
  const [uploadingRepoKitPhoto, setUploadingRepoKitPhoto] = useState<Record<string, boolean>>({
    pre_intimation: false,
    post_intimation: false,
    yard_inventory: false,
    bank_inventory: false,
  });

  // Load live billing info and details when component mounts or vehicle changes
  useEffect(() => {
    fetchLiveDetails();
    fetchLiveBilling();
  }, [vehicle.id]);

  const fetchLiveDetails = async () => {
    try {
      const res = await api.get(`/vehicles/${vehicle.id}`);
      if (res.data?.success) {
        setVehicleDetails(res.data.data);
      }
    } catch (err) {
      console.error('Failed to reload details', err);
    }
  };

  const fetchLiveBilling = async () => {
    try {
      const res = await api.get(`/billing/${vehicle.id}`);
      if (res.data?.success) {
        setBillingInfo(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load billing details', err);
      setBillingInfo(null);
    }
  };

  // 1. Kachha to Pakka Transition
  const handleTransitionToPakkaWithDocs = async (e: React.FormEvent) => {
    e.preventDefault();
    const missingDocs = Object.entries(repoKitPhotos).filter(([_, url]) => !url);
    if (missingDocs.length > 0) {
      toast.error('Please upload all 4 mandatory Repo Kit photos first!');
      return;
    }

    try {
      // Register all 4 photos in DB
      await Promise.all(
        Object.entries(repoKitPhotos).map(([type, url]) =>
          api.post(`/vehicles/${vehicleDetails.id}/photos`, {
            photoType: type,
            s3Url: url,
            lat: 19.076,
            lng: 72.877,
          })
        )
      );

      // Transition vehicle to PAKKA status
      const res = await api.put(`/vehicles/${vehicleDetails.id}`, {
        yardStatus: 'PAKKA',
        repoKitDate: repoKitDateInput,
        pakkaDate: repoKitDateInput,
      });

      if (res.data?.success) {
        toast.success('Repo Kit submitted! Parking billing is now ACTIVE.');
        setRepoKitPhotos({
          pre_intimation: '',
          post_intimation: '',
          yard_inventory: '',
          bank_inventory: '',
        });

        await fetchLiveDetails();
        await fetchLiveBilling();
        onRefreshList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to complete Repo Kit transition');
    }
  };

  // 2. Request Release
  const handleRequestRelease = async () => {
    try {
      const res = await api.post(`/releases/${vehicleDetails.id}/request`, {
        releaseType: vehicleDetails.yardStatus,
        releaseLetter: 'https://yms-documents.s3.amazonaws.com/release_letter.pdf',
        paymentReceipt: 'https://yms-documents.s3.amazonaws.com/receipt.pdf',
      });
      if (res.data?.success) {
        toast.success('Release request successfully submitted!');
        await fetchLiveDetails();
        onRefreshList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to request release');
    }
  };

  // 3. Approve Release
  const handleApproveRelease = async () => {
    try {
      const res = await api.put(`/releases/${vehicleDetails.id}/approve`);
      if (res.data?.success) {
        toast.success('Release approved successfully!');
        await fetchLiveDetails();
        onRefreshList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve release');
    }
  };

  // 4. Pay Billing & Verify
  const handlePaymentAndVerification = async () => {
    if (!paymentAmount) return;
    try {
      const resPayment = await api.post(`/billing/${vehicleDetails.id}/pay`, {
        amount: parseFloat(paymentAmount),
        approvedTillDate: approvedTillDate || undefined,
      });

      if (resPayment.data?.success) {
        await api.put(`/releases/${vehicleDetails.id}/verify-payment`);
        toast.success('Payment recorded & verified successfully!');
        setPaymentAmount('');
        await fetchLiveDetails();
        await fetchLiveBilling();
        onRefreshList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to process payment verification');
    }
  };

  // 5. Issue Gate Pass
  const handleIssueGatePass = async () => {
    try {
      const res = await api.put(`/releases/${vehicleDetails.id}/gate-pass`);
      if (res.data?.success) {
        toast.success('Gate Pass issued successfully! Ready for Guard Exit Verification.');
        await fetchLiveDetails();
        onRefreshList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to issue Gate Pass');
    }
  };

  // 6. Complete Handover delivery (Guard Exit)
  const handleHandoverComplete = async () => {
    try {
      const res = await api.put(`/releases/${vehicleDetails.id}/handover`, {
        handoverPhoto1: handoverPhotos.p1 || 'https://images.unsplash.com/photo-1542282088-fe8426682b8f',
        handoverPhoto2: handoverPhotos.p2 || 'https://images.unsplash.com/photo-1542282088-fe8426682b8f',
        handoverPhoto3: handoverPhotos.p3 || 'https://images.unsplash.com/photo-1542282088-fe8426682b8f',
      });
      if (res.data?.success) {
        toast.success('Gate Out completed successfully! Vehicle released from slot.');
        onClose();
        onRefreshList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to complete handover');
    }
  };

  // 7. Delete Vehicle
  const handleDeleteVehicle = async () => {
    const confirmMsg = `Are you absolutely sure you want to permanently delete vehicle profile ${vehicleDetails.vehicleNumber}?\n\nThis will permanently remove the vehicle record, clear all photos, free up slot ${vehicleDetails.yardLocation?.slot || 'N/A'}, and cannot be undone!`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.delete(`/vehicles/${vehicleDetails.id}`);
      if (res.data?.success) {
        toast.success(`Vehicle profile ${vehicleDetails.vehicleNumber} deleted.`);
        onClose();
        onRefreshList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete vehicle profile');
    }
  };

  // Edit Modal handlers
  const handleOpenEditModal = async () => {
    setEditFormData({
      vehicleNumber: vehicleDetails.vehicleNumber || '',
      chassisNumber: vehicleDetails.chassisNumber || '',
      engineNumber: vehicleDetails.engineNumber || '',
      brand: vehicleDetails.brand || '',
      model: vehicleDetails.model || '',
      color: vehicleDetails.color || '',
      bankName: vehicleDetails.bankName || '',
      repoAgency: vehicleDetails.repoAgency || '',
      customerName: vehicleDetails.customerName || '',
      customerPhone: vehicleDetails.customerPhone || '',
      yardLocationId: vehicleDetails.yardLocationId || '',
      yardStatus: vehicleDetails.yardStatus || 'KACHHA',
    });

    try {
      setLoadingLocations(true);
      const res = await api.get('/vehicles/locations');
      if (res.data?.success) {
        setLocations(res.data.data);
      }
    } catch (err: any) {
      toast.error('Failed to load yard slots for re-allocation');
    } finally {
      setLoadingLocations(false);
      setIsEditModalOpen(true);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const res = await api.put(`/vehicles/${vehicleDetails.id}`, editFormData);
      if (res.data?.success) {
        toast.success('Vehicle profile updated successfully!');
        setIsEditModalOpen(false);
        await fetchLiveDetails();
        await fetchLiveBilling();
        onRefreshList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update vehicle details');
    } finally {
      setSavingEdit(false);
    }
  };

  // Gallery photo capture
  const handleCaptureGalleryPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUploadAngle) return;

    setUploadingGalleryPhoto(true);
    try {
      const compressedFile = await compressImage(file, 1280, 0.8);
      const res = await api.get(`/uploads/presigned-url?fileType=${compressedFile.type}&fileSize=${compressedFile.size}&folder=vehicles`);
      if (res.data?.success) {
        const { uploadUrl, publicUrl } = res.data.data;
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': compressedFile.type },
          body: compressedFile,
        });

        if (!uploadRes.ok) throw new Error('Cloud storage upload failed');

        const photoRes = await api.post(`/vehicles/${vehicleDetails.id}/photos`, {
          photoType: selectedUploadAngle,
          s3Url: publicUrl,
          lat: 19.076,
          lng: 72.877,
        });

        if (photoRes.data?.success) {
          toast.success(`${selectedUploadAngle.toUpperCase()} view photo uploaded successfully!`);
          await fetchLiveDetails();
          onRefreshList();
        }
      }
    } catch (err: any) {
      toast.error(`Image upload failed: ${err.message || err}`);
    } finally {
      setUploadingGalleryPhoto(false);
      setSelectedUploadAngle('');
    }
  };

  // Upload Repo Kit photo
  const handleUploadRepoKitPhoto = async (docType: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingRepoKitPhoto((prev) => ({ ...prev, [docType]: true }));
    try {
      const compressedFile = await compressImage(file, 1280, 0.8);
      const res = await api.get(`/uploads/presigned-url?fileType=${compressedFile.type}&fileSize=${compressedFile.size}&folder=repokit`);
      if (res.data?.success) {
        const { uploadUrl, publicUrl } = res.data.data;
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': compressedFile.type },
          body: compressedFile,
        });

        if (!uploadRes.ok) throw new Error('Repo kit file upload failed');

        setRepoKitPhotos((prev) => ({ ...prev, [docType]: publicUrl }));
        toast.success(`${docType.replace('_', ' ').toUpperCase()} uploaded!`);
      }
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message || err}`);
    } finally {
      setUploadingRepoKitPhoto((prev) => ({ ...prev, [docType]: false }));
    }
  };

  // Delete inspection photo
  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('Are you absolutely sure you want to permanently delete this inspection photo?')) return;
    try {
      const res = await api.delete(`/vehicles/${vehicleDetails.id}/photos/${photoId}`);
      if (res.data?.success) {
        toast.success('Inspection photo deleted successfully.');
        const updatedPhotos = vehicleDetails.photos.filter((p: any) => p.id !== photoId);
        setVehicleDetails({ ...vehicleDetails, photos: updatedPhotos });
        onRefreshList();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete inspection photo');
    }
  };

  // Paperless Sharing Actions
  const handleCopyLink = () => {
    const secureUrl = `${window.location.origin}/share/vehicle/${vehicleDetails.id}`;
    navigator.clipboard.writeText(secureUrl);
    toast.success('Paperless digital receipt link copied to clipboard!');
    setIsShareDropdownOpen(false);
  };

  const handleShareWhatsApp = () => {
    const text = `*YardPro Digital Gate Pass*%0A%0A*Vehicle:* ${vehicleDetails.vehicleNumber}%0A*Brand/Model:* ${vehicleDetails.brand || ''} ${vehicleDetails.model || ''}%0A*Status:* ${vehicleDetails.yardStatus}%0A*Slot:* ${vehicleDetails.yardLocation?.slot || 'Unallocated'}%0A*Outstanding Due:* \u20B9${billingInfo?.totalAmount || 0}%0A%0A_Digital verification link:_ ${window.location.origin}/share/vehicle/${vehicleDetails.id}`;
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    setIsShareDropdownOpen(false);
  };

  const handleShareEmail = () => {
    const subject = `YardPro Digital Dossier - ${vehicleDetails.vehicleNumber}`;
    const body = `Hi,\n\nPlease find the digital yard details for vehicle: ${vehicleDetails.vehicleNumber}.\n\n- Brand/Model: ${vehicleDetails.brand || ''} ${vehicleDetails.model || ''}\n- Status: ${vehicleDetails.yardStatus}\n- Allocated Slot: ${vehicleDetails.yardLocation?.slot || 'Unallocated'}\n- Dynamic Parking Days: ${billingInfo?.totalDays || 0} Days\n- Amount Due: Rs. ${billingInfo?.totalAmount || 0}\n\nView details: ${window.location.origin}/share/vehicle/${vehicleDetails.id}\n\nThank you for choosing eco-friendly paperless operations.`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    setIsShareDropdownOpen(false);
  };

  // Print Ticket Handler
  const handlePrintTicket = () => {
    const printWindow = window.open('', '_blank', 'width=450,height=650');
    if (!printWindow) {
      toast.error('Pop-up blocked! Please enable pop-ups to print the Gate Pass receipt.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Gate Pass - ${vehicleDetails.vehicleNumber}</title>
          <style>
            body { font-family: 'Courier New', Courier, monospace; padding: 25px; color: #111; background: #fff; margin: 0; }
            .ticket { border: 2px dashed #000; padding: 20px; max-width: 320px; margin: 0 auto; text-align: center; border-radius: 8px; }
            .header { font-weight: 900; font-size: 18px; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 1px; }
            .subtitle { font-size: 9px; color: #555; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 2px; }
            .divider { border-top: 1px dashed #000; margin: 12px 0; }
            .field-row { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px; }
            .label { font-weight: normal; color: #444; }
            .value { font-weight: bold; text-transform: uppercase; }
            .barcode-section { display: flex; flex-direction: column; align-items: center; justify-content: center; border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 15px 0; padding: 8px 0; }
            .barcode-lines { display: flex; align-items: stretch; gap: 2px; height: 25px; }
            .line-thin { width: 1px; background: #000; }
            .line-medium { width: 2px; background: #000; }
            .line-thick { width: 4px; background: #000; }
            .barcode-text { font-size: 8px; margin-top: 4px; letter-spacing: 1px; }
            .footer-msg { font-size: 10px; font-weight: bold; margin-top: 15px; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="header">YARDPRO PARKING</div>
            <div class="subtitle">official gate ticket</div>
            <div class="divider"></div>
            <div class="field-row"><span class="label">GP NO:</span><span class="value">${vehicleDetails.release?.gatePassNumber || 'GP-VERIFIED'}</span></div>
            <div class="field-row"><span class="label">REG NO:</span><span class="value">${vehicleDetails.vehicleNumber}</span></div>
            <div class="field-row"><span class="label">BANK:</span><span class="value">${vehicleDetails.bankName}</span></div>
            <div class="field-row"><span class="label">DAYS PARKED:</span><span class="value">${vehicleDetails.billing?.totalDays || 1} DAYS</span></div>
            <div class="field-row"><span class="label">DAILY RATE:</span><span class="value">\u20B9${vehicleDetails.billing?.dailyRate || 250}/day</span></div>
            <div class="field-row"><span class="label">TOTAL VALUE:</span><span class="value">\u20B9${vehicleDetails.billing?.totalAmount?.toLocaleString('en-IN') || 0}</span></div>
            <div class="field-row"><span class="label">SETTLEMENT:</span><span class="value">✓ CONFIRMED DIGITAL</span></div>
            <div class="barcode-section">
              <div class="barcode-lines">
                <span class="line-thin"></span><span class="line-thick"></span><span class="line-thin"></span>
                <span class="line-medium"></span><span class="line-thick"></span><span class="line-thin"></span>
                <span class="line-medium"></span><span class="line-thick"></span><span class="line-thin"></span>
              </div>
              <div class="barcode-text">${vehicleDetails.release?.gatePassNumber || 'GP-VERIFIED'}</div>
            </div>
            <div class="footer-msg">★ THINK GREEN - SHARE DIGITAL GATE PASS ★</div>
          </div>
          <script>
            window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 500); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Determine active step of workflow
  const getWorkflowStep = () => {
    const status = vehicleDetails.yardStatus;
    const relStatus = vehicleDetails.release?.releaseStatus;
    
    if (status === 'KACHHA') return 1;
    if (status === 'PAKKA' && !vehicleDetails.release) return 2;
    if (relStatus === 'REQUESTED') return 3;
    if (relStatus === 'APPROVED') return 4;
    if (relStatus === 'PAYMENT_VERIFIED') return 5;
    if (relStatus === 'GATE_PASS_ISSUED') return 6;
    if (relStatus === 'RELEASED') return 7;
    return 2;
  };

  const currentStep = getWorkflowStep();

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col select-none overflow-y-auto animate-fade-in font-sans">
      
      {/* Premium Sticky Eco Gradient Header */}
      <div className="bg-gradient-to-r from-emerald-950 via-teal-905 to-slate-900 text-white px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-40 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shadow-lg border-b border-emerald-900/30">
        <div className="flex items-center justify-between sm:justify-start space-x-4 w-full sm:w-auto">
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-white transition-all flex items-center space-x-1.5 border border-emerald-800/30 text-xs font-semibold uppercase tracking-wider"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Stock Console</span>
            </button>
            
            <div className="h-6 w-px bg-emerald-800/50 hidden sm:block"></div>
            
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight font-mono text-emerald-50">{vehicleDetails.vehicleNumber}</h3>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[8px] sm:text-[9px] uppercase tracking-wider ${
                  vehicleDetails.yardStatus === 'KACHHA'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : vehicleDetails.yardStatus === 'PAKKA'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                }`}>
                  {vehicleDetails.yardStatus}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-emerald-300/80 font-medium mt-0.5">
                {vehicleDetails.brand || 'Unknown'} {vehicleDetails.model || ''} — Slot: <strong className="text-white font-mono">{vehicleDetails.yardLocation?.slot || 'Unallocated'}</strong>
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="sm:hidden p-2 rounded-xl bg-emerald-900/40 text-emerald-300 hover:text-white border border-emerald-800/30 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Dynamic Actions */}
        <div className="flex items-center justify-end space-x-2 w-full sm:w-auto border-t border-emerald-900/30 pt-2 sm:pt-0 sm:border-t-0">
          {/* Digital Share Button */}
          <div className="relative">
            <button
              onClick={() => setIsShareDropdownOpen(!isShareDropdownOpen)}
              className="p-2 rounded-xl bg-emerald-800/40 hover:bg-emerald-800/60 text-emerald-300 hover:text-white border border-emerald-800/30 transition-all flex items-center space-x-1.5 text-xs font-bold uppercase"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden md:inline">Share Paperless</span>
            </button>
            
            {isShareDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white text-slate-800 shadow-xl border border-slate-100 py-2.5 z-50 animate-scale-in">
                <div className="px-4 py-1.5 border-b border-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-1">
                  <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Choose Paperless Share</span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-2 transition-colors"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copy Secure Share Link</span>
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-2 transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  <span>Share via WhatsApp</span>
                </button>
                <button
                  onClick={handleShareEmail}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-2 transition-colors"
                >
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span>Share via Email / SMS</span>
                </button>
              </div>
            )}
          </div>

          {(user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN') && (
            <>
              <button
                onClick={handleOpenEditModal}
                className="px-3 py-2 rounded-xl bg-emerald-800/40 hover:bg-emerald-850 text-emerald-300 hover:text-white border border-emerald-800/30 transition-all flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider"
              >
                <Edit className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
              <button
                onClick={handleDeleteVehicle}
                className="px-3 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-900/20 transition-all flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </>
          )}

          <button
            onClick={onClose}
            className="hidden sm:block p-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-white border border-emerald-800/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Workflow Progress Stepper (Eco-themed horizontal path) */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-4 shadow-sm select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-2 shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Exit Release Workflow</span>
          </div>
          
          <div className="flex items-center justify-between w-full overflow-x-auto gap-2 md:gap-4 pb-2 md:pb-0 scrollbar-none font-semibold text-[10px]">
            {[
              { step: 1, label: 'Kachha Entry' },
              { step: 2, label: 'Pakka Yard Storage' },
              { step: 3, label: 'Release Requested' },
              { step: 4, label: 'Approved' },
              { step: 5, label: 'Payment Done' },
              { step: 6, label: 'Gate Pass Issued' },
              { step: 7, label: 'Exited Yard' },
            ].map((s, idx) => {
              const isActive = currentStep === s.step;
              const isCompleted = currentStep > s.step;
              
              return (
                <React.Fragment key={s.step}>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] transition-all border ${
                      isActive 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/25 scale-105'
                        : isCompleted
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-250'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                      {isCompleted ? '✓' : s.step}
                    </span>
                    <span className={`uppercase tracking-wider ${
                      isActive ? 'text-emerald-700 font-extrabold' : isCompleted ? 'text-slate-600 font-bold' : 'text-slate-400'
                    }`}>
                      {s.label}
                    </span>
                  </div>
                  {idx < 6 && (
                    <div className={`h-0.5 min-w-[20px] flex-1 ${
                      isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Body Grid */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6 pb-24">
        
        {/* Sticky Sub-navigation tabs (Dossier, Financials, Media Gallery) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 select-none bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
          {[
            { id: 'dossier', label: '📋 Dossier & Specs' },
            { id: 'financials', label: '💰 Financials & Releases' },
            { id: 'media', label: '📷 Gallery & Checklists' }
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                  isSelected 
                    ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/50' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Dynamic Tab Switcher */}
        {activeTab === 'dossier' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Eco Impact Tracker Widget */}
            <div className="lg:col-span-3 bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100 p-5 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-600/10">
                  <Leaf className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-emerald-800 tracking-wider flex items-center">
                    YardPro Paperless Initiative
                    <span className="ml-2 px-2 py-0.5 rounded bg-emerald-200 text-emerald-850 font-extrabold text-[8px]">ACTIVE</span>
                  </h4>
                  <p className="text-[11px] text-emerald-700/90 font-medium mt-0.5">
                    By maintaining digital inspection photos, mobile signature authorization, and digital gate pass receipts, this vehicle profile has saved an estimated **0.84 kg of paper wood pulp** and **12.5 Liters of water**.
                  </p>
                </div>
              </div>
              <div className="hidden md:flex flex-col items-end shrink-0 select-none">
                <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest">Eco-Index Score</span>
                <span className="text-2xl font-black text-emerald-800 font-mono tracking-tight">98.5% A+</span>
              </div>
            </div>

            {/* Panel 1: Core Specifications & Yard Location */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-5 text-left">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <FileText className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Asset Details & Yard Spot
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Chassis Number</span>
                  <span className="font-mono text-slate-850 font-bold block mt-0.5 tracking-tight uppercase">{vehicleDetails.chassisNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Engine Number</span>
                  <span className="font-mono text-slate-850 font-bold block mt-0.5 tracking-tight uppercase">{vehicleDetails.engineNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Vehicle Category</span>
                  <span className="text-slate-850 font-bold block mt-0.5 uppercase">{vehicleDetails.vehicleType}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Body Color / Variant</span>
                  <span className="text-slate-850 font-bold block mt-0.5 uppercase">{vehicleDetails.color || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Finance Bank Client</span>
                  <span className="text-emerald-700 font-extrabold block mt-0.5 uppercase">{vehicleDetails.bankName}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Repo Partner Agency</span>
                  <span className="text-slate-850 font-bold block mt-0.5 uppercase">{vehicleDetails.repoAgency || 'Swift Agency'}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Repo Action Date</span>
                  <span className="text-slate-850 block mt-0.5">
                    {new Date(vehicleDetails.repoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Gate Check-in Staff</span>
                  <span className="text-emerald-650 font-extrabold block mt-0.5">
                    {vehicleDetails.enteredBy?.name || 'Gate Operator'}
                  </span>
                </div>
                
                <div className="col-span-2 border-t border-slate-100 pt-3 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Allocated Yard Location</span>
                    <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-100/50 px-3 py-1 rounded-xl inline-block mt-1.5">
                      Slot {vehicleDetails.yardLocation?.slot || 'Unallocated'} (Zone {vehicleDetails.yardLocation?.zone || 'A'})
                    </span>
                  </div>
                  {vehicleDetails.repoKitDate && (
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Repo Kit Sync Date</span>
                      <span className="text-xs font-bold text-slate-700 mt-1 block font-mono">
                        {new Date(vehicleDetails.repoKitDate).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Panel 2: Ownership & Possession Dossier */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-5 text-left">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <User className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Ownership & Possession Dossier
                </h4>
              </div>
              
              <div className="space-y-4 text-xs font-semibold">
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Borrower / Primary Customer</span>
                  <span className="text-slate-850 text-sm font-bold block mt-0.5">{vehicleDetails.customerName || 'No Name Provided'}</span>
                </div>
                
                <div>
                  <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Contact Phone</span>
                  <span className="text-slate-700 font-mono block mt-0.5 flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{vehicleDetails.customerPhone || 'N/A'}</span>
                  </span>
                </div>
                
                <div className="h-px bg-slate-100"></div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Loan Agreement No</span>
                    <span className="text-slate-850 font-mono block uppercase mt-0.5">
                      {(() => {
                        const item = vehicleDetails.inventory?.find((i: any) => i.itemName.toLowerCase() === 'agreement no');
                        return item?.remarks || 'N/A';
                      })()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Odometer Reading</span>
                    <span className="text-slate-850 font-mono block mt-0.5">
                      {(() => {
                        const item = vehicleDetails.inventory?.find((i: any) => i.itemName.toLowerCase() === 'mileage');
                        return item ? `${item.remarks} KM` : 'N/A';
                      })()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Place of Possession</span>
                    <span className="text-slate-800 block mt-0.5 uppercase">
                      {(() => {
                        const item = vehicleDetails.inventory?.find((i: any) => i.itemName.toLowerCase() === 'place');
                        return item?.remarks || 'N/A';
                      })()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Time of Possession</span>
                    <span className="text-slate-800 font-mono block mt-0.5 uppercase">
                      {(() => {
                        const item = vehicleDetails.inventory?.find((i: any) => i.itemName.toLowerCase() === 'time of possession');
                        return item?.remarks || 'N/A';
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel 3: Digital Signature / Gate Acknowledgement */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-4 text-left flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Gate In Signature
                  </h4>
                </div>
                
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-2.5">
                  Secure cryptographic mobile screen signature captured at the time of entry to authorize inventory possession list digitally without papers.
                </p>
              </div>

              <div className="mt-4">
                {vehicleDetails.customerSign ? (
                  <div className="relative border border-slate-200 bg-slate-50 p-4 rounded-2xl flex items-center justify-center overflow-hidden aspect-[3/1] shadow-inner mt-1 group">
                    <img
                      src={vehicleDetails.customerSign}
                      alt="Customer Signature"
                      className="max-h-full object-contain select-none contrast-125 hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute bottom-1 right-2 text-[7px] font-mono text-emerald-600 uppercase tracking-widest pointer-events-none">
                      🔒 Secured Digital Signature
                    </div>
                  </div>
                ) : (
                  <div className="py-8 border border-dashed border-slate-200 text-center rounded-2xl text-[10px] text-slate-400 font-medium italic mt-1 bg-slate-50/50">
                    No digital signature captured on gate entry.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financials' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-left">
            {/* Top overview metrics */}
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Current Parking Spot</span>
                  <span className="text-xs font-extrabold text-slate-800">
                    Slot {vehicleDetails.yardLocation?.slot || 'N/A'} (Zone {vehicleDetails.yardLocation?.zone || 'A'})
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">In-Gate Date</span>
                  <span className="text-xs font-extrabold text-slate-800">
                    {new Date(vehicleDetails.entryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Parked Duration</span>
                  <span className="text-xs font-extrabold text-slate-800">
                    {billingInfo ? `${billingInfo.totalDays} Days Active` : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm flex items-center space-x-4">
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-bold block">Dynamic Amount Due</span>
                  <span className="text-xs font-extrabold text-slate-800 font-mono">
                    {"\u20B9"}{billingInfo?.totalAmount?.toLocaleString('en-IN') || 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Billing Engine Panel */}
            <div className="bg-gradient-to-br from-emerald-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-emerald-900 pb-3">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-black text-emerald-100 uppercase tracking-wider">
                    Billing Settlement Engine
                  </h4>
                </div>
                
                {billingInfo ? (
                  <div className="space-y-3.5 text-xs font-semibold text-emerald-250">
                    <div className="flex justify-between">
                      <span className="text-emerald-400">Daily Base Parking Rate</span>
                      <span className="text-white font-bold font-mono">{"\u20B9"}{billingInfo.dailyRate} / day</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-400">Total Parked Duration</span>
                      <span className="text-white font-bold font-mono">{billingInfo.totalDays} Days</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-400">Bank Client Share ({billingInfo.bankPayableDays} Days)</span>
                      <span className="text-white font-bold font-mono">{"\u20B9"}{billingInfo.bankPayable}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-400">Customer Share ({billingInfo.customerPayableDays} Days)</span>
                      <span className="text-amber-400 font-bold font-mono">{"\u20B9"}{billingInfo.customerPayable}</span>
                    </div>
                    
                    <div className="border-t border-emerald-900/60 pt-3 flex justify-between font-black text-sm text-white">
                      <span>Total Dynamic Due</span>
                      <span className="text-base text-emerald-400 font-mono font-black">{"\u20B9"}{billingInfo.totalAmount}</span>
                    </div>
                    
                    <div className="flex justify-between text-[10px] font-bold border-t border-emerald-900/60 pt-3">
                      <span className="text-emerald-400">Payment status</span>
                      <span className={`px-2.5 py-0.5 rounded font-black text-[9px] uppercase tracking-wider ${
                        billingInfo.paymentStatus === 'PAID' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {billingInfo.paymentStatus} ({"\u20B9"}{billingInfo.paidAmount} Paid)
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-emerald-400 font-medium italic">Calculating billing metrics dynamically...</p>
                )}
              </div>

              {/* Repo Kit Upload Form for KACHHA vehicles */}
              {vehicleDetails.yardStatus === 'KACHHA' && (
                <div className="mt-4 border border-dashed border-emerald-850 bg-emerald-950/50 p-4 rounded-2xl space-y-4">
                  <div className="border-b border-emerald-900/60 pb-2">
                    <h5 className="text-xs font-black uppercase text-emerald-50 tracking-wider flex items-center">
                      <Camera className="w-4 h-4 mr-1.5 text-amber-400" />
                      Repo Kit Verification
                    </h5>
                    <p className="text-[8px] text-emerald-300/80 mt-0.5">Mandatory files and activation date required to activate Pakka storage billing.</p>
                  </div>

                  <form onSubmit={handleTransitionToPakkaWithDocs} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block">Pakka Activation Date (Date of Repo Kit submission)</label>
                      <input
                        type="date"
                        required
                        value={repoKitDateInput}
                        onChange={(e) => setRepoKitDateInput(e.target.value)}
                        className="w-full bg-slate-900/50 text-white px-3 py-2 rounded-xl border border-emerald-900 focus:outline-none focus:border-emerald-500 text-xs font-bold font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block">Upload Mandatory Photos (4/4 Required)</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'pre_intimation', label: 'Pre Intimation' },
                          { key: 'post_intimation', label: 'Post Intimation' },
                          { key: 'yard_inventory', label: 'Yard Inventory' },
                          { key: 'bank_inventory', label: 'Bank Inventory' },
                        ].map((doc) => {
                          const isUploaded = !!repoKitPhotos[doc.key];
                          const isUploading = !!uploadingRepoKitPhoto[doc.key];
                          
                          return (
                            <div key={doc.key} className="relative">
                              <button
                                type="button"
                                disabled={isUploading}
                                onClick={() => document.getElementById(`repokit-upload-${doc.key}`)?.click()}
                                className={`w-full aspect-[4/3] rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-2 transition-all ${
                                  isUploaded
                                    ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300'
                                    : 'border-emerald-900 bg-slate-900/30 text-emerald-400 hover:text-white hover:bg-slate-900/50'
                                } text-[9px] font-bold uppercase`}
                              >
                                {isUploading ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-emerald-450 border-t-transparent rounded-full animate-spin mb-1"></div>
                                    <span className="text-[7px]">Uploading...</span>
                                  </>
                                ) : isUploaded ? (
                                  <>
                                    <img
                                      src={repoKitPhotos[doc.key]}
                                      alt={doc.label}
                                      className="w-full h-full object-cover rounded-lg absolute inset-0 opacity-40 z-0 pointer-events-none"
                                    />
                                    <span className="z-10 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/35 text-[8px] text-emerald-300 font-extrabold flex items-center">
                                      ✓ {doc.label}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Camera className="w-4 h-4 mb-1 text-emerald-550" />
                                    <span>{doc.label}</span>
                                  </>
                                )}
                              </button>
                              <input
                                id={`repokit-upload-${doc.key}`}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => handleUploadRepoKitPhoto(doc.key, e)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={Object.values(repoKitPhotos).some((url) => !url)}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-black py-2.5 rounded-xl text-[10px] shadow-md transition-all uppercase tracking-widest flex items-center justify-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span>Activate Pakka Billing</span>
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Workflow & Release Controls console */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Check-out Operations & Release Actions
                  </h4>
                </div>

                <p className="text-[11px] text-slate-400 font-medium leading-relaxed mt-2.5">
                  Follow yard exit validation steps strictly. Digital confirmations automatically release parking slot allocations in database instantly.
                </p>

                {/* Stepper dynamic message */}
                <div className="mt-4 space-y-4">
                  {/* Unified Release Desk Trigger - for active vehicles */}
                  {(vehicleDetails.yardStatus === 'KACHHA' || vehicleDetails.yardStatus === 'PAKKA') && !vehicleDetails.release?.releaseStatus && (
                    <div className="bg-gradient-to-r from-amber-500/5 to-slate-50 border border-amber-200 p-5 rounded-2xl space-y-3">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Quick Exit Checkout</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                        Open the Unified Vehicle Release Desk to settle parking tariffs, upload compliance proofs, and instantly generate a gate-out clearance for this vehicle.
                      </p>
                      <button
                        onClick={() => setIsReleaseModalOpen(true)}
                        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl shadow-lg shadow-amber-500/10 text-xs uppercase tracking-widest transition-all active:scale-98 flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Open Unified Release Desk</span>
                      </button>
                    </div>
                  )}

                  {/* In-progress release stages info display */}
                  {vehicleDetails.release?.releaseStatus && vehicleDetails.release?.releaseStatus !== 'RELEASED' && (
                    <div className="bg-gradient-to-r from-emerald-500/5 to-slate-50 border border-emerald-200 p-5 rounded-2xl space-y-3">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                          Release In Progress — {vehicleDetails.release?.releaseStatus}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                        This vehicle has an active release process. Current stage: <strong>{vehicleDetails.release?.releaseStatus}</strong>. 
                        Use the Unified Release Desk to complete the checkout.
                      </p>
                      <button
                        onClick={() => setIsReleaseModalOpen(true)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow-md text-xs uppercase tracking-widest transition-all active:scale-98 flex items-center justify-center space-x-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Continue Release Process</span>
                      </button>
                    </div>
                  )}

                  {/* Historical released copy (Released state) */}
                  {vehicleDetails.release?.releaseStatus === 'RELEASED' && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs font-semibold text-slate-650 bg-emerald-50/20 border border-emerald-250 p-4 rounded-xl gap-3">
                      <div className="flex items-center space-x-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Stage: **Released** (Cleared Yard Exit & Delivery Handover Completed successfully)</span>
                      </div>
                      <button
                        onClick={handlePrintTicket}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-md transition-all text-xs flex items-center space-x-1.5 uppercase tracking-wider shrink-0"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print Ticket Copy</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Eco warning about physical print */}
              <div className="border-t border-slate-100 pt-3 flex items-center space-x-2 text-[10px] text-emerald-650 font-bold font-mono">
                <Leaf className="w-4 h-4" />
                <span>Legacy paper printing is enabled for audit, but digital share should be preferred. 🌿</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in text-left">
            {/* Gallery Photo upload Panel */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    In-Yard Inspections Gallery ({vehicleDetails.photos?.length || 0})
                  </h4>
                </div>
                
                {/* Dynamic photo uploads */}
                {(user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN') && (() => {
                  const uploadedAngles = vehicleDetails.photos?.map((p: any) => p.photoType.toLowerCase()) || [];
                  const missingAngles = ['front', 'back', 'left', 'right', 'dashboard', 'engine', 'chassis'].filter(angle => !uploadedAngles.includes(angle));
                  
                  return missingAngles.length > 0 ? (
                    <div className="flex items-center space-x-2">
                      <select
                        value={selectedUploadAngle}
                        onChange={(e) => setSelectedUploadAngle(e.target.value)}
                        className="text-[9px] font-bold text-slate-655 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
                      >
                        <option value="">Select Angle</option>
                        {missingAngles.map(angle => (
                          <option key={angle} value={angle}>{angle.toUpperCase()} View</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!selectedUploadAngle || uploadingGalleryPhoto}
                        onClick={() => document.getElementById('gallery-photo-capture-drawer')?.click()}
                        className="bg-emerald-650 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-wider transition-all flex items-center space-x-1 disabled:opacity-40"
                      >
                        {uploadingGalleryPhoto ? (
                          <>
                            <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <span>📷 Capture</span>
                        )}
                      </button>
                      <input
                        id="gallery-photo-capture-drawer"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleCaptureGalleryPhoto}
                      />
                    </div>
                  ) : null;
                })()}
              </div>

              {vehicleDetails.photos && vehicleDetails.photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {vehicleDetails.photos.map((photo: any) => {
                    const isBlob = photo.s3Url?.startsWith('blob:');
                    return (
                      <div 
                        key={photo.id} 
                        onClick={() => !isBlob && setActiveLightboxPhoto(photo.s3Url)}
                        className={`group relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-50 shadow-sm transition-all ${
                          isBlob ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow hover:border-slate-350'
                        }`}
                      >
                        {/* Hover photo delete */}
                        {(user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN') && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePhoto(photo.id);
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 shadow z-20"
                            title="Delete Inspection Photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isBlob ? (
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-slate-450 bg-slate-100 text-center select-none space-y-1">
                            <AlertTriangle className="w-4 h-4 text-amber-500 animate-bounce" />
                            <span className="text-[8px] font-bold text-slate-700 uppercase">Upload Offline</span>
                            <span className="text-[6px] text-slate-400 leading-tight">Image failed cloud sync due to network at entry time.</span>
                          </div>
                        ) : (
                          <img
                            src={photo.s3Url}
                            alt={photo.photoType}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[8px] font-mono font-bold text-white text-center uppercase tracking-wider group-hover:bg-emerald-950/80 transition-colors">
                          {photo.photoType} View
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 font-semibold italic text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
                  No inspection photos uploaded during gate entry check-in.
                </div>
              )}
            </div>

            {/* Inventory Checklist Table Panel */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-sm space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Official Checklist & Quality Condition
                </h4>
              </div>
              
              {(() => {
                const filtered = vehicleDetails.inventory?.filter(
                  (i: any) => !['agreement no', 'mileage', 'place', 'time of possession'].includes(i.itemName.toLowerCase())
                ) || [];
                
                return filtered.length > 0 ? (
                  <div className="border border-slate-150 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto shadow-inner bg-slate-50/10">
                    <table className="w-full text-left text-[10px] text-slate-600 font-semibold">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 uppercase font-bold tracking-wider text-[8px] sticky top-0">
                          <th className="p-3 font-semibold">Verification Item</th>
                          <th className="p-3 font-semibold">Condition Status</th>
                          <th className="p-3 font-semibold">Remarks / Detailed Damage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filtered.map((item: any) => (
                          <tr key={item.id} className="hover:bg-slate-55/30 transition-colors">
                            <td className="p-3 font-bold text-slate-750">{item.itemName}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded font-extrabold text-[8px] uppercase tracking-wider ${
                                item.isPresent 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                  : 'bg-rose-50 text-rose-700 border border-rose-100'
                              }`}>
                                {item.isPresent ? 'Present' : 'Missing / Damage'}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[9px] text-slate-500 uppercase">
                              {item.remarks || <span className="text-slate-350 italic font-sans lowercase">No notes</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 font-semibold italic text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/20">
                    No quality inventory checklist parameters available.
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>

      {/* High Resolution Lightbox Modal Preview Overlay */}
      {activeLightboxPhoto && (
        <div 
          className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setActiveLightboxPhoto(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
            <img 
              src={activeLightboxPhoto} 
              alt="Inspection details high resolution zoom" 
              className="w-full h-full object-contain max-h-[85vh]"
            />
            <button 
              className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors border border-white/10"
              onClick={() => setActiveLightboxPhoto(null)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Premium Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-250 shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div className="text-left">
                <h3 className="text-base font-bold text-slate-800">Edit Vehicle Profile</h3>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Modify owner details, slot placement, and parameters.</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
              
              {/* Section 1: Customer Ownership */}
              <div className="space-y-3">
                <h4 className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-1">1. Borrower Ownership Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Borrower / Customer Name</label>
                    <input
                      type="text"
                      required
                      value={editFormData.customerName}
                      onChange={(e) => setEditFormData({ ...editFormData, customerName: e.target.value })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Contact Phone Number</label>
                    <input
                      type="text"
                      value={editFormData.customerPhone}
                      onChange={(e) => setEditFormData({ ...editFormData, customerPhone: e.target.value })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Vehicle Specs */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-1">2. Vehicle Specifications</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle Plate Number</label>
                    <input
                      type="text"
                      required
                      value={editFormData.vehicleNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, vehicleNumber: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-bold font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Brand Name</label>
                    <input
                      type="text"
                      value={editFormData.brand}
                      onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Model Variant</label>
                    <input
                      type="text"
                      value={editFormData.model}
                      onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Body Color</label>
                    <input
                      type="text"
                      value={editFormData.color}
                      onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Chassis Number</label>
                    <input
                      type="text"
                      value={editFormData.chassisNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, chassisNumber: e.target.value })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Engine Number</label>
                    <input
                      type="text"
                      value={editFormData.engineNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, engineNumber: e.target.value })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Bank & Agency */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-1">3. Financial & Sourcing Senders</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Bank / Client Name</label>
                    <input
                      type="text"
                      required
                      value={editFormData.bankName}
                      onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Repo Agency Partner</label>
                    <input
                      type="text"
                      value={editFormData.repoAgency}
                      onChange={(e) => setEditFormData({ ...editFormData, repoAgency: e.target.value })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Yard Location & Status */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[9px] font-extrabold text-emerald-600 uppercase tracking-widest border-b border-emerald-100 pb-1">4. Yard Placement Allocation</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Allocate Yard Slot Location</label>
                    <select
                      value={editFormData.yardLocationId || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, yardLocationId: e.target.value })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold"
                    >
                      <option value="">{loadingLocations ? 'Loading slots...' : 'Unallocated (No Active Slot)'}</option>
                      {vehicleDetails.yardLocation && !locations.some(loc => loc.id === vehicleDetails.yardLocationId) && (
                        <option value={vehicleDetails.yardLocationId}>
                          {vehicleDetails.yardLocation.slot} (Zone {vehicleDetails.yardLocation.zone}) [Current]
                        </option>
                      )}
                      {locations
                        .filter((loc) => !loc.isOccupied || loc.id === vehicleDetails.yardLocationId)
                        .map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.slot} (Zone {loc.zone}) {loc.id === vehicleDetails.yardLocationId ? '[Current]' : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Yard Operational Status</label>
                    <select
                      value={editFormData.yardStatus}
                      onChange={(e) => setEditFormData({ ...editFormData, yardStatus: e.target.value as any })}
                      className="w-full bg-slate-50 text-slate-800 px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 text-xs font-semibold"
                    >
                      <option value="KACHHA">Kachha Entry (Pending Repo Kit Approval)</option>
                      <option value="PAKKA">Pakka Gate-In (Active Storage Billing)</option>
                      <option value="RELEASED">Released (Exit Gate Out completed)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Modal Action Footer */}
              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-emerald-650 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl shadow-md transition-all text-xs flex items-center space-x-1.5"
                >
                  {savingEdit ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Vehicle Release Desk Modal */}
      <UnifiedReleaseModal
        isOpen={isReleaseModalOpen}
        onClose={() => {
          setIsReleaseModalOpen(false);
          fetchLiveDetails();
          fetchLiveBilling();
        }}
        initialVehicle={vehicleDetails}
        onSuccess={() => {
          fetchLiveDetails();
          fetchLiveBilling();
          onRefreshList();
        }}
      />
    </div>
  );
};
