import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useAuthStore } from '@/store/auth';
import Loading from '@/components/ui/Loading';
import { getVehicleIconHtml } from '@/utils/vehicleIcons';
import { queueGeocode, getCachedAddress } from '@/utils/geocoding';
import Reports from '@/components/tracking/Reports';
import Geofences from '@/components/tracking/Geofences';
import Replay from '@/components/tracking/Replay';

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
  fixTime?: string;
}

type ActiveOverlay = null | 'reports' | 'geofences' | 'replay';

// Smooth animation system
const ANIMATION_DURATION = 9000;
interface AnimState { startLat: number; startLng: number; endLat: number; endLng: number; startTime: number; duration: number; frame: number | null; }
const vehicleAnims: Record<number, AnimState> = {};
const prevPositions: Record<number, { lat: number; lng: number }> = {};

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function animateMarker(deviceId: number, markers: Map<number, L.Marker>, followId: number | null, mapRef: L.Map | null) {
  const anim = vehicleAnims[deviceId];
  if (!anim) return;
  const marker = markers.get(deviceId);
  if (!marker) return;
  const elapsed = Date.now() - anim.startTime;
  const progress = Math.min(elapsed / anim.duration, 1);
  const t = easeInOutCubic(progress);
  const lat = anim.startLat + (anim.endLat - anim.startLat) * t;
  const lng = anim.startLng + (anim.endLng - anim.startLng) * t;
  marker.setLatLng([lat, lng]);
  if (followId === deviceId && mapRef) {
    mapRef.panTo([lat, lng], { animate: false });
  }
  if (progress < 1) {
    anim.frame = requestAnimationFrame(() => animateMarker(deviceId, markers, followId, mapRef));
  } else {
    prevPositions[deviceId] = { lat: anim.endLat, lng: anim.endLng };
    delete vehicleAnims[deviceId];
  }
}

function startSmoothAnimation(deviceId: number, newLat: number, newLng: number, markers: Map<number, L.Marker>, followId: number | null, mapRef: L.Map | null): boolean {
  const existing = vehicleAnims[deviceId];
  let startLat: number, startLng: number;
  if (existing) {
    if (existing.frame) cancelAnimationFrame(existing.frame);
    const elapsed = Date.now() - existing.startTime;
    const t = easeInOutCubic(Math.min(elapsed / existing.duration, 1));
    startLat = existing.startLat + (existing.endLat - existing.startLat) * t;
    startLng = existing.startLng + (existing.endLng - existing.startLng) * t;
  } else if (prevPositions[deviceId]) {
    startLat = prevPositions[deviceId].lat;
    startLng = prevPositions[deviceId].lng;
  } else {
    prevPositions[deviceId] = { lat: newLat, lng: newLng };
    return false;
  }
  const dlat = newLat - startLat;
  const dlng = newLng - startLng;
  const distApprox = Math.sqrt(dlat * dlat + dlng * dlng) * 111320;
  if (distApprox < 1 || distApprox > 10000) {
    prevPositions[deviceId] = { lat: newLat, lng: newLng };
    return false;
  }
  const anim: AnimState = { startLat, startLng, endLat: newLat, endLng: newLng, startTime: Date.now(), duration: ANIMATION_DURATION, frame: null };
  vehicleAnims[deviceId] = anim;
  anim.frame = requestAnimationFrame(() => animateMarker(deviceId, markers, followId, mapRef));
  return true;
}

// Map tile layer configs
const MAP_LAYERS = {
  streets: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19 },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19 },
  hybrid: { url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', maxZoom: 20, subdomains: '0123' },
  terrain: { url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', maxZoom: 20, subdomains: '0123' },
} as const;

function MapController({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] !== 0 && center[1] !== 0) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

function MapRefSetter({ onMap }: { onMap: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

export default function TrackingPage() {
  const [vehicles, setVehicles] = useState<VehiclePosition[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState(8);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchFilter, setSearchFilter] = useState('');
  const [mapLayer, setMapLayer] = useState<keyof typeof MAP_LAYERS>('streets');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
  const [addressVersion, setAddressVersion] = useState(0);

  const pollRef = useRef(true);
  const lastTimestamp = useRef(0);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const mapInstanceRef = useRef<L.Map | null>(null);
  const initialBoundsRef = useRef(false);
  const navigate = useNavigate();
  const { token } = useAuthStore();

  // Geocode all vehicles and trigger re-render when addresses arrive
  const geocodeVehicles = useCallback((vehs: VehiclePosition[]) => {
    vehs.forEach((v) => {
      if (v.latitude && v.longitude && v.latitude !== 0) {
        queueGeocode(v.latitude, v.longitude, () => {
          setAddressVersion((prev) => prev + 1);
        });
      }
    });
  }, []);

  // Load trail for selected vehicle
  const loadTrail = useCallback(async (deviceId: number) => {
    if (!token) return;
    setLoadingTrail(true);
    try {
      const resp = await fetch(`/api/tracking/trail/${deviceId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) { setTrail([]); return; }
      const data = await resp.json();
      if (Array.isArray(data) && data.length >= 2) {
        setTrail(data.map((p: any) => [p.lat, p.lng] as [number, number]));
      } else {
        setTrail([]);
      }
    } catch { setTrail([]); }
    setLoadingTrail(false);
  }, [token]);

  // Select vehicle
  function selectVehicle(deviceId: number) {
    const v = vehicles.find((x) => x.deviceId === deviceId);
    if (v && v.latitude && v.longitude) {
      setSelectedId(deviceId);
      setMapCenter([v.latitude, v.longitude]);
      setMapZoom(16);
      loadTrail(deviceId);
    }
  }

  // Initial load
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const resp = await fetch('/api/tracking/positions', { headers: { Authorization: `Bearer ${token}` } });
        if (resp.ok) {
          const data = await resp.json();
          const vehs = data.vehicles || data || [];
          if (vehs.length > 0) {
            setVehicles(vehs);
            geocodeVehicles(vehs);
          }
        }
      } catch {}
      setLoading(false);
    })();
  }, [token, geocodeVehicles]);

  // Fit bounds on first load
  useEffect(() => {
    if (!initialBoundsRef.current && vehicles.length > 0 && mapInstanceRef.current) {
      const validVehs = vehicles.filter((v) => v.latitude !== 0 && v.longitude !== 0);
      if (validVehs.length > 0) {
        const bounds = L.latLngBounds(validVehs.map((v) => [v.latitude, v.longitude] as [number, number]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        initialBoundsRef.current = true;
      }
    }
  }, [vehicles]);

  // Long polling
  useEffect(() => {
    if (!token) return;
    pollRef.current = true;

    const doPoll = async () => {
      if (!pollRef.current) return;
      try {
        const resp = await fetch(`/api/tracking/poll?token=${token}&since=${lastTimestamp.current}`);
        if (!resp.ok) throw new Error('Poll failed');
        const data = await resp.json();
        if (data.timestamp) lastTimestamp.current = data.timestamp;

        if (data.positions?.length > 0 || data.devices?.length > 0) {
          setVehicles((prev) => {
            const vmap = new Map(prev.map((v) => [v.deviceId, v]));
            (data.positions || []).forEach((p: any) => {
              const existing = vmap.get(p.deviceId);
              const newV: VehiclePosition = {
                ...existing,
                deviceId: p.deviceId,
                latitude: p.latitude,
                longitude: p.longitude,
                speed: p.speed || 0,
                course: p.course || 0,
                name: existing?.name || `Device ${p.deviceId}`,
                status: (p.speed || 0) > 2 ? 'online' : existing?.status || 'unknown',
                category: existing?.category || 'car',
              };
              vmap.set(p.deviceId, newV);
              // Smooth animation
              if (p.latitude && p.longitude) {
                const animated = startSmoothAnimation(p.deviceId, p.latitude, p.longitude, markersRef.current, selectedId, mapInstanceRef.current);
                if (!animated) {
                  const marker = markersRef.current.get(p.deviceId);
                  if (marker) marker.setLatLng([p.latitude, p.longitude]);
                }
                // Update icon color based on speed
                const marker = markersRef.current.get(p.deviceId);
                if (marker) {
                  marker.setIcon(L.divIcon({
                    html: getVehicleIconHtml(newV.category || 'car', newV.speed, newV.course),
                    className: '', iconSize: [52, 52], iconAnchor: [26, 26], popupAnchor: [0, -26],
                  }));
                }
              }
            });
            (data.devices || []).forEach((d: any) => {
              const existing = vmap.get(d.deviceId);
              if (existing) {
                vmap.set(d.deviceId, { ...existing, name: d.name, status: d.status, category: d.category || 'car', lastUpdate: d.lastUpdate });
              } else {
                vmap.set(d.deviceId, { deviceId: d.deviceId, name: d.name, status: d.status, latitude: 0, longitude: 0, speed: 0, course: 0, category: d.category || 'car', lastUpdate: d.lastUpdate });
              }
            });
            const newVehs = Array.from(vmap.values());
            geocodeVehicles(newVehs);
            return newVehs;
          });
        }
      } catch {}
      if (pollRef.current) setTimeout(doPoll, 1000);
    };
    doPoll();
    return () => { pollRef.current = false; };
  }, [token, selectedId, geocodeVehicles]);

  // Cleanup animations on unmount
  useEffect(() => {
    return () => {
      Object.values(vehicleAnims).forEach((a) => { if (a.frame) cancelAnimationFrame(a.frame); });
    };
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {}
  }, []);

  // Filtered vehicles
  const filtered = vehicles.filter((v) =>
    v.name.toLowerCase().includes(searchFilter.toLowerCase()) && v.latitude !== 0
  );
  const online = vehicles.filter((v) => v.status === 'online').length;
  const moving = vehicles.filter((v) => v.speed > 2).length;
  const selectedVehicle = vehicles.find((v) => v.deviceId === selectedId);

  // Get live address for a vehicle
  function getAddress(v: VehiclePosition): string {
    // addressVersion is used to trigger re-reads of cache
    void addressVersion;
    return v.address || getCachedAddress(v.latitude, v.longitude) || 'Buscando endereço...';
  }

  if (loading) return <Loading fullScreen message="Conectando ao rastreamento..." />;

  // If an overlay is active, render it full screen
  if (activeOverlay === 'reports') return <Reports token={token!} onClose={() => setActiveOverlay(null)} />;
  if (activeOverlay === 'geofences') return <Geofences token={token!} onClose={() => setActiveOverlay(null)} />;
  if (activeOverlay === 'replay') return <Replay token={token!} onClose={() => setActiveOverlay(null)} />;

  const currentLayer = MAP_LAYERS[mapLayer];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
        padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, flexShrink: 0, zIndex: 1000,
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
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveOverlay('replay')} title="Replay">🔄 Replay</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveOverlay('reports')} title="Relatórios">📊 Relatórios</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveOverlay('geofences')} title="Geocercas">🔲 Geocercas</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '◀' : '▶'} Lista
          </button>
          <select
            className="btn btn-secondary btn-sm"
            value={mapLayer}
            onChange={(e) => setMapLayer(e.target.value as keyof typeof MAP_LAYERS)}
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
          >
            <option value="streets">🗺️ Ruas</option>
            <option value="satellite">🛰️ Satélite</option>
            <option value="hybrid">🌍 Híbrido</option>
            <option value="terrain">⛰️ Terreno</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={toggleFullscreen}>⛶</button>
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
              {filtered.map((v) => {
                const addr = getAddress(v);
                return (
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
                          {v.category === 'truck' ? '🚛' : v.category === 'motorcycle' ? '🏍️' : v.category === 'bus' ? '🚌' : v.category === 'van' ? '🚐' : '🚗'}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{v.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {v.speed > 0 ? `${v.speed} km/h` : 'Parado'}
                          </div>
                          {addr && addr !== 'Buscando endereço...' && (
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              📍 {addr}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: v.speed > 2 ? 'var(--accent-green)' : v.status === 'online' ? 'var(--accent-yellow, #eab308)' : '#475569',
                        boxShadow: v.speed > 2 ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
                      }} />
                    </div>
                  </div>
                );
              })}
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
            center={[-6.1, -38.2]}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              key={mapLayer}
              url={currentLayer.url}
              maxZoom={currentLayer.maxZoom}
              {...('subdomains' in currentLayer ? { subdomains: currentLayer.subdomains } : {})}
            />
            <MapController center={mapCenter} zoom={mapZoom} />
            <MapRefSetter onMap={(m) => { mapInstanceRef.current = m; }} />

            {/* Vehicle Markers */}
            {filtered.filter((v) => v.latitude !== 0).map((v) => (
              <Marker
                key={v.deviceId}
                position={[v.latitude, v.longitude]}
                icon={L.divIcon({
                  html: getVehicleIconHtml(v.category || 'car', v.speed, v.course),
                  className: '',
                  iconSize: [52, 52],
                  iconAnchor: [26, 26],
                  popupAnchor: [0, -26],
                })}
                ref={(ref) => { if (ref) markersRef.current.set(v.deviceId, ref as any); }}
                eventHandlers={{ click: () => selectVehicle(v.deviceId) }}
              >
                <Popup>
                  <div style={{ color: '#333', minWidth: 220 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{v.name}</div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}>🚗 Velocidade: <b>{v.speed} km/h</b></div>
                    <div style={{ fontSize: 13, marginBottom: 4, padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                      📍 <span style={{ color: '#334155' }}>{getAddress(v)}</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 11 }}>
                      Atualizado: {v.fixTime ? new Date(v.fixTime).toLocaleString('pt-BR') : v.lastUpdate ? new Date(v.lastUpdate).toLocaleString('pt-BR') : '-'}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 10 }}>
                      Coords: {v.latitude.toFixed(5)}, {v.longitude.toFixed(5)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      <a href={`https://www.google.com/maps?layer=c&cbll=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, padding: '4px 8px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
                        🚶 Street View
                      </a>
                      <a href={`https://www.google.com/maps/search/${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, padding: '4px 8px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
                        👁 Google Maps
                      </a>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, padding: '4px 8px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
                        📌 Rota
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Trail Polyline */}
            {trail.length >= 2 && (
              <Polyline positions={trail} pathOptions={{ color: '#4183ef', weight: 3, opacity: 0.7, dashArray: '8, 6' }} />
            )}
          </MapContainer>

          {/* Fullscreen Overlay */}
          {isFullscreen && selectedVehicle && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(15,23,42,0.92)', padding: '16px 24px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 1001,
            }}>
              <div>
                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 18 }}>{selectedVehicle.name}</div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>📍 {getAddress(selectedVehicle)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 32, fontWeight: 700,
                  color: selectedVehicle.speed > 2 ? '#22c55e' : '#ef4444',
                }}>{selectedVehicle.speed}</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>km/h</div>
              </div>
            </div>
          )}

          {/* Loading Trail Indicator */}
          {loadingTrail && (
            <div style={{
              position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.7)',
              color: '#fff', padding: '8px 12px', borderRadius: 8, fontSize: 12, zIndex: 999,
            }}>
              Carregando trajetória...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
