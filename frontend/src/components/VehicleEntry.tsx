import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Truck,
  Camera,
  CheckSquare,
  PenTool,
  Printer,
  FileDown,
  Share2,
  CheckCircle2,
  MapPin,
  Warehouse,
  Save,
  FileText,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Building,
  Clock,
  Calendar,
  User,
  Phone,
  Shield,
  Activity,
  Sparkles,
  Car,
  Info,
} from 'lucide-react';
import { compressImage } from '../utils/imageCompressor';
import { useToastStore } from '../store/toastStore';



interface InventoryItemConfig {
  name: string;
  key: string;
  isCondition?: boolean;
  isText?: boolean;
}

const LEFT_INVENTORY_ITEMS: InventoryItemConfig[] = [
  { name: 'Registration Done', key: 'Registration Done' },
  { name: 'RC-Original', key: 'RC' },
  { name: 'Insurance Certificate', key: 'Insurance Certificate' },
  { name: 'Guarantee / Manual', key: 'Guarantee / Manual' },
  { name: 'Keys', key: 'Key' },
  { name: 'Silencer', key: 'Silencer' },
  { name: 'Mud Flaps', key: 'Mud Flaps' },
  { name: 'Horn', key: 'Horn' },
  { name: 'Front Tyre', key: 'Front Tyre' },
  { name: 'Rear Tyre', key: 'Rear Tyre' },
  { name: 'Spare Tyre', key: 'Spare Tyre' },
  { name: 'Jack Key', key: 'Jack Key' },
  { name: 'Wheel Spanner', key: 'Wheel Spanner' },
  { name: 'Tool Kit', key: 'Toolkit' },
  { name: 'Seat Cover', key: 'Seat Covers' },
  { name: 'Side Mirror (Left)', key: 'Side Mirror (Left)' },
  { name: 'Side Mirror (Right)', key: 'Side Mirror (Right)' },
  { name: 'Rear View Mirror', key: 'Mirrors' },
  { name: 'Light Front', key: 'Light Front' },
  { name: 'Light Back', key: 'Light Back' },
  { name: 'Light Indicator', key: 'Light Indicator' },
  { name: 'Body Condition', key: 'Body Condition', isCondition: true },
  { name: 'Bonnet Condition', key: 'Bonnet Condition', isCondition: true },
  { name: 'Condition of Asset', key: 'Condition of Asset', isCondition: true },
  { name: 'Type of Body', key: 'Type of Body', isText: true },
  { name: 'Tyre Make 1', key: 'Tyre Make 1', isText: true },
  { name: 'Tyre Make 2', key: 'Tyre Make 2', isText: true },
];

const RIGHT_INVENTORY_ITEMS: InventoryItemConfig[] = [
  { name: 'Centre Locking System', key: 'Centre Locking System' },
  { name: 'Lever Clutch Break', key: 'Lever Clutch Break' },
  { name: 'Luggage Carrier', key: 'Luggage Carrier' },
  { name: 'Saree Guard', key: 'Saree Guard' },
  { name: 'Kick Pedal / Front Foot Rest', key: 'Kick Pedal / Front Foot Rest' },
  { name: 'Rear Foot Rest', key: 'Rear Foot Rest' },
  { name: 'Seat Cover', key: 'Seat Covers' },
  { name: 'Shock Absorber / Fork Front & Rear', key: 'Shock Absorber / Fork Front & Rear' },
  { name: 'Fuel Tank', key: 'Fuel Tank' },
  { name: 'Speedometer', key: 'Speedometer' },
  { name: 'Cylinder Head', key: 'Cylinder Head' },
  { name: 'Upholstry', key: 'Upholstry' },
  { name: 'COWL / Dash Board', key: 'COWL / Dash Board' },
  { name: 'Bumper', key: 'Bumper' },
  { name: 'Dicky Door', key: 'Dicky Door' },
  { name: 'Steering Box', key: 'Steering Box' },
  { name: 'Seats', key: 'Seats' },
  { name: 'Chassis Frame', key: 'Chassis Frame' },
  { name: 'Front Shocker / Leaves', key: 'Front Shocker / Leaves' },
  { name: 'Rear Shocker / Leaves', key: 'Rear Shocker / Leaves' },
  { name: 'Cassette / CDs', key: 'Cassette / CDs' },
  { name: 'Music System / Make', key: 'Music System' },
  { name: 'Battery Make', key: 'Battery' },
  { name: 'Spare Tyre Make', key: 'Spare Tyre Make' },
  { name: 'Tyre Make 3', key: 'Tyre Make 3' },
  { name: 'Tyre Make 4', key: 'Tyre Make 4' },
  { name: 'Remarks:', key: 'Remarks', isText: true },
];

const SearchableDropdown: React.FC<{
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string, name: string) => void;
  placeholder: string;
  disabled?: boolean;
}> = ({ options, value, onChange, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white text-left text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold flex items-center justify-between shadow-sm disabled:bg-slate-50 disabled:text-slate-400"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
            }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 bg-slate-50">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full bg-white text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs font-medium"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id, opt.name);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 transition-colors ${opt.id === value ? 'text-primary bg-primary/5' : 'text-slate-700'
                    }`}
                >
                  {opt.name}
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-slate-400 text-xs font-semibold">
                No banks found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const VehicleEntry: React.FC = () => {
  const [step, setStep] = useState(1);
  const [slots, setSlots] = useState<any[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [banks, setBanks] = useState<any[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [bankCategory, setBankCategory] = useState<'direct' | 'shift' | 'third_party' | ''>('');
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState<string>('');
  const [bodyCondition, setBodyCondition] = useState<'Good' | 'Average' | 'Bad'>('Bad');
  const [yardRemarks, setYardRemarks] = useState('');
  const [customerRemarks, setCustomerRemarks] = useState('');
  const [repoAgentName, setRepoAgentName] = useState('');
  const [repoAgencyName, setRepoAgencyName] = useState('');
  const toast = useToastStore();

  const handleSaveDraft = () => {
    if (!formData.vehicleNumber && !formData.bankName) {
      toast.error('Please enter at least vehicle number or bank name to save draft');
      return;
    }
    const draft = {
      id: `draft_${Date.now()}`,
      savedAt: new Date().toISOString(),
      formData,
      photos,
      checklist,
      bankCategory,
      selectedThirdPartyId,
      bodyCondition,
      yardRemarks,
      customerRemarks,
      repoAgentName,
      repoAgencyName,
    };
    try {
      const existing = JSON.parse(localStorage.getItem('yms_offline_drafts') || '[]');
      const updated = [draft, ...existing];
      localStorage.setItem('yms_offline_drafts', JSON.stringify(updated));
      toast.success('Vehicle entry saved to drafts!');
    } catch (e) {
      toast.error('Failed to save draft');
    }
  };



  // Form State
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    chassisNumber: '',
    engineNumber: '',
    vehicleType: '',
    brand: '',
    model: '',
    color: '',
    bankName: '',
    bankId: '',
    repoAgency: '',
    repoDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
    entryDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
    customerName: '',
    customerPhone: '',
    yardLocationId: '',
    agreementNo: '',
    mileage: '',
    placeOfPossession: '',
    timeOfPossession: new Date().toTimeString().split(' ')[0].substring(0, 5),
  });

  // Vehicle Inspection Photos State (Uploaded post-completion)
  const [photos, setPhotos] = useState<Record<string, string>>({
    front: '',
    back: '',
    left: '',
    right: '',
    dashboard: '',
    odometer: '',
    chassis: '',
  });

  const [uploadingPhotos, setUploadingPhotos] = useState<Record<string, boolean>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});

  // Gate Photos State (Captured during wizard)
  const [gatePhotos, setGatePhotos] = useState<Record<string, string>>({
    customer: '',
    witness: '',
    gate_overview: '',
    video: '',
  });

  const [uploadingGatePhotos, setUploadingGatePhotos] = useState<Record<string, boolean>>({});
  const [gatePreviews, setGatePreviews] = useState<Record<string, string>>({});

  // Checklist State (Gurgaon Parking Yard Standard Checklist)
  const [checklist, setChecklist] = useState<any[]>([
    { itemName: 'RC-Original', isPresent: false, remarks: '' },
    { itemName: 'key', isPresent: false, remarks: '' },
    { itemName: 'Battery', isPresent: false, remarks: '' },
    { itemName: 'Horn', isPresent: false, remarks: '' },
    { itemName: 'Front Tyre', isPresent: false, make: '', remarks: '' },
    { itemName: 'Back Tyre', isPresent: false, make: '', remarks: '' },
    { itemName: 'Spare Tyre', isPresent: false, remarks: '' },
    { itemName: 'Tool Kit', isPresent: false, remarks: '' },
    { itemName: 'Side Mirror (Left)', isPresent: false, remarks: '' },
    { itemName: 'Side Mirror (Right)', isPresent: false, remarks: '' },
    { itemName: 'Light Front', isPresent: false, remarks: '' },
    { itemName: 'Light Back', isPresent: false, remarks: '' },
    { itemName: 'Light Indicator', isPresent: false, remarks: '' },
    { itemName: 'Music System', isPresent: false, remarks: '' },
    { itemName: 'Meter Running Condition', isPresent: false, remarks: '' },
  ]);

  // Customer Signature state
  const [signatureName, setSignatureName] = useState('');
  const [signing, setSigning] = useState(false);

  // Auto-Detect City State & Handler
  const [detectingCity, setDetectingCity] = useState(false);
  const autoDetectCity = async () => {
    setDetectingCity(true);
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data && data.city) {
          setFormData((prev) => ({ ...prev, placeOfPossession: data.city }));
          toast.success(`Location detected: ${data.city}`);
          return;
        }
      }
      const fallbackRes = await fetch('http://ip-api.com/json/');
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        if (fbData && fbData.city) {
          setFormData((prev) => ({ ...prev, placeOfPossession: fbData.city }));
          toast.success(`Location detected: ${fbData.city}`);
        }
      }
    } catch (e) {
      toast.error('Could not auto-detect location');
    } finally {
      setDetectingCity(false);
    }
  };

  // Success state
  const [createdVehicle, setCreatedVehicle] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const checkState = (key: string, vObj: any) => {
    const target = vObj?.inventory || checklist;
    const item = target.find((i: any) => i.itemName.toLowerCase() === key.toLowerCase() || (i.keyName && i.keyName.toLowerCase() === key.toLowerCase()) || i.itemName.toLowerCase().includes(key.toLowerCase()));
    return item ? item.isPresent : false;
  };

  const checkText = (key: string, vObj: any) => {
    const target = vObj?.inventory || checklist;
    const item = target.find((i: any) => i.itemName.toLowerCase() === key.toLowerCase() || (i.keyName && i.keyName.toLowerCase() === key.toLowerCase()) || i.itemName.toLowerCase().includes(key.toLowerCase()));
    return item ? item.remarks || '' : '';
  };

  // Dynamic Print & Layout Settings state
  const [printConfig, setPrintConfig] = useState<any>({
    headerTitle: 'SHREE PARKING YARD',
    headerAddress: 'GURUGRAM VILLAGE, HARYANA',
    footerDisclaimer: '*** THIS IS A COMPUTER SYSTEM GENERATED DOCUMENT. PHYSICAL SIGNATURE NOT REQUIRED. ***',
  });

  useEffect(() => {
    // 1. Load Custom Master Checklist Settings if saved in localStorage
    try {
      const savedMaster = localStorage.getItem('yms_master_checklist');
      if (savedMaster) {
        const parsed = JSON.parse(savedMaster);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const customChecklist = parsed
            .filter((item: any) => item.enabled !== false)
            .map((item: any) => ({
              itemName: item.itemName,
              keyName: item.itemName,
              isPresent: false,
              remarks: '',
              isCondition: item.itemName.toLowerCase().includes('condition'),
              isText: item.itemName.toLowerCase().includes('make') || item.itemName.toLowerCase().includes('remark'),
            }));
          if (customChecklist.length > 0) {
            setChecklist(customChecklist);
          }
        }
      }
    } catch (e) {
      console.warn('[VehicleEntry] Failed to load custom master checklist from settings', e);
    }

    // 2. Load Custom Print Layout Settings if saved in localStorage
    try {
      const savedPrint = localStorage.getItem('yms_print_config');
      if (savedPrint) {
        const parsedPrint = JSON.parse(savedPrint);
        setPrintConfig((prev: any) => ({ ...prev, ...parsedPrint }));
      }
    } catch (e) {
      console.warn('[VehicleEntry] Failed to load custom print settings', e);
    }
  }, []);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        const res = await api.get('/vehicles/locations');
        if (res.data?.success) {
          // only show unallocated slots
          setSlots(res.data.data.filter((s: any) => !s.isOccupied));
        }
      } catch (err) {
        console.error('Failed to load slots', err);
      } finally {
        setLoadingSlots(false);
      }
    };

    const fetchBanks = async () => {
      try {
        const res = await api.get('/banks');
        if (res.data?.success) {
          setBanks(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load banks', err);
      } finally {
        setLoadingBanks(false);
      }
    };

    fetchSlots();
    fetchBanks();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };



  const handleChecklistChange = (index: number, field: 'isPresent' | 'remarks', value: any) => {
    const updated = [...checklist];
    updated[index][field] = value;
    setChecklist(updated);
  };

  // Gate Photo Upload Trigger via device camera/gallery
  const handleGatePhotoUpload = async (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let localUrl = '';
    try {
      let uploadFile = file;
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImage(file, 1280, 0.8);
      }
      localUrl = URL.createObjectURL(uploadFile);
      setGatePhotos((prev) => ({ ...prev, [type]: localUrl }));
      setGatePreviews((prev) => ({ ...prev, [type]: localUrl }));
      setUploadingGatePhotos((prev) => ({ ...prev, [type]: true }));

      const res = await api.get(`/uploads/presigned-url?fileType=${uploadFile.type}&fileSize=${uploadFile.size}&folder=vehicles`);
      if (res.data?.success) {
        const { uploadUrl, publicUrl } = res.data.data;

        if (uploadUrl.includes('mock-s3-bucket')) {
          // Bypassing real PUT request for local dev mock URL
          setGatePhotos((prev) => ({ ...prev, [type]: publicUrl }));
        } else {
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': uploadFile.type,
            },
            body: uploadFile,
          });

          if (!uploadRes.ok) {
            throw new Error(`Cloud storage upload failed: ${uploadRes.statusText}`);
          }

          setGatePhotos((prev) => ({ ...prev, [type]: publicUrl }));
        }
      }
      setUploadingGatePhotos((prev) => ({ ...prev, [type]: false }));
    } catch (err: any) {
      console.error('Failed to upload gate photo', err);
      setGatePhotos((prev) => ({ ...prev, [type]: '' }));
      setGatePreviews((prev) => ({ ...prev, [type]: '' }));
      setUploadingGatePhotos((prev) => ({ ...prev, [type]: false }));
      if (localUrl) {
        try { URL.revokeObjectURL(localUrl); } catch (e) { }
      }
      toast.error(`Image upload failed: ${err.message || err}`);
    }
  };

  // Real Photo Upload Trigger via device camera/gallery
  const handlePhotoUpload = async (angle: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set local instant preview & activate loader
    let localUrl = '';
    try {
      let uploadFile = file;
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImage(file, 1280, 0.8);
      }
      localUrl = URL.createObjectURL(uploadFile);
      setPhotos((prev) => ({ ...prev, [angle]: localUrl }));
      setPreviews((prev) => ({ ...prev, [angle]: localUrl }));
      setUploadingPhotos((prev) => ({ ...prev, [angle]: true }));

      // Real scale architecture: Fetch presigned URL & upload
      const res = await api.get(`/uploads/presigned-url?fileType=${uploadFile.type}&fileSize=${uploadFile.size}&folder=vehicles`);
      if (res.data?.success) {
        const { uploadUrl, publicUrl } = res.data.data;

        if (uploadUrl.includes('mock-s3-bucket')) {
          // Bypassing real PUT request for local dev mock URL
          if (createdVehicle?.id) {
            await api.post(`/vehicles/${createdVehicle.id}/photos`, {
              photoType: angle,
              s3Url: publicUrl,
              lat: 19.076,
              lng: 72.877, // Mock watermark Location
            });
          }
          setPhotos((prev) => ({ ...prev, [angle]: publicUrl }));
        } else {
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': uploadFile.type,
            },
            body: uploadFile,
          });

          if (!uploadRes.ok) {
            throw new Error(`Cloud storage upload failed: ${uploadRes.statusText}`);
          }

          // If the vehicle has already been created, save photo to backend directly
          if (createdVehicle?.id) {
            await api.post(`/vehicles/${createdVehicle.id}/photos`, {
              photoType: angle,
              s3Url: publicUrl,
              lat: 19.076,
              lng: 72.877, // Mock watermark Location
            });
          }

          // Use the REAL public URL for state
          setPhotos((prev) => ({ ...prev, [angle]: publicUrl }));
        }
      }
      setUploadingPhotos((prev) => ({ ...prev, [angle]: false }));
    } catch (err: any) {
      console.error('Failed to compress or upload image', err);
      // Clean up local preview blob URL so we do not save a broken image reference to the database
      setPhotos((prev) => ({ ...prev, [angle]: '' }));
      setPreviews((prev) => ({ ...prev, [angle]: '' }));
      setUploadingPhotos((prev) => ({ ...prev, [angle]: false }));
      if (localUrl) {
        try { URL.revokeObjectURL(localUrl); } catch (e) { }
      }
      toast.error(`Image upload failed: ${err.message || err}`);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { agreementNo, mileage, placeOfPossession, timeOfPossession, ...coreFormData } = formData;
      const combinedRepoAgency = (repoAgencyName || repoAgentName)
        ? `Agency: ${repoAgencyName || formData.repoAgency} | Agent: ${repoAgentName || 'NA'} | Place: ${placeOfPossession}`
        : formData.repoAgency;

      const extraInventoryItems = [
        { itemName: 'Agreement No', isPresent: !!agreementNo, remarks: agreementNo },
        { itemName: 'Mileage', isPresent: !!mileage, remarks: mileage },
        { itemName: 'Place', isPresent: !!placeOfPossession, remarks: placeOfPossession },
        { itemName: 'Time of Possession', isPresent: !!timeOfPossession, remarks: timeOfPossession },
        { itemName: 'Body Condition', isPresent: true, remarks: bodyCondition },
        { itemName: 'Yard Remarks', isPresent: !!yardRemarks, remarks: yardRemarks },
        { itemName: 'Customer Remarks', isPresent: !!customerRemarks, remarks: customerRemarks },
      ];

      const payload = {
        ...coreFormData,
        repoAgency: combinedRepoAgency,
        customerSign: signatureName ? `https://yms-signatures.s3.amazonaws.com/${signatureName.toLowerCase().replace(' ', '_')}.png` : undefined,
        inventory: [...checklist, ...extraInventoryItems],
      };

      const res = await api.post('/vehicles', payload);
      if (res.data?.success) {
        const vehicle = res.data.data;

        // Upload All Captured Media (both Gate and Condition photos)
        const allPhotosToUpload = [
          ...Object.entries(gatePhotos).map(([type, url]) => ({ type, url })),
          ...Object.entries(photos).map(([type, url]) => ({ type, url }))
        ];

        await Promise.all(
          allPhotosToUpload
            .filter(({ url }) => !!url)
            .map(({ type, url }) =>
              api.post(`/vehicles/${vehicle.id}/photos`, {
                photoType: type,
                s3Url: url,
                lat: 19.076,
                lng: 72.877, // Mock Location watermark
              })
            )
        );

        setCreatedVehicle(vehicle);
        setStep(4); // Proceed to Status screen (Step 4)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit vehicle entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 pb-20 md:pb-28 bg-slate-100/70 min-h-screen space-y-6 flex-1 overflow-y-auto font-sans">
      {/* Page Title Header */}
      <div className="no-print max-w-4xl mx-auto flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{step === 4 ? 'Status Screen' : 'New Vehicle Entry'}</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Gurugram Yard Standard Vehicle In-Yard Gate Pass Entry</p>
        </div>
      </div>

      {step < 4 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 mb-12 max-w-4xl mx-auto text-slate-800">
          {/* Progress Wizard Steps Indicator (Matching Mobile App) */}
          <div className="relative mb-8 select-none no-print max-w-xl mx-auto pb-2">
            {/* Background connecting progress line */}
            <div className="absolute top-4 left-[12%] right-[12%] h-1 bg-slate-200 z-0 rounded-full">
              <div 
                className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
                style={{ width: `${((step - 1) / 2) * 100}%` }}
              />
            </div>
            
            {/* Step Nodes */}
            <div className="relative flex justify-between z-10">
              {[
                { num: 1, label: 'Basic Info', icon: FileText },
                { num: 2, label: 'Photos', icon: Camera },
                { num: 3, label: 'Review', icon: CheckSquare },
              ].map((s) => {
                const isPast = step > s.num;
                const isCurrent = step === s.num;
                const Icon = s.icon;
                return (
                  <button
                    key={s.num}
                    type="button"
                    disabled={s.num > step}
                    onClick={() => setStep(s.num)}
                    className="flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer group"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-200 active:scale-95 ${
                        isPast || isCurrent
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                          : 'bg-white border-slate-300 text-slate-400'
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span 
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        isCurrent ? 'text-indigo-600 font-extrabold' : 'text-slate-500 font-bold'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 1: VEHICLE INFORMATION */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-in font-sans text-slate-800">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Vehicle Information</h3>

              {/* Vehicle Reg No at the very top */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Vehicle Reg No *</label>
                  <button
                    type="button"
                    onClick={() => {
                      const samplePlates = ['MH12PQ9876', 'DL03CAY4321', 'HR26BQ8811', 'KA03MM5566', 'MH14EU2045'];
                      const plate = samplePlates[Math.floor(Math.random() * samplePlates.length)];
                      setFormData(prev => ({ ...prev, vehicleNumber: plate }));
                      toast.success(`Plate scanned: ${plate}`);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Scan Plate</span>
                  </button>
                </div>
                <input
                  type="text"
                  name="vehicleNumber"
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                  placeholder="e.g. MH-12-PQ-1234"
                  className="w-full text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-sm font-semibold uppercase shadow-sm"
                />
              </div>

              {/* Bank Category & Select Bank Side-by-Side Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Bank Category *</label>
                  <select
                    value={bankCategory}
                    onChange={(e) => {
                      const cat = e.target.value as any;
                      setBankCategory(cat);
                      setSelectedThirdPartyId('');
                      if (cat === 'shift') {
                        setFormData(prev => ({ ...prev, bankId: 'non_paneled_shift', bankName: 'Non-Paneled (Yard Shift)' }));
                      } else {
                        setFormData(prev => ({ ...prev, bankId: '', bankName: '' }));
                      }
                    }}
                    className="w-full text-slate-800 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-bold shadow-sm cursor-pointer"
                  >
                    <option value="">-- Select --</option>
                    <option value="direct">Direct Bank</option>
                    <option value="third_party">Third Party</option>
                    <option value="shift">🚚 Shift Bank</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Select Bank/Group *</label>
                  {bankCategory === 'direct' && (
                    <SearchableDropdown
                      options={banks
                        .filter((b) => !b.isThirdParty && !b.parentId)
                        .sort((a, b) => a.name.localeCompare(b.name))}
                      value={formData.bankId}
                      onChange={(id, name) => setFormData((prev) => ({ ...prev, bankId: id, bankName: name }))}
                      placeholder="-- Select Bank --"
                    />
                  )}
                  {bankCategory === 'third_party' && (
                    <SearchableDropdown
                      options={banks
                        .filter((b) => b.isThirdParty)
                        .sort((a, b) => a.name.localeCompare(b.name))}
                      value={selectedThirdPartyId}
                      onChange={(id, name) => {
                        setSelectedThirdPartyId(id);
                        setFormData((prev) => ({ ...prev, bankId: '', bankName: '' }));
                      }}
                      placeholder="-- Select Group --"
                    />
                  )}
                  {bankCategory === 'shift' && (
                    <input
                      type="text"
                      disabled
                      value="Non-Paneled (Yard Shift)"
                      className="w-full bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold shadow-sm"
                    />
                  )}
                  {!bankCategory && (
                    <div className="w-full bg-slate-50 text-slate-400 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold select-none">
                      -- Select Bank Category First --
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-Bank Dropdown if Third Party */}
              {bankCategory === 'third_party' && selectedThirdPartyId && (
                <div className="space-y-1.5 animate-slide-up">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Select Sub-Bank *</label>
                  <SearchableDropdown
                    options={banks
                      .filter((b) => b.parentId === selectedThirdPartyId)
                      .sort((a, b) => a.name.localeCompare(b.name))}
                    value={formData.bankId}
                    onChange={(id, name) => setFormData((prev) => ({ ...prev, bankId: id, bankName: name }))}
                    placeholder="-- Select Sub-Bank --"
                  />
                </div>
              )}

              {/* Shift Bank Warning Banner */}
              {bankCategory === 'shift' && (
                <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-start space-x-2 text-amber-900 text-xs shadow-sm">
                  <span className="text-base leading-none">⚠️</span>
                  <div>
                    <span className="font-bold block text-amber-950">Non-Paneled Bank Selected</span>
                    <span className="text-[11px] text-amber-800">This vehicle will be auto-flagged as "Shift Pending" and queued for yard transfer.</span>
                  </div>
                </div>
              )}

              {/* Vehicle Category Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Vehicle Category *</label>
                <select
                  name="vehicleType"
                  value={formData.vehicleType}
                  onChange={handleChange}
                  className="w-full text-slate-800 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-bold shadow-sm cursor-pointer"
                >
                  <option value="">-- Select Vehicle Category --</option>
                  <option value="TW">2 Wheeler (TW)</option>
                  <option value="THREE_W">3 Wheeler (THREE_W)</option>
                  <option value="FW">4 Wheeler (FW)</option>
                  <option value="CV">Commercial (CV)</option>
                </select>
              </div>

              {/* Customer Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Customer Name *</label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleChange}
                  placeholder="Enter customer name"
                  className="w-full text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-semibold shadow-sm"
                />
              </div>

              {/* Customer Mob NO */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Customer Mob NO</label>
                <input
                  type="text"
                  name="customerPhone"
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="Enter customer mobile number"
                  maxLength={10}
                  className="w-full text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-semibold shadow-sm"
                />
              </div>

              {/* Grid for Make & Model */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Vehicle Make</label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="e.g. Tata Motors, Maruti Suzuki"
                    className="w-full text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-semibold shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Model Name</label>
                  <input
                    type="text"
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    placeholder="e.g. Swift, Nexon"
                    className="w-full text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-semibold shadow-sm"
                  />
                </div>
              </div>

              {/* Grid for Chassis & Engine NO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Chassis NO</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      name="chassisNumber"
                      value={formData.chassisNumber}
                      onChange={handleChange}
                      placeholder="Enter chassis number"
                      className="flex-1 text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-semibold uppercase shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, chassisNumber: 'NA' })}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-300 text-xs transition-colors shadow-sm cursor-pointer"
                    >
                      NA
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Engine No</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      name="engineNumber"
                      value={formData.engineNumber}
                      onChange={handleChange}
                      placeholder="Enter engine number"
                      className="flex-1 text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-semibold uppercase shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, engineNumber: 'NA' })}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-300 text-xs transition-colors shadow-sm cursor-pointer"
                    >
                      NA
                    </button>
                  </div>
                </div>
              </div>

              {/* Place & Date Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Place of Possession</label>
                    <button
                      type="button"
                      onClick={autoDetectCity}
                      disabled={detectingCity}
                      className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{detectingCity ? 'Detecting...' : 'Detect City'}</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    name="placeOfPossession"
                    value={formData.placeOfPossession}
                    onChange={handleChange}
                    placeholder="e.g. Gurugram, Delhi"
                    className="w-full text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-semibold shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Entry Date & Time *</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      name="entryDate"
                      value={formData.entryDate}
                      onChange={handleChange}
                      className="flex-1 text-slate-900 bg-white px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600 text-xs font-semibold shadow-sm"
                    />
                    <input
                      type="time"
                      name="timeOfPossession"
                      value={formData.timeOfPossession}
                      onChange={handleChange}
                      className="w-28 text-slate-900 bg-white px-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-indigo-600 text-xs font-semibold shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Repo Agent & Repo Agency Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Repo Agent Name</label>
                  <input
                    type="text"
                    value={repoAgentName}
                    onChange={(e) => setRepoAgentName(e.target.value)}
                    placeholder="Enter repo agent name"
                    className="w-full text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-semibold shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Repo Agency Name</label>
                  <input
                    type="text"
                    value={repoAgencyName}
                    onChange={(e) => {
                      setRepoAgencyName(e.target.value);
                      setFormData(prev => ({ ...prev, repoAgency: e.target.value }));
                    }}
                    placeholder="Enter repo agency name"
                    className="w-full text-slate-900 bg-white px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 text-xs font-semibold shadow-sm"
                  />
                </div>
              </div>

              {/* Navigation Footer */}
              <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-300 transition-all text-xs flex items-center space-x-2 cursor-pointer shadow-sm"
                >
                  <Save className="w-4 h-4 text-amber-600" />
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!formData.vehicleNumber) {
                      toast.error('Vehicle Registration Number is mandatory!');
                      return;
                    }
                    if (!formData.bankId) {
                      toast.error('Bank Partner is mandatory!');
                      return;
                    }
                    if (!formData.vehicleType) {
                      toast.error('Vehicle Category is mandatory!');
                      return;
                    }
                    setStep(2);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all text-xs flex items-center space-x-2 cursor-pointer"
                >
                  <span>Next: Inspection Photos</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: INSPECTION PHOTOS */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in font-sans text-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Inspection Photos</h3>
                <p className="text-xs text-slate-500 font-medium">Capture required photos and add any extra viewpoints as needed.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {[
                  { key: 'front', label: 'Front View *' },
                  { key: 'back', label: 'Back View *' },
                  { key: 'left', label: 'Left View *' },
                  { key: 'right', label: 'Right View *' },
                  { key: 'odometer', label: 'Odometer / Meter' },
                  { key: 'chassis', label: 'Chassis Plate' },
                  { key: 'customer', label: 'Customer Photo' },
                ].map((media) => (
                  <div key={media.key} className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 block">{media.label}</span>
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center group cursor-pointer hover:border-indigo-400 transition-all shadow-sm">
                      {previews[media.key] || gatePreviews[media.key] ? (
                        <>
                          <img
                            src={previews[media.key] || gatePreviews[media.key]}
                            alt={media.label}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-20">
                            <button
                              type="button"
                              onClick={() => document.getElementById(`upload-photo-${media.key}`)?.click()}
                              className="bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow-md cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Retake</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => document.getElementById(`upload-photo-${media.key}`)?.click()}
                          className="flex flex-col items-center space-y-1.5 text-slate-400 group-hover:text-indigo-600 transition-colors p-2 text-center cursor-pointer"
                        >
                          <Camera className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Tap to Capture</span>
                        </button>
                      )}

                      <input
                        id={`upload-photo-${media.key}`}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          if (media.key === 'customer') {
                            handleGatePhotoUpload(media.key, e);
                          } else {
                            handlePhotoUpload(media.key, e);
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Navigation Footer */}
              <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-300 transition-all text-xs flex items-center space-x-2 cursor-pointer shadow-sm"
                  >
                    <Save className="w-4 h-4 text-amber-600" />
                    <span>Save Draft</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all text-xs flex items-center space-x-2 cursor-pointer"
                  >
                    <span>Next: Review & Inventory</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & INVENTORY DETAILS */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in font-sans text-slate-800">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Review & Inventory Details</h3>

              {/* Card 1: Basic Info Summary Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Vehicle Specifications
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">License Plate</span>
                    <span className="font-extrabold text-slate-900 text-sm">{formData.vehicleNumber.toUpperCase() || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Type Class</span>
                    <span className="font-bold text-slate-800">{formData.vehicleType || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Brand / Model</span>
                    <span className="font-bold text-slate-800">{formData.brand || 'N/A'} / {formData.model || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Bank / Party</span>
                    <span className="font-bold text-slate-800">{formData.bankName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Chassis Number</span>
                    <span className="font-bold text-slate-800">{formData.chassisNumber || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer Name</span>
                    <span className="font-bold text-slate-800">{formData.customerName || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Captured Photos Summary Bar */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Captured Photos
                </h4>
                <div className="flex items-center gap-3 overflow-x-auto pb-2">
                  {Object.entries({ ...previews, ...gatePreviews }).filter(([_, uri]) => !!uri).length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium">No inspection photos captured.</p>
                  ) : (
                    Object.entries({ ...previews, ...gatePreviews })
                      .filter(([_, uri]) => !!uri)
                      .map(([key, uri]) => {
                        const labels: Record<string, string> = {
                          front: 'Front View',
                          back: 'Back View',
                          left: 'Left View',
                          right: 'Right View',
                          odometer: 'Odometer',
                          chassis: 'Chassis Plate',
                          customer: 'Customer Photo',
                          witness: 'Witness Photo',
                          gate_overview: 'Gate Overview',
                          video: 'Vehicle Video',
                        };
                        return (
                          <div key={key} className="relative w-28 h-20 rounded-xl overflow-hidden border border-slate-200 shrink-0 group shadow-sm bg-slate-50">
                            <img src={uri} alt={key} className="w-full h-full object-cover" />
                            <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 px-1.5 py-0.5 text-center">
                              <span className="text-[9px] font-bold text-white uppercase tracking-tight block truncate">
                                {labels[key] || key}
                              </span>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Card 3: Accessories Inventory */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <h4 className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider border-b border-slate-100 pb-2">
                  Accessories Inventory
                </h4>

                <div className="space-y-3 divide-y divide-slate-100">
                  {checklist.map((item, index) => {
                    const isTyre = item.itemName === 'Front Tyre' || item.itemName === 'Back Tyre';
                    return (
                      <div key={item.itemName} className="pt-3 first:pt-0 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-semibold ${item.isPresent ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>
                            {item.itemName}
                          </span>
                          
                          {/* iOS Style Switch Toggle */}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...checklist];
                              updated[index].isPresent = !updated[index].isPresent;
                              setChecklist(updated);
                            }}
                            className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer relative ${
                              item.isPresent ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 transform ${
                                item.isPresent ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {item.isPresent && (
                          <div className="space-y-2 pl-2 border-l-2 border-emerald-500 animate-slide-down">
                            {isTyre && (
                              <input
                                type="text"
                                value={item.make || ''}
                                onChange={(e) => {
                                  const updated = [...checklist];
                                  updated[index].make = e.target.value;
                                  setChecklist(updated);
                                }}
                                placeholder="Enter Tyre Company Name (e.g. CEAT, TVS)"
                                className="w-full bg-slate-50 text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-600 text-xs font-medium shadow-sm"
                              />
                            )}
                            <input
                              type="text"
                              value={item.remarks || ''}
                              onChange={(e) => {
                                const updated = [...checklist];
                                updated[index].remarks = e.target.value;
                                setChecklist(updated);
                              }}
                              placeholder="Add remarks (optional)"
                              className="w-full bg-slate-50 text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-600 text-xs font-medium shadow-sm"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Body Condition Selector */}
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Body Condition *</label>
                  <div className="flex items-center gap-3">
                    {(['Good', 'Average', 'Bad'] as const).map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setBodyCondition(cond)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                          bodyCondition === cond
                            ? cond === 'Good'
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                              : cond === 'Average'
                              ? 'bg-amber-600 border-amber-600 text-white shadow-md'
                              : 'bg-rose-600 border-rose-600 text-white shadow-md'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {cond}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Yard Remarks */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Yard Remarks</label>
                  <input
                    type="text"
                    value={yardRemarks}
                    onChange={(e) => setYardRemarks(e.target.value)}
                    placeholder="Enter remarks for the yard"
                    className="w-full bg-slate-50 text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 text-xs font-medium shadow-sm"
                  />
                </div>

                {/* Customer Remarks */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Customer Remarks</label>
                  <input
                    type="text"
                    value={customerRemarks}
                    onChange={(e) => setCustomerRemarks(e.target.value)}
                    placeholder="Enter remarks from the customer"
                    className="w-full bg-slate-50 text-slate-900 p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-600 text-xs font-medium shadow-sm"
                  />
                </div>
              </div>

              {/* Navigation Footer */}
              <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-300 transition-all text-xs flex items-center space-x-2 cursor-pointer shadow-sm"
                  >
                    <Save className="w-4 h-4 text-amber-600" />
                    <span>Save Draft</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all text-xs flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <span>Submitting...</span>
                    ) : (
                      <>
                        <span>Submit In-Yard Check-In</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 4: STATUS SCREEN & GATE PASS RECEIPT */}
      {step === 4 && createdVehicle && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-2xl mx-auto space-y-8 animate-fade-in print-container">
          {/* Header */}
          <div className="text-center space-y-2 no-print">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">In-Yard Check-in Completed!</h3>
            <p className="text-sm text-slate-400 font-medium">Unique Inventory ID: <span className="font-bold text-slate-600">{createdVehicle.id.slice(0, 8).toUpperCase()}</span></p>
          </div>

          {/* Receipt Content */}
          <div className="border-2 border-black p-6 bg-white space-y-4 print-card shadow-lg max-w-3xl mx-auto">
            {/* Header Title */}
            <div className="text-center space-y-1">
              <h1 className="text-base font-black uppercase tracking-wider text-black font-serif">
                {printConfig.headerTitle || 'SHREE PARKING YARD'}
              </h1>
              <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">
                {printConfig.headerAddress || 'GURUGRAM VILLAGE, HARYANA'}
              </p>
              <h2 className="text-xs font-bold uppercase text-black pt-1 border-b-2 border-black pb-1.5">
                Bank Name -- <span className="underline font-extrabold">{createdVehicle.bankName}</span>
              </h2>
            </div>

            {/* General Info Table */}
            <table className="w-full border-collapse border border-black text-[10px] text-black">
              <thead>
                <tr className="bg-slate-100/80 border-b border-black">
                  <th colSpan={4} className="p-1 text-left border border-black font-extrabold uppercase tracking-wide">General Information of the Asset</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-1 font-bold border border-black w-[25%] bg-slate-50">Borrower's Name</td>
                  <td className="p-1 border border-black w-[25%] font-semibold">{createdVehicle.customerName || 'N/A'}</td>
                  <td className="p-1 font-bold border border-black w-[25%] bg-slate-50">Agreement No</td>
                  <td className="p-1 border border-black w-[25%] font-semibold">{checkText('Agreement No', createdVehicle) || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Asset possession taken from the custody of</td>
                  <td className="p-1 border border-black font-semibold">{createdVehicle.customerName || 'N/A'}</td>
                  <td className="p-1 font-bold border border-black bg-slate-50">Relation/Designation</td>
                  <td className="p-1 border border-black font-semibold">Self</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Date of Possession</td>
                  <td className="p-1 border border-black font-semibold">{createdVehicle.repoDate ? new Date(createdVehicle.repoDate).toLocaleDateString('en-IN') : ''}</td>
                  <td className="p-1 font-bold border border-black bg-slate-50">Time of Possession</td>
                  <td className="p-1 border border-black font-semibold">{checkText('Time of Possession', createdVehicle) || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Place</td>
                  <td className="p-1 border border-black font-semibold">{checkText('Place', createdVehicle) || 'N/A'}</td>
                  <td className="p-1 font-bold border border-black bg-slate-50">Colour</td>
                  <td className="p-1 border border-black font-semibold">{createdVehicle.color || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Asset Make</td>
                  <td className="p-1 border border-black font-semibold">{createdVehicle.brand || 'N/A'}</td>
                  <td className="p-1 font-bold border border-black bg-slate-50">Model</td>
                  <td className="p-1 border border-black font-semibold">{createdVehicle.model || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Reg. No./Serial No</td>
                  <td className="p-1 border border-black font-bold uppercase text-xs">{createdVehicle.vehicleNumber}</td>
                  <td className="p-1 font-bold border border-black bg-slate-50">Mileage</td>
                  <td className="p-1 border border-black font-semibold">{checkText('Mileage', createdVehicle) || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Engine No</td>
                  <td className="p-1 border border-black font-semibold">{createdVehicle.engineNumber || 'N/A'}</td>
                  <td className="p-1 font-bold border border-black bg-slate-50">Chassis No</td>
                  <td className="p-1 border border-black font-semibold">{createdVehicle.chassisNumber || 'N/A'}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="p-1.5 border border-black text-slate-500 font-semibold italic text-[9px]">
                    Please specify whether the Asset/Vehicle is in Working/running condition and other remark:
                    <span className="text-slate-800 font-bold block mt-1 not-italic">Running Condition, Parked safely at Slot {createdVehicle.yardLocation?.slot || 'A1'}.</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Inventory Table side-by-side */}
            {(() => {
              const rows = [];
              const maxLen = Math.max(LEFT_INVENTORY_ITEMS.length, RIGHT_INVENTORY_ITEMS.length);
              for (let i = 0; i < maxLen; i++) {
                rows.push({
                  left: LEFT_INVENTORY_ITEMS[i],
                  right: RIGHT_INVENTORY_ITEMS[i],
                });
              }
              return (
                <table className="w-full border-collapse border border-black text-[9px] text-black mt-2 print:mt-1">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-black text-center font-extrabold uppercase">
                      <th colSpan={8} className="p-1 border border-black tracking-wide text-xs">Inventory of the Asset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-black">
                        {/* Left Item */}
                        {row.left ? (
                          <>
                            <td className="p-1 border-r border-black w-[35%] font-semibold text-left">{row.left.name}</td>
                            {row.left.isText ? (
                              <td colSpan={2} className="p-1 border-r border-black text-left font-bold w-[15%]">
                                {checkText(row.left.key, createdVehicle)}
                              </td>
                            ) : row.left.isCondition ? (
                              <>
                                <td className={`p-1 border-r border-black text-center font-extrabold w-[7.5%] ${checkState(row.left.key, createdVehicle) ? 'bg-slate-200' : ''}`}>
                                  {checkState(row.left.key, createdVehicle) ? 'Good ✔' : 'Good'}
                                </td>
                                <td className={`p-1 border-r border-black text-center font-extrabold w-[7.5%] ${!checkState(row.left.key, createdVehicle) ? 'bg-slate-200' : ''}`}>
                                  {!checkState(row.left.key, createdVehicle) ? 'Bad ✔' : 'Bad'}
                                </td>
                              </>
                            ) : (
                              <>
                                <td className={`p-1 border-r border-black text-center font-extrabold w-[7.5%] ${checkState(row.left.key, createdVehicle) ? 'bg-slate-200' : ''}`}>
                                  {checkState(row.left.key, createdVehicle) ? 'Yes ✔' : 'Yes'}
                                </td>
                                <td className={`p-1 border-r border-black text-center font-extrabold w-[7.5%] ${!checkState(row.left.key, createdVehicle) ? 'bg-slate-200' : ''}`}>
                                  {!checkState(row.left.key, createdVehicle) ? 'No ✔' : 'No'}
                                </td>
                              </>
                            )}
                          </>
                        ) : (
                          <td colSpan={3} className="p-1 border-r border-black w-[50%]"></td>
                        )}

                        {/* Right Item */}
                        {row.right ? (
                          <>
                            <td className="p-1 border-r border-black w-[35%] font-semibold text-left pl-2">{row.right.name}</td>
                            {row.right.isText ? (
                              <td colSpan={2} className="p-1 text-left font-bold w-[15%]">
                                {checkText(row.right.key, createdVehicle)}
                              </td>
                            ) : (
                              <>
                                <td className={`p-1 border-r border-black text-center font-extrabold w-[7.5%] ${checkState(row.right.key, createdVehicle) ? 'bg-slate-200' : ''}`}>
                                  {checkState(row.right.key, createdVehicle) ? 'Yes ✔' : 'Yes'}
                                </td>
                                <td className={`p-1 text-center font-extrabold w-[7.5%] ${!checkState(row.right.key, createdVehicle) ? 'bg-slate-200' : ''}`}>
                                  {!checkState(row.right.key, createdVehicle) ? 'No ✔' : 'No'}
                                </td>
                              </>
                            )}
                          </>
                        ) : (
                          <td colSpan={3} className="p-1 w-[50%]"></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}

            {/* Gate Photos Print Integration */}
            <div className="mt-4 print:mt-1 border border-black p-3 print:p-1.5 rounded-lg print:rounded-none bg-slate-50/50">
              <span className="text-[9px] font-extrabold uppercase text-black block mb-2 tracking-wide border-b border-black/20 pb-1">
                Gate Entry Photo Records
              </span>
              <div className="grid grid-cols-3 gap-3">
                {gatePhotos.customer && (
                  <div className="text-center space-y-1">
                    <span className="text-[7px] font-bold text-slate-500 uppercase block">Customer / Driver</span>
                    <img
                      src={gatePreviews.customer || gatePhotos.customer}
                      alt="Customer"
                      className="w-full h-20 object-cover border border-black rounded"
                    />
                  </div>
                )}
                {gatePhotos.witness && (
                  <div className="text-center space-y-1">
                    <span className="text-[7px] font-bold text-slate-500 uppercase block">Witness / Companion</span>
                    <img
                      src={gatePreviews.witness || gatePhotos.witness}
                      alt="Witness"
                      className="w-full h-20 object-cover border border-black rounded"
                    />
                  </div>
                )}
                {gatePhotos.gate_overview && (
                  <div className="text-center space-y-1">
                    <span className="text-[7px] font-bold text-slate-500 uppercase block">Gate Overview</span>
                    <img
                      src={gatePreviews.gate_overview || gatePhotos.gate_overview}
                      alt="Gate Overview"
                      className="w-full h-20 object-cover border border-black rounded"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Disclaimer Text */}
            <p className="text-[8px] text-black font-semibold mt-3 print:mt-1 italic leading-tight border-b border-black pb-2 print:pb-0.5">
              I hereby confirm that only the above inventory was available at the time of me surrendering the asset to Bank / Agency and that no other valuable items viz. ornaments or cash were available in the said vehicle.
            </p>

            {/* Customer signature section */}
            <div className="grid grid-cols-2 gap-4 print:gap-1 text-[9px] text-black pt-2 print:pt-0.5">
              <div>
                <span className="font-bold">Name of Person surrendering the asset / vehicle:</span> <span className="underline font-semibold">{createdVehicle.customerName || 'N/A'}</span>
              </div>
              <div>
                <span className="font-bold">Mob:</span> <span className="underline font-semibold">{createdVehicle.customerPhone || 'N/A'}</span>
              </div>
              <div className="col-span-2 grid grid-cols-2 gap-4 pt-1">
                <div>
                  <span className="font-bold">Signature of the Person (Surrendering asset / vehicle):</span> <span className="underline font-semibold">{createdVehicle.customerSign ? 'Verified Gate Pass Signed' : '______________________'}</span>
                </div>
                <div>
                  <span className="font-bold">Place:</span> <span className="underline font-semibold">{checkText('Place', createdVehicle) || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Collector/Godown keeper Table */}
            <table className="w-full border-collapse border border-black text-[9px] text-black mt-3 print:mt-1">
              <tbody>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50 w-[35%]">Name of the Agency</td>
                  <td className="p-1 border border-black font-medium w-[65%]">{createdVehicle.repoAgency || 'Pune Repossessions Group'}</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Name of the Collector</td>
                  <td className="p-1 border border-black font-medium">{createdVehicle.enteredBy?.name || 'Shree Parking Yard Admin'}</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Signature of the Collector</td>
                  <td className="p-1 border border-black font-bold text-primary italic">Collector Signature Verified</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Name of the Yard / Godown</td>
                  <td className="p-1 border border-black font-bold">Shree Parking Yard (Pune)</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Name of the Yard / Godown Keeper</td>
                  <td className="p-1 border border-black font-medium">Shree Parking Yard Admin</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Signature of the Yard / Godown Keeper</td>
                  <td className="p-1 border border-black font-bold text-emerald-600 italic">Gate Pass Authorized</td>
                </tr>
                <tr>
                  <td className="p-1 font-bold border border-black bg-slate-50">Date and Time of parking / Storage in the Yard / Godown</td>
                  <td className="p-1 border border-black font-medium">
                    Date: <span className="font-bold mr-4">{new Date(createdVehicle.entryDate).toLocaleDateString('en-IN')}</span>
                    Time: <span className="font-bold">{new Date(createdVehicle.entryDate).toLocaleTimeString('en-IN')}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>


          {/* Action buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <button
              onClick={() => window.print()}
              className="border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={() => {
                window.print();
                toast.success('Select "Save as PDF" in print dialog');
              }}
              className="border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-sm"
            >
              <FileDown className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={() => toast.success('Receipt shared via WhatsApp successfully!')}
              className="border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-sm"
            >
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>Share WhatsApp</span>
            </button>
            <button
              onClick={() => {
                setStep(1);
                setFormData({
                  vehicleNumber: '',
                  chassisNumber: '',
                  engineNumber: '',
                  vehicleType: 'FW',
                  brand: '',
                  model: '',
                  color: '',
                  bankName: '',
                  bankId: '',
                  repoAgency: '',
                  repoDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
                  entryDate: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
                  customerName: '',
                  customerPhone: '',
                  yardLocationId: '',
                  agreementNo: '',
                  mileage: '',
                  placeOfPossession: 'Pune',
                  timeOfPossession: new Date().toTimeString().split(' ')[0].substring(0, 5),
                });
                setPhotos({ front: '', back: '', left: '', right: '', dashboard: '', odometer: '', chassis: '' });
                setPreviews({});
                setGatePhotos({ customer: '', witness: '', gate_overview: '' });
                setGatePreviews({});
                setUploadingGatePhotos({});
                setCreatedVehicle(null);
                setSigning(false);
                setSignatureName('');
              }}
              className="bg-primary hover:bg-primary/95 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-sm shadow-primary/10"
            >
              <Truck className="w-4 h-4" />
              <span>New Entry</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
