import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Layout from "./components/Layout/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import DevicesPage from "./pages/DevicesPage";
import GeofencesPage from "./pages/GeofencesPage";
import ReportsPage from "./pages/ReportsPage";
import EventsPage from "./pages/EventsPage";
import DriversPage from "./pages/DriversPage";
import MaintenancePage from "./pages/MaintenancePage";
import CommandsPage from "./pages/CommandsPage";
import GroupsPage from "./pages/GroupsPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import TrackingPage from "./pages/TrackingPage";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Carregando...</p>
      </div>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  return user?.role === "admin" ? children : <Navigate to="/" replace />;
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
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="commands" element={<CommandsPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="tracking" element={<TrackingPage />} />
        <Route path="admin/users" element={<AdminRoute><AdminUsersPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={
        <div className="flex items-center justify-center h-screen bg-slate-50">
          <div className="text-center">
            <p className="text-6xl font-black text-slate-200 mb-2">404</p>
            <p className="text-slate-500 text-sm mb-4">Pagina nao encontrada</p>
            <a href="/" className="text-blue-600 text-sm font-medium hover:underline">Voltar ao Dashboard</a>
          </div>
        </div>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
