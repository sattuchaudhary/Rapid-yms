import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/toastStore';
import { compressImage } from '../utils/imageCompressor';
import { UnifiedReleaseModal } from './UnifiedReleaseModal';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
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
  Leaf,
  Car,
  Building,
  RefreshCw,
  Shield,
  Calculator
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

  // Accordion Sections State (Matching Mobile App)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true,       // Default open
    repoDetails: true,
    remarks: true,
    checklist: true,
    billing: true,
    photos: true,
    advanced: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Fee Estimator Modal State
  const [calcVisible, setCalcVisible] = useState(false);
  const [calcDays, setCalcDays] = useState('30');
  const [calcResult, setCalcResult] = useState<number | null>(null);

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

  return (
    <div className="fixed inset-y-0 right-0 left-0 md:left-64 z-40 bg-slate-50 text-slate-800 flex flex-col select-none overflow-y-auto animate-fade-in font-sans">

      {/* Top Header Bar (Matching Mobile App Header) */}
      <div className="bg-white text-slate-900 px-4 py-3.5 sm:px-6 sticky top-0 z-40 flex items-center justify-between shadow-sm border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all border border-slate-200 cursor-pointer"
            title="Back to Stock"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-base sm:text-lg font-black uppercase text-slate-900 tracking-tight font-sans">Vehicle Operations Profile</h3>
            <p className="text-[11px] text-slate-500 font-medium font-mono">{vehicleDetails.vehicleNumber}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Paperless Share Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsShareDropdownOpen(!isShareDropdownOpen)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center space-x-1 text-xs font-bold uppercase cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden md:inline">Share</span>
            </button>

            {isShareDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white text-slate-800 shadow-xl border border-slate-200 py-2 z-50">
                <button
                  onClick={handleCopyLink}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-2 cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copy Secure Share Link</span>
                </button>
                <button
                  onClick={handleShareWhatsApp}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-2 cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-500" />
                  <span>Share via WhatsApp</span>
                </button>
                <button
                  onClick={handleShareEmail}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-2 cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-indigo-500" />
                  <span>Share via Email</span>
                </button>
              </div>
            )}
          </div>

          {(user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER' || user?.role === 'SUPER_ADMIN') && (
            <button
              onClick={handleOpenEditModal}
              className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all text-xs font-bold uppercase flex items-center space-x-1 cursor-pointer"
            >
              <Edit className="w-4 h-4" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Body Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-5 pb-28 text-slate-800">

        {/* 1. PREMIUM VEHICLE HERO CARD */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
          {/* Photo Box with Image Count Badge */}
          <div
            onClick={() => vehicleDetails.photos?.length && setActiveLightboxPhoto(vehicleDetails.photos[0].s3Url)}
            className="relative w-full sm:w-44 aspect-video sm:aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 cursor-pointer group shadow-inner"
          >
            {vehicleDetails.photos && vehicleDetails.photos.length > 0 ? (
              <img
                src={vehicleDetails.photos[0].s3Url}
                alt={vehicleDetails.vehicleNumber}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                <Car className="w-10 h-10 mb-1" />
                <span className="text-[10px] font-bold uppercase">No Photo</span>
              </div>
            )}
            {vehicleDetails.photos && vehicleDetails.photos.length > 0 && (
              <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Camera className="w-3 h-3" />
                <span>{vehicleDetails.photos.length} Photos</span>
              </div>
            )}
          </div>

          {/* Vehicle Main Information Header */}
          <div className="flex-1 space-y-2 text-left">
            <div className="flex items-center flex-wrap gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono uppercase">
                {vehicleDetails.vehicleNumber}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[9px] uppercase tracking-wider ${vehicleDetails.yardStatus === 'KACHHA'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : vehicleDetails.yardStatus === 'PAKKA'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                }`}>
                {vehicleDetails.yardStatus}
              </span>
            </div>

            <p className="text-xs sm:text-sm font-semibold text-slate-600">
              {vehicleDetails.vehicleType === 'TW'
                ? 'Two Wheeler (2W)'
                : vehicleDetails.vehicleType === 'THREE_W'
                  ? 'Three Wheeler (3W)'
                  : vehicleDetails.vehicleType === 'CV'
                    ? 'Commercial Vehicle (CV)'
                    : 'Four Wheeler (FW)'}
              {' • '}{vehicleDetails.brand || 'Unknown'} {vehicleDetails.model || ''}
            </p>

            <div className="flex items-center flex-wrap gap-2 pt-1 text-xs">
              <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200/80 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                Slot: {vehicleDetails.yardLocation?.slot || 'Unallocated'} ({vehicleDetails.yardLocation?.zone || 'A'})
              </span>
              <span className="bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-lg border border-emerald-200/60 flex items-center gap-1.5 font-mono">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {billingInfo ? `${billingInfo.totalDays} Days in Yard` : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. DASHBOARD METRICS CARDS GRID (2x2 Equal Side-by-Side Grid) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-left space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Parking Duration</span>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 pt-0.5">
              {billingInfo ? `${billingInfo.totalDays} Days` : '1 Day'}
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">
              In-Gate: {new Date(vehicleDetails.entryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-left space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Outstanding Due</span>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 font-mono pt-0.5">
              {"\u20B9"}{billingInfo?.totalAmount?.toLocaleString('en-IN') || 0}
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">
              Rate: {"\u20B9"}{billingInfo?.dailyRate || 150}/day
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-left space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Car className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Yard Slot</span>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 pt-0.5">
              {vehicleDetails.yardLocation ? `${vehicleDetails.yardLocation.zone}-${vehicleDetails.yardLocation.slot}` : 'Unassigned'}
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">Possession Zone</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-left space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                <Building className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Bank / Financer</span>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-900 truncate pt-0.5">
              {vehicleDetails.bankName || 'Direct'}
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">
              {vehicleDetails.bank?.isThirdParty ? 'Third Party Partner' : 'Direct Bank'}
            </p>
          </div>
        </div>

        {/* 3. CONTEXTUAL OPERATOR ACTION BANNERS */}
        {vehicleDetails.shiftStatus === 'SHIFT_PENDING' && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex items-center justify-between gap-3 text-left">
            <div className="flex items-center space-x-3">
              <RefreshCw className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-amber-900 uppercase">Shift Pending — Non-Paneled Bank</h4>
                <p className="text-[11px] text-amber-800">Bank is not paneled. Queued for transfer checkout.</p>
              </div>
            </div>
            <button
              onClick={() => setIsReleaseModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl cursor-pointer shrink-0"
            >
              Transfer →
            </button>
          </div>
        )}

        {vehicleDetails.yardStatus === 'KACHHA' && vehicleDetails.shiftStatus !== 'SHIFT_PENDING' && (
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex items-center justify-between gap-3 text-left">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-amber-900 uppercase">Verification & Repo Kit Pending</h4>
                <p className="text-[11px] text-amber-800">Submit 4 mandatory photos & repo date to activate Pakka storage billing.</p>
              </div>
            </div>
            <button
              onClick={() => {
                setExpandedSections(prev => ({ ...prev, billing: true }));
                const el = document.getElementById('repokit-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl cursor-pointer shrink-0"
            >
              Verify →
            </button>
          </div>
        )}

        {/* 4. SMART ACCORDION SECTIONS */}

        {/* Section A: Overview & Specifications */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
          <button
            onClick={() => toggleSection('overview')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer select-none"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Car className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Overview & Specifications</h4>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {vehicleDetails.brand || 'Vehicle'} {vehicleDetails.model || ''} • Color: {vehicleDetails.color || 'N/A'}
                </p>
              </div>
            </div>
            <div className="p-1 text-slate-400">
              {expandedSections.overview ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </button>

          {expandedSections.overview && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Entry Date & Time</span>
                  <span className="text-slate-900 font-bold block mt-0.5">
                    {new Date(vehicleDetails.entryDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Vehicle Category</span>
                  <span className="text-slate-900 font-bold block mt-0.5 uppercase">{vehicleDetails.vehicleType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Color / Variant</span>
                  <span className="text-slate-900 font-bold block mt-0.5">{vehicleDetails.color || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Yard Serial Number</span>
                  <span className="text-slate-900 font-bold block mt-0.5 font-mono">
                    {vehicleDetails.serialNumber ? `#${vehicleDetails.serialNumber}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Chassis Number</span>
                  <span className="text-slate-900 font-bold block mt-0.5 font-mono uppercase">{vehicleDetails.chassisNumber || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Engine Number</span>
                  <span className="text-slate-900 font-bold block mt-0.5 font-mono uppercase">{vehicleDetails.engineNumber || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section B: Customer & Repo Details */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
          <button
            onClick={() => toggleSection('repoDetails')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer select-none"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Customer & Repo Details</h4>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Bank: {vehicleDetails.bankName || 'Direct'} • Customer: {vehicleDetails.customerName || 'N/A'}
                </p>
              </div>
            </div>
            <div className="p-1 text-slate-400">
              {expandedSections.repoDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </button>

          {expandedSections.repoDetails && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Customer Name</span>
                  <span className="text-slate-900 font-bold block mt-0.5">{vehicleDetails.customerName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Customer Phone</span>
                  <span className="text-indigo-600 font-bold block mt-0.5 font-mono flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {vehicleDetails.customerPhone || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Financer / Bank</span>
                  <span className="text-slate-900 font-bold block mt-0.5">{vehicleDetails.bankName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Repo Agency</span>
                  <span className="text-slate-900 font-bold block mt-0.5">{vehicleDetails.repoAgency || 'Swift Agency'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Repo Action Date</span>
                  <span className="text-slate-900 font-bold block mt-0.5">
                    {new Date(vehicleDetails.repoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-bold text-[10px] uppercase">Gate Operator</span>
                  <span className="text-slate-900 font-bold block mt-0.5">{vehicleDetails.enteredBy?.name || 'Gate Staff'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section C: Vehicle Condition & Remarks */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
          <button
            onClick={() => toggleSection('remarks')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer select-none"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Condition Report & Remarks</h4>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Body: {(() => {
                    const inv = vehicleDetails.inventory?.find((i: any) => i.itemName === 'Body Condition');
                    return inv?.remarks || 'Bad';
                  })()} • Yard Remarks Recorded
                </p>
              </div>
            </div>
            <div className="p-1 text-slate-400">
              {expandedSections.remarks ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </button>

          {expandedSections.remarks && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold text-xs">Body Condition</span>
                {(() => {
                  const cond = vehicleDetails.inventory?.find((i: any) => i.itemName === 'Body Condition')?.remarks || 'Bad';
                  return (
                    <span className={`px-3 py-1 rounded-full font-black text-xs uppercase tracking-wider ${cond === 'Good'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : cond === 'Average'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                      {cond}
                    </span>
                  );
                })()}
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Yard Remarks</span>
                <p className="text-slate-800 font-semibold text-xs">
                  {(() => {
                    const inv = vehicleDetails.inventory?.find((i: any) => i.itemName === 'Yard Remarks');
                    return inv?.remarks || 'No specific remarks recorded.';
                  })()}
                </p>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Customer Remarks</span>
                <p className="text-slate-800 font-semibold text-xs">
                  {(() => {
                    const inv = vehicleDetails.inventory?.find((i: any) => i.itemName === 'Customer Remarks');
                    return inv?.remarks || 'No customer notes recorded.';
                  })()}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section D: Visual Accessories Checklist */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
          <button
            onClick={() => toggleSection('checklist')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer select-none"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Accessories Checklist</h4>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  15 Inspection Parameters Checked at Gate Entry
                </p>
              </div>
            </div>
            <div className="p-1 text-slate-400">
              {expandedSections.checklist ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </button>

          {expandedSections.checklist && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="p-3">Item Name</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Remarks / Tyre Make</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white font-medium">
                    {(vehicleDetails.inventory || []).filter((i: any) => !['Body Condition', 'Yard Remarks', 'Customer Remarks'].includes(i.itemName)).map((item: any) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-bold text-slate-900">{item.itemName}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded font-extrabold text-[9px] uppercase tracking-wider ${item.isPresent
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                            {item.isPresent ? 'YES' : 'NO'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {item.remarks || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Section E: Billing & Daily Rates */}
        <div id="repokit-section" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left">
          <button
            onClick={() => toggleSection('billing')}
            className="w-full p-4 sm:p-5 flex items-center justify-between text-left cursor-pointer select-none"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">Billing & Dynamic Rates</h4>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  {"\u20B9"}{billingInfo?.totalAmount?.toLocaleString('en-IN') || 0} Total Due • {billingInfo?.totalDays || 1} Days Stay
                </p>
              </div>
            </div>
            <div className="p-1 text-slate-400">
              {expandedSections.billing ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </div>
          </button>

          {expandedSections.billing && (
            <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs font-semibold">
                <div className="flex justify-between text-slate-600">
                  <span>Daily Base Parking Rate</span>
                  <span className="text-slate-900 font-bold font-mono">{"\u20B9"}{billingInfo?.dailyRate || 150} / day</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Total Parked Duration</span>
                  <span className="text-slate-900 font-bold font-mono">{billingInfo?.totalDays || 1} Days</span>
                </div>
                <div className="border-t border-slate-200 pt-2.5 flex justify-between font-black text-sm text-slate-900">
                  <span>Total Accrued Amount</span>
                  <span className="text-indigo-600 font-mono text-base font-black">{"\u20B9"}{billingInfo?.totalAmount?.toLocaleString('en-IN') || 0}</span>
                </div>
              </div>

              {/* Repo Kit Upload Form for KACHHA vehicles */}
              {vehicleDetails.yardStatus === 'KACHHA' && (
                <div className="border border-dashed border-amber-300 bg-amber-50/70 p-4 rounded-2xl space-y-4 text-left">
                  <div className="border-b border-amber-200 pb-2">
                    <h5 className="text-xs font-bold uppercase text-amber-900 flex items-center">
                      <Camera className="w-4 h-4 mr-1.5 text-amber-600" />
                      Repo Kit Verification
                    </h5>
                    <p className="text-[10px] text-amber-800 mt-0.5 font-medium">Upload 4 mandatory photos & repo date to activate Pakka storage billing.</p>
                  </div>

                  <form onSubmit={handleTransitionToPakkaWithDocs} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-700 uppercase block">Pakka Activation Date</label>
                      <input
                        type="date"
                        required
                        value={repoKitDateInput}
                        onChange={(e) => setRepoKitDateInput(e.target.value)}
                        className="w-full bg-white text-slate-900 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold font-mono"
                      />
                    </div>

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
                              className={`w-full aspect-[4/3] rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-2 transition-all cursor-pointer ${isUploaded ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                                } text-[9px] font-bold uppercase`}
                            >
                              {isUploading ? (
                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                              ) : isUploaded ? (
                                <span className="text-emerald-700 font-bold">✓ {doc.label}</span>
                              ) : (
                                <>
                                  <Camera className="w-4 h-4 mb-1 text-slate-400" />
                                  <span>{doc.label}</span>
                                </>
                              )}
                            </button>
                            <input
                              id={`repokit-upload-${doc.key}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleUploadRepoKitPhoto(doc.key, e)}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="submit"
                      disabled={Object.values(repoKitPhotos).some((url) => !url)}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Activate Pakka Billing
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* OPERATIONAL STICKY BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 right-0 left-0 md:left-64 bg-white border-t border-slate-200 px-4 py-3 shadow-xl z-40 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => {
              setExpandedSections(prev => ({ ...prev, photos: true }));
              setActiveLightboxPhoto(vehicleDetails.photos?.[0]?.s3Url || null);
            }}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1 border border-slate-200 cursor-pointer"
          >
            <Camera className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Photos</span>
            <span className="text-[10px] text-slate-400 font-mono">({vehicleDetails.photos?.length || 0})</span>
          </button>

          <button
            onClick={() => setCalcVisible(true)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1 border border-slate-200 cursor-pointer"
          >
            <Calculator className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Estimator</span>
          </button>

          <button
            onClick={handlePrintTicket}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1 border border-slate-200 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>

        {/* Primary Workflow CTA */}
        <button
          onClick={() => {
            if (vehicleDetails.yardStatus === 'KACHHA') {
              setExpandedSections(prev => ({ ...prev, billing: true }));
            } else {
              setIsReleaseModalOpen(true);
            }
          }}
          className="flex-1 max-w-xs bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider shadow-md flex items-center justify-center space-x-2 cursor-pointer"
        >
          <span>
            {vehicleDetails.yardStatus === 'KACHHA' ? 'Verify Repo Kit →' : 'Check Out / Release →'}
          </span>
        </button>
      </div>

      {/* FEE ESTIMATOR CALCULATOR POPUP MODAL */}
      {calcVisible && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 w-full max-w-md space-y-4 text-left">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Parking Fee Estimator</h3>
                <p className="text-xs text-slate-500 font-medium">Daily Rate: {"\u20B9"}{billingInfo?.dailyRate || 150}/Day</p>
              </div>
              <button onClick={() => setCalcVisible(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 uppercase block">Enter Number of Days</label>
              <input
                type="number"
                value={calcDays}
                onChange={(e) => {
                  setCalcDays(e.target.value);
                  setCalcResult(null);
                }}
                className="w-full bg-slate-50 text-slate-900 font-mono font-bold text-sm px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600"
                placeholder="30"
              />

              <button
                onClick={() => {
                  const days = parseInt(calcDays);
                  if (isNaN(days) || days <= 0) return;
                  const rate = billingInfo?.dailyRate || 150;
                  setCalcResult(days * rate);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider cursor-pointer"
              >
                Calculate Fees
              </button>

              {calcResult !== null && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center space-y-1">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase block">Estimated Parking Fee</span>
                  <span className="text-2xl font-black text-emerald-700 font-mono">{"\u20B9"}{calcResult.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] text-emerald-600 font-semibold block">For {calcDays} Days at {"\u20B9"}{billingInfo?.dailyRate || 150}/day</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setCalcVisible(false)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs uppercase cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

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
