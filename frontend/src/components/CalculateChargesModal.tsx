import React, { useState } from 'react';
import { X, Calculator, Calendar, DollarSign, Tag, RefreshCw, Car } from 'lucide-react';
import { useToastStore } from '../store/toastStore';

interface CalculateChargesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculateChargesModal: React.FC<CalculateChargesModalProps> = ({ isOpen, onClose }) => {
  const toast = useToastStore();
  const [vehicleType, setVehicleType] = useState<'TW' | 'THREE_W' | 'FW' | 'CV'>('FW');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exitDate, setExitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyRate, setDailyRate] = useState('200');
  const [towingCharge, setTowingCharge] = useState('0');
  const [handlingCharge, setHandlingCharge] = useState('0');
  const [discount, setDiscount] = useState('0');

  if (!isOpen) return null;

  // Calculate duration in days (minimum 1 day)
  const start = new Date(entryDate);
  const end = new Date(exitDate);
  const diffTime = Math.max(0, end.getTime() - start.getTime());
  const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

  const rate = Number(dailyRate) || 0;
  const storageTotal = days * rate;
  const towing = Number(towingCharge) || 0;
  const handling = Number(handlingCharge) || 0;
  const disc = Number(discount) || 0;
  const grandTotal = Math.max(0, storageTotal + towing + handling - disc);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide font-display">Charges Calculator</h2>
              <p className="text-xs text-slate-400">Estimate parking storage and extra charges</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          {/* Vehicle Type */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Vehicle Category</label>
            <div className="grid grid-cols-4 gap-2">
              {(['TW', 'THREE_W', 'FW', 'CV'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setVehicleType(t);
                    setDailyRate(t === 'TW' ? '50' : t === 'THREE_W' ? '100' : t === 'FW' ? '200' : '350');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                    vehicleType === t
                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Check-in Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Check-out Date</label>
              <input
                type="date"
                value={exitDate}
                onChange={(e) => setExitDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Daily Rate & Towing & Handling & Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Daily Rate (₹)</label>
              <input
                type="number"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Discount (₹)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Calculation Summary Breakdown */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 text-xs">
          <div className="flex justify-between text-slate-400">
            <span>Duration ({days} Days × ₹{rate}/day)</span>
            <span className="font-bold text-white">₹{storageTotal.toLocaleString()}</span>
          </div>
          {disc > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Discount</span>
              <span className="font-bold">- ₹{disc.toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-slate-800 pt-2.5 flex justify-between items-center text-sm font-black text-white">
            <span className="text-indigo-400">Estimated Total Charge</span>
            <span className="text-lg text-emerald-400 font-extrabold">₹{grandTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all"
        >
          Close Calculator
        </button>
      </div>
    </div>
  );
};
