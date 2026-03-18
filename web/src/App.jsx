import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DevicesPage from "./pages/DevicesPage";
import GeofencesPage from "./pages/GeofencesPage";
import ReportsPage from "./pages/ReportsPage";
import EventsPage from "./pages/EventsPage";
import DriversPage from "./pages/DriversPage";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Carregando...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function ComingSoon({ title }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
        <span className="text-2xl">🚧</span>
      </div>
      <h2 className="text-lg font-semibold text-slate-300 mb-1">{title}</h2>
      <p className="text-slate-600 text-sm">Em desenvolvimento — disponível em breve</p>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="geofences" element={<GeofencesPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="maintenance" element={<ComingSoon title="Manutenção" />} />
        <Route path="commands" element={<ComingSoon title="Comandos" />} />
        <Route path="admin/users" element={<ComingSoon title="Gerenciamento de Usuários" />} />
        <Route path="map" element={<DashboardPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
