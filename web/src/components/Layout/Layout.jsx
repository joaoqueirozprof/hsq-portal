import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { devicesAPI, positionsAPI } from "../../services/api";
import {
  LayoutDashboard, Car, MapPin, FileText, Bell, LogOut,
  Menu, X, ChevronRight, Wifi, Shield, Zap, Activity,
  Users, Wrench, Terminal, Layers, Download, WifiOff, Share, Crosshair
} from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { path: "/tracking", icon: Crosshair, label: "Rastreamento" },
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

function isIOSNotInstalled() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
  const isStandalone = "standalone" in window.navigator && window.navigator.standalone;
  const dismissed = localStorage.getItem("pwa-ios-dismissed");
  return isIOS && !isStandalone && !dismissed;
}

function PWAInstallBanner({ onDismiss, onInstall }) {
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
        onClick={onInstall}
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

function IOSInstallBanner({ onDismiss }) {
  return (
    <div className="pwa-banner" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Instalar HSQ Portal</p>
            <p className="text-xs text-slate-500">Adicione à tela inicial do iPhone</p>
          </div>
        </div>
        <button onClick={onDismiss} className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0">
          <X size={16} />
        </button>
      </div>
      <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2.5 border border-blue-100">
        <span className="text-blue-600 mt-0.5 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
        </span>
        <p className="text-xs text-blue-800 leading-relaxed">
          Toque no botão <strong>Compartilhar</strong> (seta para cima &#x2191;) na barra do Safari
          e selecione <strong>&quot;Adicionar à Tela de Início&quot;</strong>.
        </p>
      </div>
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
  const [showAndroidPWA, setShowAndroidPWA] = useState(false);
  const [showIOSBanner, setShowIOSBanner] = useState(() => isIOSNotInstalled());

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!localStorage.getItem("pwa-dismissed")) setShowAndroidPWA(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowAndroidPWA(false);
    if (outcome === "accepted") localStorage.setItem("pwa-installed", "true");
  };

  const handleDismissAndroid = () => {
    setShowAndroidPWA(false);
    localStorage.setItem("pwa-dismissed", "true");
  };

  const handleDismissIOS = () => {
    setShowIOSBanner(false);
    localStorage.setItem("pwa-ios-dismissed", "true");
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [devRes, posRes] = await Promise.all([devicesAPI.list(), positionsAPI.list()]);
        setStats({ total: (devRes.data || []).length, online: (posRes.data || []).length });
      } catch {}
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
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[2000] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-[2001]
        w-64 bg-white border-r border-slate-200 flex flex-col
        transition-transform duration-300 ease-in-out shadow-lg lg:shadow-none
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
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

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 flex-shrink-0 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label="Menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <span className="text-slate-400 text-sm hidden sm:block">HSQ</span>
            <ChevronRight size={14} className="text-slate-300 hidden sm:block" />
            <span className="text-slate-800 text-sm font-semibold truncate">{pageTitle}</span>
          </div>

          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isOnline ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"
          }`}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
          </div>

          <button className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors">
            <Bell size={18} />
          </button>

          {deferredPrompt && (
            <button
              onClick={handleAndroidInstall}
              className="sm:hidden p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              title="Instalar app"
            >
              <Download size={18} />
            </button>
          )}

          {showIOSBanner && !deferredPrompt && (
            <button
              onClick={() => setShowIOSBanner(true)}
              className="sm:hidden p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
              title="Como instalar no iPhone"
            >
              <Share size={18} />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-5 lg:p-6 max-w-screen-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {showAndroidPWA && (
        <PWAInstallBanner onDismiss={handleDismissAndroid} onInstall={handleAndroidInstall} />
      )}

      {showIOSBanner && (
        <IOSInstallBanner onDismiss={handleDismissIOS} />
      )}
    </div>
  );
}
