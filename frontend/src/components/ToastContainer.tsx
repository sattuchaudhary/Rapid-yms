import React from 'react';
import { useToastStore } from '../store/toastStore';
import type { Toast } from '../store/toastStore';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col space-y-3 max-w-sm w-full select-none pointer-events-none">
      {toasts.map((toast: Toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start space-x-3.5 p-4 rounded-2xl border backdrop-blur-md shadow-lg transition-all duration-300 transform translate-y-0 animate-slide-in-right ${
              isSuccess
                ? 'bg-emerald-50/90 text-emerald-800 border-emerald-200 shadow-emerald-500/5'
                : isError
                ? 'bg-rose-50/90 text-rose-800 border-rose-200 shadow-rose-500/5'
                : 'bg-blue-50/90 text-blue-800 border-blue-200 shadow-blue-500/5'
            }`}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              {isSuccess ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : isError ? (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              ) : (
                <Info className="w-5 h-5 text-blue-600" />
              )}
            </div>

            {/* Message */}
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {toast.message}
            </div>

            {/* Close Button */}
            <button
              onClick={() => remove(toast.id)}
              className={`shrink-0 p-0.5 rounded-lg transition-colors ${
                isSuccess
                  ? 'text-emerald-500 hover:bg-emerald-100 hover:text-emerald-700'
                  : isError
                  ? 'text-rose-500 hover:bg-rose-100 hover:text-rose-700'
                  : 'text-blue-500 hover:bg-blue-100 hover:text-blue-700'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
