import React, { useState } from 'react';
import { X, Printer, Check, Wifi, Settings2, FileText, Sliders } from 'lucide-react';
import { useToastStore } from '../store/toastStore';

interface PrintSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrintSetupModal: React.FC<PrintSetupModalProps> = ({ isOpen, onClose }) => {
  const toast = useToastStore();
  const [paperWidth, setPaperWidth] = useState<'58mm' | '80mm'>('80mm');
  const [printerAddress, setPrinterAddress] = useState('192.168.1.100');
  const [autoPrintCheckIn, setAutoPrintCheckIn] = useState(true);
  const [headerTitle, setHeaderTitle] = useState('YMS REPO YARD');
  const [footerNote, setFooterNote] = useState('Thank you! Drive safely.');

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('yms_print_config', JSON.stringify({ paperWidth, printerAddress, autoPrintCheckIn, headerTitle, footerNote }));
    toast.success('Printer preferences saved successfully');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide font-display">Thermal Print Configuration</h2>
              <p className="text-xs text-slate-400">Configure receipt & gate pass printers</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Options */}
        <div className="space-y-4 text-xs">
          {/* Paper Width */}
          <div>
            <label className="font-bold text-slate-300 block mb-1.5">Paper Width</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`py-2.5 px-3 rounded-xl font-bold border transition-all ${
                  paperWidth === '58mm'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                2-Inch (58mm)
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`py-2.5 px-3 rounded-xl font-bold border transition-all ${
                  paperWidth === '80mm'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                3-Inch (80mm Standard)
              </button>
            </div>
          </div>

          {/* Network Printer Address */}
          <div>
            <label className="font-bold text-slate-300 block mb-1">Network Printer IP / Bluetooth MAC</label>
            <input
              type="text"
              value={printerAddress}
              onChange={(e) => setPrinterAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              placeholder="e.g. 192.168.1.100 or 00:11:22:33:44:55"
            />
          </div>

          {/* Receipt Header & Footer */}
          <div>
            <label className="font-bold text-slate-300 block mb-1">Receipt Header Text</label>
            <input
              type="text"
              value={headerTitle}
              onChange={(e) => setHeaderTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-300 block mb-1">Receipt Footer Note</label>
            <input
              type="text"
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Auto Print Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="font-bold text-slate-200 block">Auto-Print on Check-In</span>
              <span className="text-[10px] text-slate-400">Trigger thermal print immediately upon check-in</span>
            </div>
            <input
              type="checkbox"
              checked={autoPrintCheckIn}
              onChange={(e) => setAutoPrintCheckIn(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2"
        >
          <Check className="w-4 h-4" />
          <span>Save Preferences</span>
        </button>
      </div>
    </div>
  );
};
