import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, X, Info } from "lucide-react";

const ToastContext = createContext();
export function useToast() { return useContext(ToastContext); }

const ICONS = { success: CheckCircle, error: AlertCircle, info: Info };
const STYLES = {
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, type = "success", duration = 3500) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);
  const toast = {
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "error"),
    info: (msg) => addToast(msg, "info"),
  };
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{maxWidth:"360px"}}>
        {toasts.map(t => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={"flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium pointer-events-auto animate-slide-up " + STYLES[t.type]}>
              <Icon size={16} className="flex-shrink-0" />
              <span className="flex-1">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
