import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuthStore } from '@/store/auth';
import Loading from '@/components/ui/Loading';

// Fix default marker icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

interface VehiclePosition {
  deviceId: number;
  name: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  status: string;
  lastUpdate?: string;
  category?: string;
  address?: string;
}

// Vehicle icon SVG
function getVehicleIconHtml(category: string, speed: number, course: number): string {
  const color = speed > 2 ? '#22c55e' : '#ef4444';
  const icon = category === 'truck' ? '🚛' : category === 'motorcycle' ? '🏍️' : '🚗';
  return `<div style="
    display:flex;align-items:center;justify-content:center;
    width:36px;height:36px;border-radius:50%;
    background:${speed > 2 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'};
    border:2px solid ${color};font-size:18px;
    transform:rotate(${course}deg);
  ">${icon}</div>`;
}

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center[0] !== 0 && center[1] !== 0) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

export default function TrackingPage() {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.1, -38.2]);
  const [mapZoom, setMapZoom] = useState(8);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite'>('streets');
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(true);
  const lastTimestamp = useRef(0);
  const navigate = useNavigate();
  const { token } = useAuthStore();

  const doPoll = useCallback(async () => {
    if (!pollRef.current || !token) return;
    try {
      const resp = await fetch(`/api/tracking/poll?token=${token}&since=${lastTimestamp.current}`);
      if (!resp.ok) throw new Error('Poll failed');
      const data = await resp.json();
      if (data.timestamp) lastTimestamp.current = data.timestamp;

      if (data.positions?.length > 0 || data.devices?.length > 0) {
        setVehicles((prev) => {
          const map = new Map(prev.map((v) => [v.deviceId, v]));
          // Update positions
          (data.positions || []).forEach((p: any) => {
            const existing = map.get(p.deviceId);
            map.set(p.deviceId, {
              ...existing,
              deviceId: p.deviceId,
              latitude: p.latitude,
              longitude: p.longitude,
              speed: p.speed || 0,
              course: p.course || 0,
              name: existing?.name || `Device ${p.deviceId}`,
              status: (p.speed || 0) > 2 ? 'online' : existing?.status || 'unknown',
              category: existing?.category || 'car',
            });
          });
          // Update device info
          (data.devices || []).forEach((d: any) => {
            const existing = map.get(d.deviceId);
            if (existing) {
              map.set(d.deviceId, { ...existing, name: d.name, status: d.status, category: d.category || 'car', lastUpdate: d.lastUpdate });
            } else {
              map.set(d.deviceId, {
                deviceId: d.deviceId, name: d.name, status: d.status,
                latitude: 0, longitude: 0, speed: 0, course: 0,
                category: d.category || 'car', lastUpdate: d.lastUpdate,
              });
            }
          });
          return Array.from(map.values());
        });
      }
    } catch {}
    if (pollRef.current) setTimeout(doPoll, 1000);
  }, [token]);

  useEffect(() => {
    pollRef.current = true;
    setLoading(true);
    // Initial load via positions endpoint
    (async () => {
      try {
        const resp = await fetch(`/api/tracking/positions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.vehicles) setVehicles(data.vehicles);
        }
      } catch {}
      setLoading(false);
      doPoll();
    })();
    return () => { pollRef.current = false; };
  }, [doPoll, token]);

  function selectVehicle(deviceId: number) {
    const v = vehicles.find((v) => v.deviceId === deviceId);
    if (v && v.latitude && v.longitude) {
      setSelectedId(deviceId);
      setMapCenter([v.latitude, v.longitude]);
      setMapZoom(16);
    }
  }

  const filtered = vehicles.filter((v) =>
    v.name.toLowerCase().includes(searchFilter.toLowerCase()) && v.latitude !== 0
  );
  const online = vehicles.filter((v) => v.status === 'online').length;
  const moving = vehicles.filter((v) => v.speed > 2).length;

  if (loading) return <Loading fullScreen message="Conectando ao rastreamento..." />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}>← Voltar</button>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>Rastreamento</span>
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <span style={{ color: 'var(--accent-green)' }}>● {online} online</span>
          <span style={{ color: 'var(--accent-blue)' }}>▶ {moving} em movimento</span>
          <span style={{ color: 'var(--text-dim)' }}>■ {vehicles.length - online} offline</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '◀' : '▶'} Lista
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setMapLayer(mapLayer === 'streets' ? 'satellite' : 'streets')}>
            {mapLayer === 'streets' ? '🛰️' : '🗺️'}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <div style={{
            width: 320, background: 'var(--bg-card)', borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', flexShrink: 0,
          }}>
            <div style={{ padding: 12 }}>
              <input
                className="form-input"
                placeholder="Buscar veiculo..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{ fontSize: 13, padding: '8px 12px' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
              {filtered.map((v) => (
                <div
                  key={v.deviceId}
                  onClick={() => selectVehicle(v.deviceId)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, marginBottom: 4, cursor: 'pointer',
                    background: selectedId === v.deviceId ? 'rgba(65,131,239,0.15)' : 'transparent',
                    border: selectedId === v.deviceId ? '1px solid rgba(65,131,239,0.3)' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>
                        {v.category === 'truck' ? '🚛' : v.category === 'motorcycle' ? '🏍️' : '🚗'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{v.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {v.speed > 0 ? `${v.speed} km/h` : 'Parado'}
                        </div>
                      </div>
                    </div>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: v.speed > 2 ? 'var(--accent-green)' : v.status === 'online' ? 'var(--accent-yellow)' : '#475569',
                      boxShadow: v.speed > 2 ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
                    }} />
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>
                  Nenhum veiculo encontrado
                </div>
              )}
            </div>
          </div>
        )}

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            {mapLayer === 'streets' ? (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution=""
                maxZoom={19}
              />
            ) : (
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                attribution=""
                maxZoom={19}
              />
            )}
            <MapUpdater center={mapCenter} zoom={mapZoom} />
            {filtered.filter((v) => v.latitude !== 0).map((v) => (
              <Marker
                key={v.deviceId}
                position={[v.latitude, v.longitude]}
                icon={L.divIcon({
                  html: getVehicleIconHtml(v.category || 'car', v.speed, v.course),
                  className: '',
                  iconSize: [36, 36],
                  iconAnchor: [18, 18],
                })}
                eventHandlers={{ click: () => selectVehicle(v.deviceId) }}
              >
                <Popup>
                  <div style={{ color: '#333', minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{v.name}</div>
                    <div style={{ fontSize: 13 }}>Velocidade: <b>{v.speed} km/h</b></div>
                    <div style={{ fontSize: 13 }}>Status: <b>{v.status}</b></div>
                    {v.lastUpdate && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{new Date(v.lastUpdate).toLocaleString('pt-BR')}</div>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
