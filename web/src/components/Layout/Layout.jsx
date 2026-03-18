import { useState, useEffect, useCallback } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { devicesAPI, positionsAPI } from "../../services/api";
import {
  LayoutDashboard, Car, MapPin, FileText, Bell, LogOut,
  Menu, X, ChevronRight, Wifi, Shield, Zap, Activity,
  Users, Wrench, Terminal, Layers, Download, WifiOff
} from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { path: "/devices", icon: Car, label: "Veículos" },
  { path: "/geofences", icon: MapPin, label: "Geocercas" },
  { path: "/groups", icon: Layers, label: "Grupos" },
  { path: "/drivers", icon: Users, label: "Motoristas" },
  { path: "/reports", icon: FileText, label: "Relatórios" },
  { path: "/events", icon: Activity, label: "Eventos" },
  { path: "/maintenance", icon: Wrench, label: "Manutenção" },
  { path: "/commands", icon: Terminal, label: "Comandos" },
];

const adminItems = [
  { path: "/admin/users", icon: Shield, label: "Usuários" },
];

// PWA install prompt
function PWAInstallBanner({ onDismiss }) {
  return (
    <div className="pwa-banner">
      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Zap size={18} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">Instalar HSQ Portal</p>
        <p className="text-xs text-slate-500 mt-0.5">Adicione à tela inicial para acesso rápido</p>
      </div>
      <button
        id="pwa-install-btn"
        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
      >
        Instalar
      </button>
      <button onClick={onDismiss} className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, online: 0 });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPWA, setShowPWA] = useState(false);

  // Online/offline detection
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const dismissed = localStorage.getItem('pwa-dismissed');
      if (!dismissed) setShowPWA(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowPWA(false);
    if (outcome === 'accepted') localStorage.setItem('pwa-installed', 'true');
  };

  const handleDismissPWA = () => {
    setShowPWA(false);
    localStorage.setItem('pwa-dismissed', 'true');
  };

  // Wire install button
  useEffect(() => {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.onclick = handleInstall;
  }, [showPWA, deferredPrompt]);

  // Stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [devRes, posRes] = await Promise.all([devicesAPI.list(), positionsAPI.list()]);
        setStats({ total: (devRes.data || []).length, online: (posRes.data || []).length });
      } catch (e) {}
    };
    fetchStats();
    const i = setInterval(fetchStats, 15000);
    return () => clearInterval(i);
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  const pageTitle = {
    "/": "Dashboard", "/devices": "Veículos", "/geofences": "Geocercas",
    "/groups": "Grupos", "/drivers": "Motoristas", "/reports": "Relatórios",
    "/events": "Eventos", "/maintenance": "Manutenção", "/commands": "Comandos",
    "/admin/users": "Usuários"
  }[location.pathname] || "HSQ Portal";

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-30
        w-64 bg-white border-r border-slate-200 flex flex-col
        transition-transform duration-300 ease-in-out shadow-lg lg:shadow-none
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Zap size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-900 text-sm leading-none" style={{fontFamily:"Space Grotesk,sans-serif"}}>HSQ Portal</p>
            <p className="text-xs text-slate-400 mt-0.5">Rastreamento GPS</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Stats pill */}
        <div className="mx-4 mt-3 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car size={13} className="text-slate-400" />
              <span className="text-slate-600 text-xs">{stats.total} veículos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 status-pulse" />
              <span className="text-green-600 text-xs font-semibold">{stats.online} online</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</p>
          {navItems.map(({ path, icon: Icon, label, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => isActive ? "sidebar-item-active" : "sidebar-item-inactive"}
            >
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}

          {user?.role === "admin" && (
            <>
              <p className="px-3 pt-5 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Admin</p>
              {adminItems.map(({ path, icon: Icon, label }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => isActive ? "sidebar-item-active" : "sidebar-item-inactive"}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User profile */}
        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-700 text-xs font-bold uppercase">{user?.name?.charAt(0) || "U"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-900 text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-slate-400 text-xs capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
              title="Sair"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb */}
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400 text-sm hidden sm:block">HSQ</span>
            <ChevronRight size={14} className="text-slate-300 hidden sm:block" />
            <span className="text-slate-800 text-sm font-semibold truncate">{pageTitle}</span>
          </div>

          {/* Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isOnline ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"
          }`}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors">
            <Bell size={18} />
          </button>

          {/* Mobile install PWA */}
          {deferredPrompt && (
            <button
              onClick={handleInstall}
              className="sm:hidden p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              title="Instalar app"
            >
              <Download size={18} />
            </button>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-5 lg:p-6 max-w-screen-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* PWA install banner */}
      {showPWA && <PWAInstallBanner onDismiss={handleDismissPWA} />}
    </div>
  );
}
