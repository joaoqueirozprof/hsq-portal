import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { devicesAPI, positionsAPI } from "../../services/api";
import {
  LayoutDashboard, Car, MapPin, FileText, Bell, LogOut,
  Menu, X, ChevronRight, Wifi, Shield, Zap, Activity,
  Users, Wrench, Terminal
} from "lucide-react";

const navItems = [
  { path: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { path: "/devices", icon: Car, label: "Veículos" },
  { path: "/geofences", icon: MapPin, label: "Geocercas" },
  { path: "/drivers", icon: Users, label: "Motoristas" },
  { path: "/reports", icon: FileText, label: "Relatórios" },
  { path: "/events", icon: Activity, label: "Eventos" },
  { path: "/maintenance", icon: Wrench, label: "Manutenção" },
  { path: "/commands", icon: Terminal, label: "Comandos" },
];

const adminItems = [
  { path: "/admin/users", icon: Shield, label: "Usuários" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ total: 0, online: 0 });

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

  const getPageTitle = () => {
    const map = {
      "/": "Dashboard", "/devices": "Veículos", "/geofences": "Geocercas",
      "/drivers": "Motoristas", "/reports": "Relatórios", "/events": "Eventos",
      "/maintenance": "Manutenção", "/commands": "Comandos", "/admin/users": "Usuários"
    };
    return map[location.pathname] || "HSQ Portal";
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:relative inset-y-0 left-0 z-30 w-60 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0" style={{boxShadow: "0 0 16px rgba(37,99,235,0.4)"}}>
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-100 text-sm leading-none" style={{fontFamily: "Space Grotesk,sans-serif"}}>HSQ Portal</p>
            <p className="text-xs text-slate-500 mt-0.5">Rastreamento</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-slate-500 hover:text-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="mx-3 mt-3 px-3 py-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">{stats.total} veículos</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 status-pulse" />
              <span className="text-green-400 font-medium">{stats.online} online</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Principal</p>
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
              <p className="px-3 pt-4 pb-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Admin</p>
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

        <div className="p-3 border-t border-slate-800">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-800/50">
            <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-600/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-400 text-xs font-bold uppercase">{user?.name?.charAt(0) || "U"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-100 text-xs font-medium truncate">{user?.name}</p>
              <p className="text-slate-500 text-xs capitalize">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-slate-700" title="Sair">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center px-4 gap-4 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-slate-100">
            <Menu size={20} />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <span className="text-slate-600 text-xs">HSQ</span>
            <ChevronRight size={12} className="text-slate-700" />
            <span className="text-slate-200 text-xs font-medium">{getPageTitle()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-green-400">
            <Wifi size={13} />
            <span className="hidden sm:inline text-xs">Online</span>
          </div>
          <button className="text-slate-500 hover:text-slate-100 p-2 rounded-xl hover:bg-slate-800 transition-colors">
            <Bell size={17} />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
