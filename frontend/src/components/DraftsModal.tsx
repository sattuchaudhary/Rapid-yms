import React, { useState, useEffect } from 'react';
import { X, FileText, Trash2, ArrowRight, Clock, PlusCircle } from 'lucide-react';
import { useToastStore } from '../store/toastStore';

interface DraftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResumeDraft?: (draftData: any) => void;
}

export const DraftsModal: React.FC<DraftsModalProps> = ({ isOpen, onClose, onResumeDraft }) => {
  const toast = useToastStore();
  const [drafts, setDrafts] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadDrafts();
    }
  }, [isOpen]);

  const loadDrafts = () => {
    try {
      const saved = localStorage.getItem('yms_offline_drafts');
      if (saved) {
        setDrafts(JSON.parse(saved));
      } else {
        setDrafts([]);
      }
    } catch (e) {
      setDrafts([]);
    }
  };

  const deleteDraft = (id: string) => {
    const updated = drafts.filter((d) => d.id !== id);
    setDrafts(updated);
    localStorage.setItem('yms_offline_drafts', JSON.stringify(updated));
    toast.info('Draft deleted');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide font-display">Offline & Saved Drafts</h2>
              <p className="text-xs text-slate-400">Resume pending vehicle check-ins</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Draft List */}
        {drafts.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400 font-semibold">No saved check-in drafts found</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {drafts.map((d) => (
              <div key={d.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-white">{d.title || 'Untitled Draft'}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{d.subtitle || 'Vehicle Check-In'}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      if (onResumeDraft) onResumeDraft(d.data);
                      onClose();
                    }}
                    className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteDraft(d.id)}
                    className="p-2 rounded-xl bg-rose-950/40 text-rose-400 border border-rose-900/40 hover:bg-rose-900/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
