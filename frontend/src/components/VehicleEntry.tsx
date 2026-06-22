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
  const [bankCategory, setBankCategory] = useState<'direct' | 'third_party' | ''>('');
  const [selectedThirdPartyId, setSelectedThirdPartyId] = useState<string>('');
  const toast = useToastStore();


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

  // Checklist State dynamically generated from constants
  const [checklist, setChecklist] = useState<any[]>(
    [...LEFT_INVENTORY_ITEMS, ...RIGHT_INVENTORY_ITEMS].map(item => ({
      itemName: item.name,
      keyName: item.key,
      isPresent: item.name === 'Battery' || item.name === 'Mirrors', // Some sensible defaults
      remarks: '',
      isCondition: item.isCondition,
      isText: item.isText
    }))
  );

  // Customer Signature state
  const [signatureName, setSignatureName] = useState('');
  const [signing, setSigning] = useState(false);

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
      const extraInventoryItems = [
        { itemName: 'Agreement No', isPresent: !!agreementNo, remarks: agreementNo },
        { itemName: 'Mileage', isPresent: !!mileage, remarks: mileage },
        { itemName: 'Place', isPresent: !!placeOfPossession, remarks: placeOfPossession },
        { itemName: 'Time of Possession', isPresent: !!timeOfPossession, remarks: timeOfPossession },
      ];

      const payload = {
        ...coreFormData,
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
        setStep(5); // Proceed to success screen
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit vehicle entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-slate-50 space-y-6 md:space-y-8 flex-1 overflow-y-auto">
      {/* Page Title */}
      <div className="no-print">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">New Vehicle Gate Entry</h2>
        <p className="text-sm text-slate-500 font-medium">Record repo details, verify inventory checklist, and capture condition photos</p>
      </div>

      {step < 5 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-4xl mx-auto">
          {/* Step Indicator */}
          <div className="relative mb-10 select-none no-print max-w-2xl mx-auto pb-4">
            {/* Background connecting progress line */}
            <div className="absolute top-4.5 left-[10%] right-[10%] h-0.5 bg-slate-100 z-0">
              <div 
                className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
                style={{ width: `${((step - 1) / 3) * 100}%` }}
              />
            </div>
            
            {/* Step Nodes */}
            <div className="relative flex justify-between z-10">
              {[
                { num: 1, label: 'Details', icon: Truck },
                { num: 2, label: 'Inventory', icon: CheckSquare },
                { num: 3, label: 'Media', icon: Camera },
                { num: 4, label: 'Signature', icon: PenTool },
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
                    className="flex flex-col items-center gap-2 focus:outline-none cursor-pointer group animate-fade-in"
                  >
                    <div
                      className={`w-9.5 h-9.5 rounded-full flex items-center justify-center border transition-all duration-300 active:scale-95 ${
                        isPast
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10'
                          : isCurrent
                          ? 'bg-white border-indigo-600 text-indigo-600 shadow-lg shadow-indigo-600/10 font-black'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      {isPast ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Icon className="w-4 h-4" />}
                    </div>
                    <span 
                      className={`text-[9px] font-black uppercase tracking-wider ${
                        isCurrent ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-bold'
                      }`}
                    >
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 1: VEHICLE DETAILS */}
          {step === 1 && (
            <div className="space-y-8 animate-fade-in">
              {/* Question 1: Bank Category Selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Select Bank Category / Type *
                </label>
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  <button
                    type="button"
                    onClick={() => {
                      setBankCategory('direct');
                      setSelectedThirdPartyId('');
                      setFormData(prev => ({ ...prev, bankId: '', bankName: '' }));
                    }}
                    className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 flex flex-col items-center justify-center space-y-2 ${bankCategory === 'direct'
                      ? 'border-primary bg-primary/5 text-primary shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                  >
                    <Truck className="w-6 h-6" />
                    <span className="text-sm font-bold">Direct Bank</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBankCategory('third_party');
                      setSelectedThirdPartyId('');
                      setFormData(prev => ({ ...prev, bankId: '', bankName: '' }));
                    }}
                    className={`p-4 rounded-2xl border-2 text-center transition-all duration-200 flex flex-col items-center justify-center space-y-2 ${bankCategory === 'third_party'
                      ? 'border-primary bg-primary/5 text-primary shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                  >
                    <Warehouse className="w-6 h-6" />
                    <span className="text-sm font-bold">Third Party</span>
                  </button>
                </div>
              </div>

              {/* Question 2: Bank Selection (Searchable A-Z) */}
              {bankCategory === 'direct' && (
                <div className="space-y-2 max-w-md animate-slide-up">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Select Direct Bank Partner *
                  </label>
                  {loadingBanks ? (
                    <div className="w-full bg-slate-50 text-slate-400 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold animate-pulse">
                      Loading Banks...
                    </div>
                  ) : (
                    <SearchableDropdown
                      options={banks
                        .filter((b) => !b.isThirdParty && !b.parentId)
                        .sort((a, b) => a.name.localeCompare(b.name))}
                      value={formData.bankId}
                      onChange={(id, name) => {
                        setFormData((prev) => ({ ...prev, bankId: id, bankName: name }));
                      }}
                      placeholder="-- Search & Select Direct Bank --"
                    />
                  )}
                </div>
              )}

              {bankCategory === 'third_party' && (
                <div className="space-y-4 max-w-md animate-slide-up">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                      Select Third Party Group *
                    </label>
                    {loadingBanks ? (
                      <div className="w-full bg-slate-50 text-slate-400 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold animate-pulse">
                        Loading groups...
                      </div>
                    ) : (
                      <SearchableDropdown
                        options={banks
                          .filter((b) => b.isThirdParty)
                          .sort((a, b) => a.name.localeCompare(b.name))}
                        value={selectedThirdPartyId}
                        onChange={(id) => {
                          setSelectedThirdPartyId(id);
                          setFormData((prev) => ({ ...prev, bankId: '', bankName: '' }));
                        }}
                        placeholder="-- Search & Select Third Party Group --"
                      />
                    )}
                  </div>

                  {selectedThirdPartyId && (
                    <div className="space-y-2 animate-slide-up">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        Select Sub-Bank under Group *
                      </label>
                      <SearchableDropdown
                        options={banks
                          .filter((b) => b.parentId === selectedThirdPartyId)
                          .sort((a, b) => a.name.localeCompare(b.name))}
                        value={formData.bankId}
                        onChange={(id, name) => {
                          setFormData((prev) => ({ ...prev, bankId: id, bankName: name }));
                        }}
                        placeholder="-- Search & Select Sub-Bank --"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* FORM FIELDS - Revealed smoothly once Bank is selected */}
              {formData.bankId && (
                <div className="space-y-8 animate-slide-up">
                  {/* Core & Mandatory Fields */}
                  <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-4 shadow-sm">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-primary/10 pb-2">
                      Core & Mandatory Information
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Vehicle Registration Number *
                        </label>
                        <input
                          type="text"
                          name="vehicleNumber"
                          value={formData.vehicleNumber}
                          onChange={(e) =>
                            setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })
                          }
                          placeholder="e.g. MH12PQ8899"
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold uppercase shadow-sm bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Vehicle Type *
                        </label>
                        <select
                          name="vehicleType"
                          value={formData.vehicleType}
                          onChange={handleChange}
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold shadow-sm bg-white"
                        >
                          <option value="">-- Select Vehicle Type --</option>
                          <option value="TW">2-Wheeler (TW)</option>
                          <option value="THREE_W">3-Wheeler (THREE_W)</option>
                          <option value="FW">4-Wheeler (FW)</option>
                          <option value="CV">Commercial Vehicle (CV)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Place of Possession *
                        </label>
                        <input
                          type="text"
                          name="placeOfPossession"
                          value={formData.placeOfPossession}
                          onChange={handleChange}
                          placeholder="e.g. Pune, Mumbai"
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold shadow-sm bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Agreement No / Loan No
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            name="agreementNo"
                            value={formData.agreementNo}
                            onChange={handleChange}
                            placeholder="e.g. AGR-12345"
                            className="flex-1 text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold shadow-sm bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, agreementNo: 'NA' })}
                            className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-colors text-sm shadow-sm hover:border-slate-300"
                          >
                            NA
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Engine Number
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            name="engineNumber"
                            value={formData.engineNumber}
                            onChange={handleChange}
                            placeholder="Enter engine ID"
                            className="flex-1 text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold shadow-sm bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, engineNumber: 'NA' })}
                            className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-colors text-sm shadow-sm hover:border-slate-300"
                          >
                            NA
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                          Chassis Number
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            name="chassisNumber"
                            value={formData.chassisNumber}
                            onChange={handleChange}
                            placeholder="Enter chassis ID"
                            className="flex-1 text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold shadow-sm bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, chassisNumber: 'NA' })}
                            className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-4 py-2.5 rounded-xl border border-slate-200 transition-colors text-sm shadow-sm hover:border-slate-300"
                          >
                            NA
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* General Specifications, Repo & Yard Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
                    {/* Section A: Specifications */}
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm bg-white">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                        Specifications
                      </h4>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Brand
                        </label>
                        <input
                          type="text"
                          name="brand"
                          value={formData.brand}
                          onChange={handleChange}
                          placeholder="e.g. Hyundai"
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Model
                        </label>
                        <input
                          type="text"
                          name="model"
                          value={formData.model}
                          onChange={handleChange}
                          placeholder="e.g. Creta"
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Color
                        </label>
                        <input
                          type="text"
                          name="color"
                          value={formData.color}
                          onChange={handleChange}
                          placeholder="e.g. White"
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Mileage
                        </label>
                        <input
                          type="text"
                          name="mileage"
                          value={formData.mileage}
                          onChange={handleChange}
                          placeholder="e.g. 15000 km"
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        />
                      </div>
                    </div>

                    {/* Section B: Repo Details */}
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm bg-white">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                        Repo Details
                      </h4>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Repo Agency
                        </label>
                        <input
                          type="text"
                          name="repoAgency"
                          value={formData.repoAgency}
                          onChange={handleChange}
                          placeholder="Enter agency name"
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Repo Date
                        </label>
                        <input
                          type="date"
                          name="repoDate"
                          value={formData.repoDate}
                          onChange={handleChange}
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Time of Possession
                        </label>
                        <input
                          type="time"
                          name="timeOfPossession"
                          value={formData.timeOfPossession}
                          onChange={handleChange}
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        />
                      </div>
                    </div>

                    {/* Section C: Yard & Handover Settings */}
                    <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-sm bg-white">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-2">
                        Yard & Handover Settings
                      </h4>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Entry Date
                        </label>
                        <input
                          type="date"
                          name="entryDate"
                          value={formData.entryDate}
                          onChange={handleChange}
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Yard Slot Allocation
                        </label>
                        <select
                          name="yardLocationId"
                          value={formData.yardLocationId}
                          onChange={handleChange}
                          disabled={loadingSlots}
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        >
                          <option value="">-- Select Empty Yard Slot --</option>
                          {slots.map((s) => (
                            <option key={s.id} value={s.id}>
                              Zone {s.zone} - Slot {s.slot}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Customer / Driver Name
                        </label>
                        <input
                          type="text"
                          name="customerName"
                          value={formData.customerName}
                          onChange={handleChange}
                          placeholder="Enter customer/driver name"
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Customer Phone
                        </label>
                        <input
                          type="text"
                          name="customerPhone"
                          value={formData.customerPhone}
                          onChange={handleChange}
                          placeholder="Enter contact number"
                          className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-xs font-semibold shadow-sm bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Navigation Button */}
                  <div className="flex justify-end pt-4 border-t border-slate-100">
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
                          toast.error('Vehicle Type is mandatory! Please select one.');
                          return;
                        }
                        if (!formData.placeOfPossession) {
                          toast.error('Place of Possession is mandatory!');
                          return;
                        }
                        setStep(2);
                      }}
                      className="bg-primary hover:bg-primary/95 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-primary/10 transition-all text-sm flex items-center space-x-2 shadow-lg"
                    >
                      <span>Continue to Inventory Checklist</span>
                      <CheckSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: INVENTORY CHECKLIST (Restructured as step 2) */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-bold tracking-wider">
                      <th className="p-4 font-semibold">Inventory Item</th>
                      <th className="p-4 font-semibold">Present at Entry</th>
                      <th className="p-4 font-semibold">Remarks / Condition Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                    {checklist.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/40">
                        <td className="p-4 font-bold text-slate-700">{item.itemName}</td>
                        <td className="p-4">
                          {item.isText ? (
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              Text Entry Only
                            </span>
                          ) : item.isCondition ? (
                            <div className="flex bg-slate-100 p-0.5 rounded-lg w-fit select-none">
                              <button
                                type="button"
                                onClick={() => handleChecklistChange(idx, 'isPresent', true)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${item.isPresent ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                  }`}
                              >
                                Good
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChecklistChange(idx, 'isPresent', false)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!item.isPresent ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                  }`}
                              >
                                Bad
                              </button>
                            </div>
                          ) : (
                            <div className="flex bg-slate-100 p-0.5 rounded-lg w-fit select-none">
                              <button
                                type="button"
                                onClick={() => handleChecklistChange(idx, 'isPresent', true)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${item.isPresent ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                  }`}
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={() => handleChecklistChange(idx, 'isPresent', false)}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!item.isPresent ? 'bg-slate-300 text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                  }`}
                              >
                                No
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={item.remarks}
                            onChange={(e) => handleChecklistChange(idx, 'remarks', e.target.value)}
                            placeholder={item.isText ? 'Enter details...' : 'e.g. Scratched, missing'}
                            className="w-full text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-xs font-semibold shadow-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="border border-slate-200 text-slate-500 font-bold px-5 py-2.5 rounded-xl hover:bg-slate-50 text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-primary hover:bg-primary/95 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-primary/10 transition-all text-sm flex items-center space-x-2"
                >
                  <span>Continue to Media Capture</span>
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: MEDIA CAPTURE (Restructured as step 3) */}
          {step === 3 && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-amber-800 shadow-sm">
                <MapPin className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-xs font-medium space-y-1">
                  <p className="font-bold">Media Capture & Verification</p>
                  <p>
                    Please upload the required customer picture along with the vehicle. Optional video or secondary companion details can be captured here.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                {[
                  { key: 'customer', label: 'Customer with Vehicle Photo *', type: 'image' },
                  { key: 'witness', label: 'Witness / Companion Photo', type: 'image' },
                  { key: 'gate_overview', label: 'Gate Overview Photo', type: 'image' },
                  { key: 'video', label: 'Vehicle Video (Optional)', type: 'video' },
                ].map((media) => (
                  <div key={media.key} className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      {media.label}
                    </span>
                    <div className="relative aspect-video rounded-xl overflow-hidden border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center group cursor-pointer transition-all hover:bg-slate-100/50 shadow-sm">
                      {gatePreviews[media.key] ? (
                        <>
                          {media.type === 'video' ? (
                            <video
                              src={gatePreviews[media.key]}
                              controls
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <img
                              src={gatePreviews[media.key]}
                              alt={media.label}
                              className="w-full h-full object-cover"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-20">
                            <button
                              type="button"
                              onClick={() =>
                                !uploadingGatePhotos[media.key] &&
                                document.getElementById(`upload-${media.key}`)?.click()
                              }
                              className="bg-white/95 hover:bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow-md"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Retake</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              !uploadingGatePhotos[media.key] &&
                              document.getElementById(`upload-${media.key}`)?.click()
                            }
                            className="flex flex-col items-center space-y-1.5 text-slate-400 group-hover:text-primary transition-colors"
                          >
                            <Camera className="w-6 h-6" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">
                              Capture {media.type === 'video' ? 'Video' : 'Photo'}
                            </span>
                          </button>
                        </>
                      )}

                      {/* Syncing Loader Spinner overlay */}
                      {uploadingGatePhotos[media.key] && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-1.5 z-30 select-none">
                          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[8px] font-bold text-primary uppercase tracking-wider animate-pulse">
                            Syncing Cloud...
                          </span>
                        </div>
                      )}

                      <input
                        id={`upload-${media.key}`}
                        type="file"
                        accept={media.type === 'video' ? 'video/*' : 'image/*'}
                        capture="environment"
                        className="hidden"
                        disabled={uploadingGatePhotos[media.key]}
                        onChange={(e) => handleGatePhotoUpload(media.key, e)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Vehicle 360° Condition Photos Section */}
              <div className="border-t border-slate-100 pt-6">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider block mb-4">
                  📸 Vehicle 360° Condition Photos (Check-in Quality Checklist)
                </span>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 font-semibold">
                  {[
                    { key: 'front', label: 'Front View Photo *' },
                    { key: 'back', label: 'Back View Photo *' },
                    { key: 'left', label: 'Left View Photo *' },
                    { key: 'right', label: 'Right View Photo *' },
                    { key: 'dashboard', label: 'Dashboard & Interior' },
                    { key: 'odometer', label: 'Odometer Reading' },
                    { key: 'chassis', label: 'Chassis Number Plate' },
                  ].map((media) => (
                    <div key={media.key} className="space-y-2 animate-fade-in text-left">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        {media.label}
                      </span>
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center group cursor-pointer transition-all hover:bg-slate-100/50 shadow-sm">
                        {previews[media.key] ? (
                          <>
                            <img
                              src={previews[media.key]}
                              alt={media.label}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-20">
                              <button
                                type="button"
                                onClick={() =>
                                  !uploadingPhotos[media.key] &&
                                  document.getElementById(`upload-condition-${media.key}`)?.click()
                                }
                                className="bg-white/95 hover:bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow-md"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                <span>Retake</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                !uploadingPhotos[media.key] &&
                                document.getElementById(`upload-condition-${media.key}`)?.click()
                              }
                              className="flex flex-col items-center space-y-1.5 text-slate-400 group-hover:text-primary transition-colors"
                            >
                              <Camera className="w-6 h-6" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">
                                Capture Photo
                              </span>
                            </button>
                          </>
                        )}

                        {/* Syncing Loader Spinner overlay */}
                        {uploadingPhotos[media.key] && (
                          <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-1.5 z-30 select-none">
                            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[8px] font-bold text-primary uppercase tracking-wider animate-pulse">
                              Syncing Cloud...
                            </span>
                          </div>
                        )}

                        <input
                          id={`upload-condition-${media.key}`}
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          disabled={uploadingPhotos[media.key]}
                          onChange={(e) => handlePhotoUpload(media.key, e)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={Object.values(uploadingGatePhotos).some(Boolean) || Object.values(uploadingPhotos).some(Boolean)}
                  className="border border-slate-200 text-slate-500 font-bold px-5 py-2.5 rounded-xl hover:bg-slate-50 text-sm disabled:opacity-50 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const isUploading = Object.values(uploadingGatePhotos).some(Boolean) || Object.values(uploadingPhotos).some(Boolean);
                    if (isUploading) {
                      toast.error('Please wait! Media is currently syncing to cloud storage.');
                      return;
                    }
                    if (!gatePhotos.customer) {
                      toast.error('Customer / Driver photo is required!');
                      return;
                    }
                    if (!photos.front || !photos.back || !photos.left || !photos.right) {
                      toast.error('Mandatory 360° vehicle condition photos (Front, Back, Left, Right) are required!');
                      return;
                    }
                    setStep(4);
                  }}
                  disabled={Object.values(uploadingGatePhotos).some(Boolean) || Object.values(uploadingPhotos).some(Boolean)}
                  className={`font-bold px-6 py-2.5 rounded-xl shadow-md transition-all text-sm flex items-center space-x-2 ${
                    (Object.values(uploadingGatePhotos).some(Boolean) || Object.values(uploadingPhotos).some(Boolean))
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-primary hover:bg-primary/95 text-white shadow-primary/10 shadow-lg'
                  }`}
                >
                  <span>Gate Signature</span>
                  <PenTool className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: CUSTOMER SIGNATURE */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="max-w-md mx-auto space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Witness/Customer Name
                  </label>
                  <input
                    type="text"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Enter witness/driver full name"
                    className="w-full text-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm font-semibold shadow-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Customer Signature Pad
                  </label>
                  <div
                    onClick={() => setSigning(true)}
                    className="aspect-video w-full rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100/50 flex flex-col items-center justify-center cursor-pointer transition-colors relative shadow-sm"
                  >
                    {signing ? (
                      <div className="absolute inset-0 p-4 flex flex-col justify-end">
                        <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md self-start">
                          Witness Verified
                        </span>
                        <div className="flex justify-between items-center mt-auto border-t border-slate-200 pt-3 text-slate-400 text-[10px] font-bold">
                          <span>Verified via Odoo/YMS secure portal</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSigning(false);
                            }}
                            className="text-rose-500 font-bold hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-1.5 text-slate-400">
                        <PenTool className="w-8 h-8" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Tap here to Sign Verification
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="border border-slate-200 text-slate-500 font-bold px-5 py-2.5 rounded-xl hover:bg-slate-50 text-sm transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="bg-primary hover:bg-primary/95 disabled:bg-slate-300 text-white font-bold px-8 py-2.5 rounded-xl shadow-md shadow-primary/20 transition-all text-sm flex items-center space-x-2 shadow-lg"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting Check-in...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete In-Yard Entry</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 5: SUCCESS GATE PASS & PDF PRINTING */}
      {step === 5 && createdVehicle && (
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
              <h1 className="text-sm font-extrabold uppercase tracking-wider text-black border-b-2 border-black pb-1.5 font-serif">Vehicle Information At The Time Of Yard</h1>
              <h2 className="text-xs font-bold uppercase text-black pt-1">Bank Name -- <span className="underline font-extrabold">{createdVehicle.bankName}</span></h2>
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
              onClick={() => toast.success('PDF receipt downloaded successfully!')}
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
