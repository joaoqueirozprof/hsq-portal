import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useToastStore } from '@/store/toast';
import api from '@/api/client';
import Modal from '@/components/ui/Modal';
import Loading from '@/components/ui/Loading';
import { maskDocument, maskPhone, cleanDocument } from '@/utils/masks';
import { formatDateTime, timeAgo } from '@/utils/format';
import { mapVehicleEmojis } from '@/utils/vehicleIcons';

type AdminTab = 'dashboard' | 'clients' | 'devices' | 'online' | 'audit';

interface Client {
  id: string;
  document: string;
  document_type: string;
  name: string;
  trade_name?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  is_active: boolean;
  is_first_login: boolean;
  last_login_at?: string;
  last_logout_at?: string;
  traccar_user_id?: number;
}

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  recentLogins: number;
  onlineNow: number;
}

interface Device {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate?: string;
  category?: string;
  clientName?: string;
  clientId?: string;
}

interface OnlineUser {
  name: string;
  document: string;
  isOnline: boolean;
  lastLoginAt?: string;
  minutesSinceActivity?: number;
}

interface AuditEntry {
  id: number;
  user_type: string;
  user_id: string;
  action: string;
  details?: string;
  ip_address: string;
  created_at: string;
  user_name?: string;
}

// ========== VEHICLE CATEGORIES ==========
const VEHICLE_CATEGORIES = [
  { key: 'car', label: 'Carro' },
  { key: 'truck', label: 'Caminhao' },
  { key: 'motorcycle', label: 'Moto' },
  { key: 'bus', label: 'Onibus' },
  { key: 'van', label: 'Van' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'tractor', label: 'Trator' },
  { key: 'boat', label: 'Barco' },
  { key: 'person', label: 'Pessoa' },
  { key: 'animal', label: 'Animal' },
];

function getIconPreviewSvg(category: string, size = 28): string {
  const svgTemplate = mapVehicleEmojis[category] || mapVehicleEmojis.car;
  return svgTemplate.replace(/VW/g, String(size)).replace(/VH/g, String(size));
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<DashboardStats>({ totalClients: 0, activeClients: 0, recentLogins: 0, onlineNow: 0 });
  const [clients, setClients] = useState<Client[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [newClientOpen, setNewClientOpen] = useState(false);

  // Device modal states
  const [newDeviceOpen, setNewDeviceOpen] = useState(false);
  const [assignDeviceOpen, setAssignDeviceOpen] = useState(false);
  const [editIconOpen, setEditIconOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  const navigate = useNavigate();
  const { user, logout: doLogout } = useAuthStore();
  const toast = useToastStore((s) => s.show);

  const loadDashboard = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/dashboard');
      setStats(data);
    } catch {}
  }, []);

  const loadClients = useCallback(async (q = '') => {
    try {
      const url = q ? `/admin/clients?search=${encodeURIComponent(q)}` : '/admin/clients';
      const { data } = await api.get(url);
      setClients(data.data || []);
    } catch {}
  }, []);

  const loadDevices = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/devices');
      setDevices(data.devices || data || []);
    } catch {}
  }, []);

  const loadOnline = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/online-users');
      setOnlineUsers(data.users || []);
    } catch {}
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/audit-log');
      setAuditLog(data.data || data || []);
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([loadDashboard(), loadClients(), loadDevices(), loadOnline()])
      .finally(() => setLoading(false));
  }, [loadDashboard, loadClients, loadDevices, loadOnline]);

  useEffect(() => {
    if (tab === 'audit') loadAudit();
  }, [tab, loadAudit]);

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => loadClients(search), 300);
    return () => clearTimeout(t);
  }, [search, loadClients]);

  function handleLogout() {
    api.post('/auth/logout').catch(() => {});
    doLogout();
    navigate('/login');
  }

  async function toggleClient(id: string) {
    try {
      const { data } = await api.post(`/admin/clients/${id}/toggle-active`);
      toast(data.message, 'success');
      loadClients(search);
      loadDashboard();
    } catch { toast('Erro ao alterar status', 'error'); }
  }

  async function resetPassword(id: string, name: string) {
    if (!confirm(`Resetar a senha de "${name}" para o numero do documento?`)) return;
    try {
      const { data } = await api.post(`/admin/clients/${id}/reset-password`);
      toast(data.message, 'success');
      loadClients(search);
    } catch { toast('Erro ao resetar senha', 'error'); }
  }

  async function deleteClient(id: string, name: string) {
    if (!confirm(`ATENCAO: Deseja DELETAR permanentemente "${name}"?\nEsta acao NAO pode ser desfeita!`)) return;
    if (!confirm(`Confirme novamente: DELETAR "${name}" permanentemente?`)) return;
    try {
      const { data } = await api.delete(`/admin/clients/${id}`);
      toast(data.message, 'success');
      loadClients(search);
      loadDashboard();
    } catch { toast('Erro ao deletar', 'error'); }
  }

  // ========== DEVICE ACTIONS ==========
  async function unassignDevice(device: Device) {
    if (!confirm(`Desvincular o dispositivo "${device.name}" do cliente "${device.clientName}"?`)) return;
    try {
      await api.post(`/admin/devices/${device.id}/unassign`, { clientId: device.clientId });
      toast('Dispositivo desvinculado!', 'success');
      loadDevices();
    } catch { toast('Erro ao desvincular', 'error'); }
  }

  async function deleteDevice(device: Device) {
    if (!confirm(`ATENCAO: Deseja DELETAR o dispositivo "${device.name}" (${device.uniqueId})?`)) return;
    try {
      await api.delete(`/admin/devices/${device.id}`);
      toast('Dispositivo deletado!', 'success');
      loadDevices();
    } catch { toast('Erro ao deletar dispositivo', 'error'); }
  }

  if (loading) return <Loading fullScreen message="Carregando painel..." />;

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'clients', label: 'Clientes' },
    { key: 'devices', label: 'Dispositivos' },
    { key: 'online', label: 'Online' },
    { key: 'audit', label: 'Auditoria' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo-login.png" alt="HSQ" style={{ width: 36, height: 36, borderRadius: 8 }} />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16 }}>HSQ Rastreamento</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Painel Admin — {user?.name}</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Sair</button>
      </header>

      {/* Tabs */}
      <div style={{ padding: '16px 24px 0', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', padding: 4, borderRadius: 8, minWidth: 'fit-content' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 24 }}>
        {/* Dashboard */}
        {tab === 'dashboard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{stats.totalClients}</div>
                <div className="stat-label">Total Clientes</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{stats.activeClients}</div>
                <div className="stat-label">Ativos</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--accent-yellow)' }}>{stats.recentLogins}</div>
                <div className="stat-label">Logins Recentes</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{stats.onlineNow}</div>
                <div className="stat-label">Online Agora</div>
              </div>
            </div>

            {/* Quick online users */}
            <div className="card">
              <h3 style={{ color: 'var(--text-primary)', fontSize: 16, marginBottom: 16 }}>Usuarios Online</h3>
              <OnlineUsersPanel users={onlineUsers} />
            </div>
          </div>
        )}

        {/* Clients */}
        {tab === 'clients' && (
          <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <input
                className="form-input"
                placeholder="Buscar por nome, documento..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button className="btn btn-primary" onClick={() => setNewClientOpen(true)}>
                + Novo Cliente
              </button>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Nome</th>
                      <th>Contato</th>
                      <th>Cidade</th>
                      <th>Status</th>
                      <th>Acoes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>Nenhum cliente</td></tr>
                    ) : clients.map((c) => {
                      const isOnline = c.last_login_at && (!c.last_logout_at || new Date(c.last_login_at) > new Date(c.last_logout_at));
                      return (
                        <tr key={c.id}>
                          <td>
                            <span className={`badge ${c.document_type === 'CPF' ? 'badge-cpf' : 'badge-cnpj'}`}>{c.document_type}</span>
                            <span style={{ marginLeft: 8 }}>{c.document}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                background: isOnline ? 'var(--accent-green)' : '#475569',
                                boxShadow: isOnline ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
                              }} />
                              <div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                                {c.trade_name && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{c.trade_name}</div>}
                              </div>
                            </div>
                          </td>
                          <td>
                            {c.phone || '-'}<br />
                            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{c.email || ''}</span>
                          </td>
                          <td>{c.city || '-'}{c.state ? '/' + c.state : ''}</td>
                          <td>
                            <span className={`badge ${c.is_active ? 'badge-active' : 'badge-inactive'}`}>
                              {c.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                            {c.is_first_login && <div style={{ fontSize: 11, color: 'var(--accent-yellow)', marginTop: 4 }}>Aguardando 1o acesso</div>}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <button className={`btn btn-sm ${c.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleClient(c.id)}>
                                {c.is_active ? 'Desativar' : 'Ativar'}
                              </button>
                              <button className="btn btn-sm btn-secondary" onClick={() => resetPassword(c.id, c.name)}>
                                Reset
                              </button>
                              <button className="btn btn-sm btn-danger" onClick={() => deleteClient(c.id, c.name)}>
                                Deletar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Devices */}
        {tab === 'devices' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-primary)', fontSize: 16 }}>Dispositivos Traccar</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setNewDeviceOpen(true)}>+ Novo Dispositivo</button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Icone</th>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>IMEI</th>
                    <th>Status</th>
                    <th>Ultima Atualizacao</th>
                    <th>Cliente</th>
                    <th>Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>Nenhum dispositivo</td></tr>
                  ) : devices.map((d) => {
                    const cat = d.category || 'car';
                    const catLabel = VEHICLE_CATEGORIES.find(c => c.key === cat)?.label || cat;
                    return (
                      <tr key={d.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 36, height: 36, borderRadius: '50%',
                                background: d.status === 'online' ? '#10b981' : '#ef4444',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0,
                              }}
                              dangerouslySetInnerHTML={{ __html: getIconPreviewSvg(cat, 22) }}
                            />
                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{catLabel}</span>
                          </div>
                        </td>
                        <td>{d.id}</td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{d.uniqueId}</td>
                        <td>
                          <span className={`badge ${d.status === 'online' ? 'badge-active' : 'badge-inactive'}`}>
                            {d.status || 'offline'}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {d.lastUpdate ? formatDateTime(d.lastUpdate) : '-'}
                        </td>
                        <td>{d.clientName || <span style={{ color: 'var(--text-dim)' }}>Sem vinculo</span>}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              title="Alterar icone"
                              onClick={() => { setSelectedDevice(d); setEditIconOpen(true); }}
                            >
                              Icone
                            </button>
                            {d.clientName ? (
                              <button
                                className="btn btn-sm btn-danger"
                                title="Desvincular do cliente"
                                onClick={() => unassignDevice(d)}
                              >
                                Desvincular
                              </button>
                            ) : (
                              <button
                                className="btn btn-sm btn-primary"
                                title="Vincular a um cliente"
                                onClick={() => { setSelectedDevice(d); setAssignDeviceOpen(true); }}
                              >
                                Vincular
                              </button>
                            )}
                            <button
                              className="btn btn-sm btn-danger"
                              title="Deletar dispositivo"
                              onClick={() => deleteDevice(d)}
                            >
                              Deletar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Online */}
        {tab === 'online' && (
          <div className="card">
            <h3 style={{ color: 'var(--text-primary)', fontSize: 16, marginBottom: 16 }}>Status dos Usuarios</h3>
            <OnlineUsersPanel users={onlineUsers} />
          </div>
        )}

        {/* Audit */}
        {tab === 'audit' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Usuario</th>
                    <th>Acao</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>Nenhum registro</td></tr>
                  ) : auditLog.map((a) => (
                    <tr key={a.id}>
                      <td style={{ fontSize: 13 }}>{formatDateTime(a.created_at)}</td>
                      <td><span className={`badge ${a.user_type === 'admin' ? 'badge-admin' : 'badge-cpf'}`}>{a.user_type}</span></td>
                      <td>{a.user_name || a.user_id?.slice(0, 8)}</td>
                      <td style={{ fontWeight: 500 }}>{a.action}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-dim)' }}>{a.ip_address}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* New Client Modal */}
      <NewClientModal
        isOpen={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        onSuccess={() => { loadClients(search); loadDashboard(); setNewClientOpen(false); }}
      />

      {/* New Device Modal */}
      <NewDeviceModal
        isOpen={newDeviceOpen}
        onClose={() => setNewDeviceOpen(false)}
        onSuccess={() => { loadDevices(); setNewDeviceOpen(false); }}
        clients={clients}
      />

      {/* Assign Device Modal */}
      <AssignDeviceModal
        isOpen={assignDeviceOpen}
        device={selectedDevice}
        onClose={() => { setAssignDeviceOpen(false); setSelectedDevice(null); }}
        onSuccess={() => { loadDevices(); setAssignDeviceOpen(false); setSelectedDevice(null); }}
        clients={clients}
      />

      {/* Edit Icon Modal */}
      <EditIconModal
        isOpen={editIconOpen}
        device={selectedDevice}
        onClose={() => { setEditIconOpen(false); setSelectedDevice(null); }}
        onSuccess={() => { loadDevices(); setEditIconOpen(false); setSelectedDevice(null); }}
      />
    </div>
  );
}

// ========== SUB COMPONENTS ==========

function OnlineUsersPanel({ users }: { users: OnlineUser[] }) {
  const online = users.filter((u) => u.isOnline);
  const offline = users.filter((u) => !u.isOnline && u.lastLoginAt);

  if (online.length === 0 && offline.length === 0) {
    return <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 20 }}>Nenhum usuario logou ainda</div>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      {online.map((u, i) => {
        const mins = u.minutesSinceActivity || 0;
        const time = mins < 1 ? 'agora' : mins < 60 ? `${Math.round(mins)} min atras` : `${Math.round(mins / 60)}h atras`;
        return (
          <div key={i} style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            borderRadius: 12, padding: '12px 16px', minWidth: 200,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 10, height: 10, background: 'var(--accent-green)', borderRadius: '50%', boxShadow: '0 0 8px rgba(34,197,94,0.5)' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.document} — {time}</div>
            </div>
          </div>
        );
      })}
      {offline.filter((u) => (u.minutesSinceActivity || 0) < 1440).map((u, i) => {
        const mins = u.minutesSinceActivity || 0;
        const time = mins < 60 ? `${Math.round(mins)} min atras` : `${Math.round(mins / 60)}h atras`;
        return (
          <div key={`off-${i}`} style={{
            background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.3)',
            borderRadius: 12, padding: '12px 16px', minWidth: 200,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 10, height: 10, background: '#64748b', borderRadius: '50%' }} />
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 14 }}>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>offline — {time}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ========== ICON PICKER ==========
function IconPicker({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
    }}>
      {VEHICLE_CATEGORIES.map((cat) => {
        const isActive = selected === cat.key;
        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => onSelect(cat.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 4px', borderRadius: 10,
              border: isActive ? '2px solid var(--accent-blue)' : '2px solid var(--border)',
              background: isActive ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.4)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <div
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: isActive ? '#10b981' : '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              dangerouslySetInnerHTML={{ __html: getIconPreviewSvg(cat.key, 26) }}
            />
            <span style={{
              fontSize: 11, fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)',
            }}>
              {cat.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ========== NEW CLIENT MODAL ==========
function NewClientModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [docType, setDocType] = useState<'CPF' | 'CNPJ'>('CPF');
  const [doc, setDoc] = useState('');
  const [name, setName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToastStore((s) => s.show);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/admin/clients', {
        documentType: docType,
        document: cleanDocument(doc),
        name, tradeName, phone: phone.replace(/\D/g, ''), email, city, state, contactPerson: contact,
      });
      toast('Cliente cadastrado com sucesso!', 'success');
      onSuccess();
      // Reset
      setDoc(''); setName(''); setTradeName(''); setPhone(''); setEmail(''); setCity(''); setState(''); setContact('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Cliente" width={560}>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 16 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Tipo</label>
            <select className="form-select" value={docType} onChange={(e) => { setDocType(e.target.value as 'CPF' | 'CNPJ'); setDoc(''); }}>
              <option>CPF</option>
              <option>CNPJ</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Documento</label>
            <input
              className="form-input"
              value={doc}
              onChange={(e) => setDoc(maskDocument(e.target.value, docType))}
              placeholder={docType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
              required
            />
          </div>
        </div>
        <div className="form-group">
          <label>Nome / Razao Social *</label>
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Nome Fantasia</label>
          <input className="form-input" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Telefone</label>
            <input className="form-input" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 12 }}>
          <div className="form-group">
            <label>Cidade</label>
            <input className="form-input" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="form-group">
            <label>UF</label>
            <input className="form-input" value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="RN" />
          </div>
        </div>
        <div className="form-group">
          <label>Pessoa de Contato</label>
          <input className="form-input" value={contact} onChange={(e) => setContact(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
            {loading ? <><span className="spinner" /> Cadastrando...</> : 'Cadastrar Cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ========== NEW DEVICE MODAL ==========
function NewDeviceModal({
  isOpen, onClose, onSuccess, clients,
}: {
  isOpen: boolean; onClose: () => void; onSuccess: () => void; clients: Client[];
}) {
  const [name, setName] = useState('');
  const [uniqueId, setUniqueId] = useState('');
  const [category, setCategory] = useState('car');
  const [clientId, setClientId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToastStore((s) => s.show);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !uniqueId.trim()) {
      setError('Nome e IMEI sao obrigatorios');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/admin/devices', {
        name: name.trim(),
        uniqueId: uniqueId.trim(),
        category,
        clientId: clientId || undefined,
      });
      toast('Dispositivo criado com sucesso!', 'success');
      onSuccess();
      setName(''); setUniqueId(''); setCategory('car'); setClientId('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar dispositivo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Dispositivo" width={540}>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nome do Veiculo *</label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Caminhao Azul, Moto do Joao..."
            required
          />
        </div>
        <div className="form-group">
          <label>IMEI / Identificador *</label>
          <input
            className="form-input"
            value={uniqueId}
            onChange={(e) => setUniqueId(e.target.value.replace(/\D/g, ''))}
            placeholder="Numero IMEI do rastreador (somente numeros)"
            required
            style={{ fontFamily: 'monospace' }}
          />
        </div>

        <div className="form-group">
          <label>Tipo de Veiculo</label>
          <IconPicker selected={category} onSelect={setCategory} />
        </div>

        <div className="form-group">
          <label>Vincular a Cliente (opcional)</label>
          <select
            className="form-select"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">-- Sem vinculo --</option>
            {clients.filter(c => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.document})</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
            {loading ? <><span className="spinner" /> Criando...</> : 'Criar Dispositivo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ========== ASSIGN DEVICE MODAL ==========
function AssignDeviceModal({
  isOpen, device, onClose, onSuccess, clients,
}: {
  isOpen: boolean; device: Device | null; onClose: () => void; onSuccess: () => void; clients: Client[];
}) {
  const [clientId, setClientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToastStore((s) => s.show);

  useEffect(() => {
    if (isOpen) { setClientId(''); setError(''); }
  }, [isOpen]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!clientId || !device) {
      setError('Selecione um cliente');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post(`/admin/devices/${device.id}/assign`, { clientId });
      toast(`Dispositivo "${device.name}" vinculado com sucesso!`, 'success');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao vincular');
    } finally {
      setLoading(false);
    }
  }

  if (!device) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vincular Dispositivo" width={480}>
      {error && <div className="error-msg">{error}</div>}

      <div style={{
        background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
        borderRadius: 10, padding: 16, marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: device.status === 'online' ? '#10b981' : '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
          dangerouslySetInnerHTML={{ __html: getIconPreviewSvg(device.category || 'car', 28) }}
        />
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>{device.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>IMEI: {device.uniqueId}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Selecione o Cliente *</label>
          <select
            className="form-select"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            <option value="">-- Escolha um cliente --</option>
            {clients.filter(c => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.document})</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
            {loading ? <><span className="spinner" /> Vinculando...</> : 'Vincular'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ========== EDIT ICON MODAL ==========
function EditIconModal({
  isOpen, device, onClose, onSuccess,
}: {
  isOpen: boolean; device: Device | null; onClose: () => void; onSuccess: () => void;
}) {
  const [category, setCategory] = useState('car');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToastStore((s) => s.show);

  useEffect(() => {
    if (isOpen && device) {
      setCategory(device.category || 'car');
      setError('');
    }
  }, [isOpen, device]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!device) return;
    setError('');
    setLoading(true);
    try {
      await api.put(`/admin/devices/${device.id}`, { category });
      toast(`Icone de "${device.name}" atualizado!`, 'success');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar icone');
    } finally {
      setLoading(false);
    }
  }

  if (!device) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Alterar Icone" width={480}>
      {error && <div className="error-msg">{error}</div>}

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15 }}>{device.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>IMEI: {device.uniqueId}</div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Escolha o Icone</label>
          <IconPicker selected={category} onSelect={setCategory} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
            {loading ? <><span className="spinner" /> Salvando...</> : 'Salvar Icone'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
