import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import api from '@/api/client';
import Loading from '@/components/ui/Loading';
import { mapVehicleEmojis } from '@/utils/vehicleIcons';

interface Vehicle {
  deviceId: number;
  name: string;
  status: string;
  lastUpdate?: string;
  category?: string;
}

export default function ClientDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user, traccarEmail, logout: doLogout } = useAuthStore();

  const loadVehicles = useCallback(async () => {
    try {
      const { data } = await api.get('/tracking/devices');
      setVehicles(data.devices || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadVehicles();
    // Heartbeat every 60s
    const hb = setInterval(() => {
      api.post('/auth/heartbeat').catch(() => {});
    }, 60000);
    return () => clearInterval(hb);
  }, [loadVehicles]);

  function handleLogout() {
    api.post('/auth/logout').catch(() => {});
    doLogout();
    navigate('/login');
  }

  async function openTraccar() {
    const traccarUrl = 'https://traccar.hsqrastreamento.com.br';
    // Try to auto-login via Traccar session API first
    try {
      // Get Traccar credentials from our backend (proxied)
      const { data } = await api.get('/tracking/traccar-session');
      if (data.email && data.password) {
        // Create a hidden form to POST to Traccar /api/session (sets JSESSIONID cookie)
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = `${traccarUrl}/api/session`;
        form.target = '_blank';
        const emailField = document.createElement('input');
        emailField.type = 'hidden';
        emailField.name = 'email';
        emailField.value = data.email;
        form.appendChild(emailField);
        const passField = document.createElement('input');
        passField.type = 'hidden';
        passField.name = 'password';
        passField.value = data.password;
        form.appendChild(passField);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
        return;
      }
    } catch {
      // Fallback: open Traccar login page directly
    }
    window.open(traccarUrl, '_blank');
  }

  if (loading) return <Loading fullScreen message="Carregando seus veiculos..." />;

  const online = vehicles.filter((v) => v.status === 'online').length;

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
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ola, {user?.name}</div>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Sair</button>
      </header>

      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{vehicles.length}</div>
            <div className="stat-label">Veiculos</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{online}</div>
            <div className="stat-label">Online</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--text-dim)' }}>{vehicles.length - online}</div>
            <div className="stat-label">Offline</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/tracking')}
            style={{ padding: '20px', fontSize: 16, borderRadius: 12 }}
          >
            📍 Rastrear Veiculos
          </button>
          <button
            className="btn btn-secondary"
            onClick={openTraccar}
            style={{ padding: '20px', fontSize: 16, borderRadius: 12, borderColor: 'rgba(65,131,239,0.3)' }}
          >
            🌐 Acessar Traccar
          </button>
        </div>

        {/* Vehicle List */}
        <div className="card">
          <h3 style={{ color: 'var(--text-primary)', fontSize: 16, marginBottom: 16 }}>Seus Veiculos</h3>
          {vehicles.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>
              Nenhum veiculo vinculado
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vehicles.map((v) => (
                <div key={v.deviceId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: 'var(--bg-input)',
                  borderRadius: 10, border: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                        background: v.status === 'online' ? '#10b981' : '#ef4444',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      dangerouslySetInnerHTML={{
                        __html: (mapVehicleEmojis[v.category || 'car'] || mapVehicleEmojis.car)
                          .replace(/VW/g, '24').replace(/VH/g, '24'),
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{v.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {v.lastUpdate ? `Atualizado: ${new Date(v.lastUpdate).toLocaleString('pt-BR')}` : 'Sem dados'}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${v.status === 'online' ? 'badge-active' : 'badge-inactive'}`}>
                    {v.status || 'offline'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
