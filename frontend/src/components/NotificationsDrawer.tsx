import React from 'react';
import { X, Bell, ShieldAlert, CheckCircle2, Clock, CloudSync, ArrowRight } from 'lucide-react';

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MOCK_NOTIFICATIONS = [
  { id: '1', title: 'Vehicle Check-In Verified', desc: 'MH-12-AB-1234 moved to PAKKA status', time: '10 mins ago', type: 'success' },
  { id: '2', title: 'Offline Queue Synchronized', desc: '4 offline check-in jobs synced with cloud', time: '1 hour ago', type: 'sync' },
  { id: '3', title: 'Overdue Parking Alert', desc: 'Vehicle KA-01-EF-9988 exceeded 90 days threshold', time: '3 hours ago', type: 'warning' },
  { id: '4', title: 'Daily Report Ready', desc: 'Summary report generated for active yard', time: '5 hours ago', type: 'info' },
];

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full p-6 space-y-6 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-wide font-display">Notifications & Sync Feed</h2>
              <p className="text-xs text-slate-400">System alerts and background sync activity</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notification Feed List */}
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {MOCK_NOTIFICATIONS.map((n) => (
            <div key={n.id} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white">{n.title}</span>
                <span className="text-[10px] text-slate-500 font-semibold">{n.time}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{n.desc}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors"
        >
          Close Drawer
        </button>
      </div>
    </div>
  );
};
