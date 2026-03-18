import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Map, Car, History, LogOut, Menu, User, Menu as MenuIcon, X
} from 'lucide-react';

const bottomMenuItems = [
  { path: '/cliente', label: 'Mapa', icon: Map },
  { path: '/cliente/veiculos', label: 'Veículos', icon: Car },
  { path: '/cliente/historico', label: 'Histórico', icon: History },
  { path: '/cliente/perfil', label: 'Perfil', icon: User },
];

export default function ClientLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (path === '/cliente') return location.pathname === '/cliente';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-gradient-to-b from-blue-600 to-blue-800 text-white fixed inset-y-0 left-0 z-30">
        <div className="p-4 border-b border-blue-500">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Car className="w-6 h-6" />
            HSQ Rastreie
          </h1>
          <p className="text-sm text-blue-200">Portal do Cliente</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {bottomMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active ? 'bg-white text-blue-600' : 'text-white hover:bg-blue-500'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white text-blue-600 flex items-center justify-center">
              <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Cliente'}</p>
              <p className="text-xs text-blue-200 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-white hover:bg-blue-500 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <aside className={`
        fixed lg:hidden inset-y-0 left-0 z-40
        w-72 bg-gradient-to-b from-blue-600 to-blue-800 text-white transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        flex flex-col
      `}>
        <div className="p-4 border-b border-blue-500 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Car className="w-6 h-6" />
              HSQ Rastreie
            </h1>
            <p className="text-sm text-blue-200">Portal do Cliente</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-blue-500 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {bottomMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active ? 'bg-white text-blue-600' : 'text-white hover:bg-blue-500'
                }`}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white text-blue-600 flex items-center justify-center">
              <User size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'Cliente'}</p>
              <p className="text-xs text-blue-200 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-white hover:bg-blue-500 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64 pb-20 lg:pb-0">
        {/* Top bar */}
        <header className="bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg active:bg-gray-200"
            >
              <MenuIcon size={24} />
            </button>
            <h2 className="text-lg font-semibold text-gray-800">
              Olá, {user?.name?.split(' ')[0] || 'Cliente'}
            </h2>
          </div>
          <div className="text-sm text-gray-500 hidden sm:block">
            Acompanhe seus veículos
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-area-bottom">
          <div className="flex items-center justify-around">
            {bottomMenuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex-1 flex flex-col items-center py-3 transition-colors ${
                    active ? 'text-blue-600' : 'text-gray-500'
                  }`}
                >
                  <Icon size={22} className="mb-1" />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
