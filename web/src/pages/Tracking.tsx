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

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
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
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [searchFilter, setSearchFilter] = useState('');
  const [mapLayer, setMapLayer] = useState<keyof typeof MAP_LAYERS>('streets');
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [trail, setTrail] = useState<[number, number][]>([]);
  const [loadingTrail, setLoadingTrail] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(null);
  const [addressVersion, setAddressVersion] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [commandMenuId, setCommandMenuId] = useState<number | null>(null);
  const [sendingCommand, setSendingCommand] = useState(false);

  const pollRef = useRef(true);
  const lastTimestamp = useRef(0);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const mapInstanceRef = useRef<L.Map | null>(null);
  const initialBoundsRef = useRef(false);
  const toastIdRef = useRef(0);
  const navigate = useNavigate();
  const { token, user } = useAuthStore();

  // Responsive listener
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile && !sidebarOpen) setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen]);

  // Toast system
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // Send remote command
  const sendCommand = useCallback(async (deviceId: number, command: string, label: string) => {
    if (!token || sendingCommand) return;
    setSendingCommand(true);
    setCommandMenuId(null);
    try {
      const resp = await fetch(`/api/tracking/commands/${deviceId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await resp.json();
      if (resp.ok) {
        addToast(`${label} enviado com sucesso!`, 'success');
      } else {
        addToast(data.error || `Falha ao enviar ${label}`, 'error');
      }
    } catch {
      addToast(`Erro de conexao ao enviar ${label}`, 'error');
    }
    setSendingCommand(false);
  }, [token, sendingCommand, addToast]);

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
      if (isMobile) setSidebarOpen(false);
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
              if (p.latitude && p.longitude) {
                const animated = startSmoothAnimation(p.deviceId, p.latitude, p.longitude, markersRef.current, selectedId, mapInstanceRef.current);
                if (!animated) {
                  const marker = markersRef.current.get(p.deviceId);
                  if (marker) marker.setLatLng([p.latitude, p.longitude]);
                }
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

  // Close command menu on outside click
  useEffect(() => {
    if (commandMenuId === null) return;
    const handler = () => setCommandMenuId(null);
    setTimeout(() => document.addEventListener('click', handler), 10);
    return () => document.removeEventListener('click', handler);
  }, [commandMenuId]);

  // Filtered vehicles
  const filtered = vehicles.filter((v) =>
    v.name.toLowerCase().includes(searchFilter.toLowerCase()) && v.latitude !== 0
  );
  const online = vehicles.filter((v) => v.status === 'online').length;
  const moving = vehicles.filter((v) => v.speed > 2).length;
  const selectedVehicle = vehicles.find((v) => v.deviceId === selectedId);
  const isAdmin = user?.role === 'admin';

  // Get live address for a vehicle
  function getAddress(v: VehiclePosition): string {
    void addressVersion;
    return v.address || getCachedAddress(v.latitude, v.longitude) || 'Buscando endereco...';
  }

  if (loading) return <Loading fullScreen message="Conectando ao rastreamento..." />;

  // If an overlay is active, render it full screen
  if (activeOverlay === 'reports') return <Reports token={token!} onClose={() => setActiveOverlay(null)} />;
  if (activeOverlay === 'geofences') return <Geofences token={token!} onClose={() => setActiveOverlay(null)} />;
  if (activeOverlay === 'replay') return <Replay token={token!} onClose={() => setActiveOverlay(null)} />;

  const currentLayer = MAP_LAYERS[mapLayer];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(17,24,39,0.98), rgba(15,23,42,0.98))',
        borderBottom: '1px solid rgba(59,130,246,0.15)',
        padding: isMobile ? '8px 10px' : '8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8, flexShrink: 0, zIndex: 1000,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(100,116,139,0.2)', border: '1px solid rgba(100,116,139,0.3)',
              color: 'var(--text-muted)', borderRadius: 8, padding: '6px 12px',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.2s',
            }}
          >
            ← {isMobile ? '' : 'Voltar'}
          </button>
          {!isMobile && (
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
              Rastreamento
            </span>
          )}
        </div>

        {/* Stats badges - hide details on mobile */}
        <div style={{ display: 'flex', gap: isMobile ? 8 : 16, fontSize: isMobile ? 11 : 13 }}>
          <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)', display: 'inline-block', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
            {online}
          </span>
          <span style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 0, height: 0, borderLeft: '5px solid var(--accent-blue)', borderTop: '4px solid transparent', borderBottom: '4px solid transparent', display: 'inline-block' }} />
            {moving}
          </span>
          <span style={{ color: 'var(--text-dim)' }}>
            {vehicles.length - online} off
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
          {!isMobile && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveOverlay('replay')}>Replay</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveOverlay('reports')}>Relatorios</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveOverlay('geofences')}>Geocercas</button>
            </>
          )}
          <select
            value={mapLayer}
            onChange={(e) => setMapLayer(e.target.value as keyof typeof MAP_LAYERS)}
            style={{
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 6,
              padding: '4px 8px', fontSize: 12, cursor: 'pointer',
            }}
          >
            <option value="streets">Ruas</option>
            <option value="satellite">Satelite</option>
            <option value="hybrid">Hibrido</option>
            <option value="terrain">Terreno</option>
          </select>
          <button
            onClick={toggleFullscreen}
            style={{
              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
              color: 'var(--accent-blue)', borderRadius: 8, padding: '6px 10px',
              cursor: 'pointer', fontSize: 14, transition: 'all 0.2s',
            }}
          >
            {isFullscreen ? '✕' : '⛶'}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: sidebarOpen ? 'rgba(59,130,246,0.2)' : 'rgba(100,116,139,0.2)',
              border: `1px solid ${sidebarOpen ? 'rgba(59,130,246,0.3)' : 'rgba(100,116,139,0.3)'}`,
              color: sidebarOpen ? 'var(--accent-blue)' : 'var(--text-muted)',
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13,
              fontWeight: 600, transition: 'all 0.2s',
            }}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
      </div>

      {/* Mobile feature bar */}
      {isMobile && (
        <div style={{
          display: 'flex', gap: 6, padding: '6px 10px',
          background: 'rgba(17,24,39,0.95)', borderBottom: '1px solid var(--border)',
          overflowX: 'auto', flexShrink: 0, zIndex: 999,
        }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveOverlay('replay')} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>Replay</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveOverlay('reports')} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>Relatorios</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveOverlay('geofences')} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>Geocercas</button>
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Sidebar - responsive overlay on mobile */}
        {sidebarOpen && (
          <>
            {/* Mobile backdrop */}
            {isMobile && (
              <div
                onClick={() => setSidebarOpen(false)}
                style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                  zIndex: 1001, animation: 'fadeIn 0.2s',
                }}
              />
            )}
            <div style={{
              width: isMobile ? '85%' : 340,
              maxWidth: isMobile ? 360 : 340,
              background: 'linear-gradient(180deg, rgba(17,24,39,0.98), rgba(15,23,42,0.98))',
              borderRight: '1px solid rgba(59,130,246,0.1)',
              display: 'flex', flexDirection: 'column', flexShrink: 0,
              position: isMobile ? 'absolute' : 'relative',
              left: 0, top: 0, bottom: 0,
              zIndex: isMobile ? 1002 : 'auto',
              animation: isMobile ? 'slideRight 0.3s ease-out' : 'none',
              backdropFilter: 'blur(12px)',
            }}>
              {/* Sidebar header */}
              <div style={{ padding: '12px 12px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="form-input"
                  placeholder="Buscar veiculo..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{ fontSize: 13, padding: '10px 14px', flex: 1, borderRadius: 10 }}
                />
                {isMobile && (
                  <button
                    onClick={() => setSidebarOpen(false)}
                    style={{
                      background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                      color: '#ef4444', borderRadius: 8, padding: '8px 10px',
                      cursor: 'pointer', fontSize: 14,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Vehicle list */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
                {filtered.map((v) => {
                  const addr = getAddress(v);
                  const isSelected = selectedId === v.deviceId;
                  return (
                    <div key={v.deviceId} style={{ position: 'relative', marginBottom: 4 }}>
                      <div
                        onClick={() => selectVehicle(v.deviceId)}
                        style={{
                          padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                          background: isSelected
                            ? 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.08))'
                            : 'rgba(30,41,59,0.3)',
                          border: isSelected
                            ? '1px solid rgba(59,130,246,0.35)'
                            : '1px solid transparent',
                          transition: 'all 0.25s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                              background: v.speed > 2 ? 'rgba(34,197,94,0.2)' : v.status === 'online' ? 'rgba(234,179,8,0.2)' : 'rgba(100,116,139,0.2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 20, border: `2px solid ${v.speed > 2 ? '#22c55e' : v.status === 'online' ? '#eab308' : '#475569'}`,
                            }}>
                              {v.category === 'truck' ? '🚛' : v.category === 'motorcycle' ? '🏍' : v.category === 'bus' ? '🚌' : v.category === 'van' ? '🚐' : '🚗'}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {v.name}
                              </div>
                              <div style={{ fontSize: 12, color: v.speed > 0 ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: v.speed > 0 ? 600 : 400 }}>
                                {v.speed > 0 ? `${v.speed} km/h` : 'Parado'}
                              </div>
                              {addr && addr !== 'Buscando endereco...' && (
                                <div style={{
                                  fontSize: 11, color: 'var(--text-dim)', marginTop: 2,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  maxWidth: isMobile ? 180 : 200,
                                }}>
                                  {addr}
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {/* Command button - admin only */}
                            {isAdmin && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setCommandMenuId(commandMenuId === v.deviceId ? null : v.deviceId); }}
                                style={{
                                  background: 'rgba(100,116,139,0.2)', border: '1px solid rgba(100,116,139,0.3)',
                                  color: 'var(--text-muted)', borderRadius: 6, padding: '4px 8px',
                                  cursor: 'pointer', fontSize: 14, transition: 'all 0.2s',
                                }}
                                title="Comandos"
                              >
                                ⚡
                              </button>
                            )}
                            <div style={{
                              width: 10, height: 10, borderRadius: '50%',
                              background: v.speed > 2 ? 'var(--accent-green)' : v.status === 'online' ? '#eab308' : '#475569',
                              boxShadow: v.speed > 2 ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
                              transition: 'all 0.3s',
                            }} />
                          </div>
                        </div>
                      </div>

                      {/* Command dropdown */}
                      {commandMenuId === v.deviceId && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: 'absolute', right: 8, top: '100%', zIndex: 2000,
                            background: 'rgba(17,24,39,0.98)', border: '1px solid rgba(59,130,246,0.2)',
                            borderRadius: 12, padding: 8, minWidth: 200,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            animation: 'slideUp 0.2s ease-out',
                            backdropFilter: 'blur(12px)',
                          }}
                        >
                          <div style={{ padding: '4px 8px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                            Comandos - {v.name}
                          </div>
                          {[
                            { cmd: 'engineStop', label: 'Desligar Motor', icon: '🔴', color: '#ef4444' },
                            { cmd: 'engineResume', label: 'Ligar Motor', icon: '🟢', color: '#22c55e' },
                            { cmd: 'fuelCut', label: 'Cortar Combustivel', icon: '⛽', color: '#f59e0b' },
                            { cmd: 'fuelResume', label: 'Liberar Combustivel', icon: '⛽', color: '#3b82f6' },
                          ].map(({ cmd, label, icon, color }) => (
                            <button
                              key={cmd}
                              disabled={sendingCommand}
                              onClick={() => sendCommand(v.deviceId, cmd, label)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                padding: '10px 12px', background: 'transparent',
                                border: 'none', borderRadius: 8, cursor: sendingCommand ? 'wait' : 'pointer',
                                color: 'var(--text-primary)', fontSize: 13, textAlign: 'left',
                                transition: 'all 0.15s',
                                opacity: sendingCommand ? 0.5 : 1,
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = `${color}22`; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              <span style={{ fontSize: 16 }}>{icon}</span>
                              <span>{label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32, fontSize: 14 }}>
                    Nenhum veiculo encontrado
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer
            center={[-6.1, -38.2]}
            zoom={mapZoom}
            style={{ height: '100%', width: '100%' }}
            zoomControl={!isMobile}
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
                    <div style={{ fontSize: 13, marginBottom: 4 }}>Velocidade: <b>{v.speed} km/h</b></div>
                    <div style={{ fontSize: 13, marginBottom: 4, padding: '4px 0', borderBottom: '1px solid #e2e8f0' }}>
                      <span style={{ color: '#334155' }}>{getAddress(v)}</span>
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: 11 }}>
                      Atualizado: {v.fixTime ? new Date(v.fixTime).toLocaleString('pt-BR') : v.lastUpdate ? new Date(v.lastUpdate).toLocaleString('pt-BR') : '-'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      <a href={`https://www.google.com/maps?layer=c&cbll=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, padding: '4px 8px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
                        Street View
                      </a>
                      <a href={`https://www.google.com/maps/search/${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, padding: '4px 8px', background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
                        Google Maps
                      </a>
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${v.latitude},${v.longitude}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, padding: '4px 8px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
                        Rota
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

          {/* Live info overlay - always visible when vehicle selected */}
          {selectedVehicle && (
            <div style={{
              position: 'absolute',
              bottom: isMobile ? 8 : 16,
              left: isMobile ? 8 : 16,
              right: isMobile ? 8 : 'auto',
              maxWidth: isMobile ? 'none' : 400,
              background: 'linear-gradient(135deg, rgba(15,23,42,0.94), rgba(17,24,39,0.94))',
              borderRadius: 16, padding: isMobile ? '12px 14px' : '14px 20px',
              zIndex: 999,
              border: '1px solid rgba(59,130,246,0.2)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              animation: 'slideUp 0.3s ease-out',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: isMobile ? 14 : 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {selectedVehicle.name}
                </div>
                <div style={{
                  color: '#94a3b8', fontSize: isMobile ? 11 : 12, marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {getAddress(selectedVehicle)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontSize: isMobile ? 26 : 32, fontWeight: 800, lineHeight: 1,
                  background: selectedVehicle.speed > 2
                    ? 'linear-gradient(135deg, #22c55e, #4ade80)'
                    : 'linear-gradient(135deg, #ef4444, #f87171)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {selectedVehicle.speed}
                </div>
                <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600 }}>km/h</div>
              </div>
            </div>
          )}

          {/* Mobile floating sidebar toggle */}
          {isMobile && !sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                position: 'absolute', top: 10, left: 10, zIndex: 999,
                background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(37,99,235,0.9))',
                border: 'none', borderRadius: 12, padding: '10px 14px',
                color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
                display: 'flex', alignItems: 'center', gap: 6,
                backdropFilter: 'blur(8px)',
              }}
            >
              <span style={{ fontSize: 16 }}>🚗</span>
              <span>{vehicles.filter(v => v.latitude !== 0).length}</span>
            </button>
          )}

          {/* Loading Trail Indicator */}
          {loadingTrail && (
            <div style={{
              position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.8)',
              color: '#fff', padding: '8px 14px', borderRadius: 10, fontSize: 12, zIndex: 999,
              display: 'flex', alignItems: 'center', gap: 8,
              border: '1px solid rgba(59,130,246,0.2)',
            }}>
              <span className="spinner" style={{ width: 14, height: 14 }} /> Carregando trajetoria...
            </div>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      <div style={{
        position: 'fixed', top: 16, right: 16, zIndex: 99999,
        display: 'flex', flexDirection: 'column', gap: 8,
        maxWidth: isMobile ? 'calc(100vw - 32px)' : 360,
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              padding: '12px 16px', borderRadius: 12,
              background: t.type === 'success'
                ? 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.08))'
                : t.type === 'error'
                ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))'
                : 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.08))',
              border: `1px solid ${t.type === 'success' ? 'rgba(34,197,94,0.3)' : t.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)'}`,
              color: t.type === 'success' ? '#4ade80' : t.type === 'error' ? '#f87171' : '#60a5fa',
              fontSize: 13, fontWeight: 500,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(12px)',
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✕ ' : 'ℹ '}{t.message}
          </div>
        ))}
      </div>

      {/* CSS for slideRight animation */}
      <style>{`
        @keyframes slideRight {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
