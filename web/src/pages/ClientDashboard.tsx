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
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, logout: doLogout } = useAuthStore();

  const loadVehicles = useCallback(async () => {
    try {
      setError('');
      const { data } = await api.get('/tracking/devices');
      setVehicles(data.devices || []);
    } catch (err: unknown) {
      console.error('Failed to load vehicles:', err);
      setError('Erro ao carregar veiculos. Tente recarregar a pagina.');
    }
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

  if (loading) return <Loading fullScreen message="Carregando seus veiculos..." />;

  const online = vehicles.filter((v) => v.status === 'online').length;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        animation: 'fadeIn 0.5s ease-in-out',
      }}
    >
      {/* Header */}
      <header
        style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="/logo-login.png"
            alt="HSQ"
            style={{ width: 36, height: 36, borderRadius: 8 }}
          />
          <div>
            <div
              style={{
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontSize: 16,
              }}
            >
              HSQ Rastreamento
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Ola, {user?.name}
            </div>
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleLogout}
        >
          Sair
        </button>
      </header>

      <div
        style={{
          padding: 24,
          maxWidth: 800,
          margin: '0 auto',
          animation: 'slideUp 0.6s ease-in-out',
        }}
      >
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#f87171', fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); loadVehicles(); }} style={{ fontSize: 12 }}>Tentar novamente</button>
          </div>
        )}

        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div className="stat-card">
            <div
              className="stat-value"
              style={{ color: 'var(--accent-blue)' }}
            >
              {vehicles.length}
            </div>
            <div className="stat-label">Veiculos</div>
          </div>
          <div className="stat-card">
            <div
              className="stat-value"
              style={{ color: 'var(--accent-green)' }}
            >
              {online}
            </div>
            <div className="stat-label">Online</div>
          </div>
          <div className="stat-card">
            <div
              className="stat-value"
              style={{ color: 'var(--text-dim)' }}
            >
              {vehicles.length - online}
            </div>
            <div className="stat-label">Offline</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/tracking')}
            style={{
              padding: '20px',
              fontSize: 16,
              borderRadius: 12,
              width: '100%',
            }}
          >
            📍 Rastrear Veiculos
          </button>
        </div>

        {/* Vehicle List */}
        <div className="card">
          <h3
            style={{
              color: 'var(--text-primary)',
              fontSize: 16,
              marginBottom: 16,
            }}
          >
            Seus Veiculos
          </h3>
          {vehicles.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-dim)',
                padding: 40,
              }}
            >
              Nenhum veiculo vinculado
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vehicles.map((v) => (
                <div
                  key={v.deviceId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: 'var(--bg-input)',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor =
                      'rgba(59, 130, 246, 0.5)';
                    e.currentTarget.style.backgroundColor =
                      'rgba(26, 35, 50, 0.8)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow =
                      '0 4px 12px rgba(59, 130, 246, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.backgroundColor = 'var(--bg-input)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        flexShrink: 0,
                        background:
                          v.status === 'online' ? '#10b981' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20,
                      }}
                      dangerouslySetInnerHTML={{
                        __html: (mapVehicleEmojis[v.category || 'car'] ||
                          mapVehicleEmojis.car).replace(/VW/g, '24').replace(/VH/g, '24'),
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {v.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {v.lastUpdate
                          ? `Atualizado: ${new Date(v.lastUpdate).toLocaleString('pt-BR')}`
                          : 'Sem dados'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`badge ${v.status === 'online' ? 'badge-active' : 'badge-inactive'}`}
                  >
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
