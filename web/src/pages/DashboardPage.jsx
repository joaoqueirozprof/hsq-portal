import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { positionsAPI, devicesAPI } from "../services/api";
import {
  Car, MapPin, Navigation, Clock, Play, Pause, RotateCcw,
  Activity, Zap, Route, Gauge, Radio, Maximize2, Minimize2,
  Layers, Satellite, Map, X, RefreshCw, ChevronRight,
  ArrowUp, Signal, AlertCircle
} from "lucide-react";

// ── Tile layers ──────────────────────────────────────────────
const TILE_LAYERS = {
  osm: {
    label: "OpenStreetMap",
    icon: Map,
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: "abc",
    maxZoom: 19,
  },
  google: {
    label: "Google Maps",
    icon: Map,
    url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
    subdomains: "0123",
    maxZoom: 20,
  },
  hybrid: {
    label: "Híbrido",
    icon: Layers,
    url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
    subdomains: "0123",
    maxZoom: 20,
  },
  satellite: {
    label: "Satélite",
    icon: Satellite,
    url: "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
    subdomains: "0123",
    maxZoom: 20,
  },
};

// ── Icons ────────────────────────────────────────────────────
const createVehicleIcon = (isOnline, isSelected = false) => {
  const color = isOnline ? "#22c55e" : "#94a3b8";
  const size = isSelected ? 46 : 38;
  const pulse = isOnline ? `<div style="position:absolute;width:${size*1.8}px;height:${size*1.8}px;border-radius:50%;background:${color};opacity:0.18;top:50%;left:50%;transform:translate(-50%,-50%);animation:vp 2s infinite ease-in-out;"></div>` : "";
  return L.divIcon({
    className: "custom-marker",
    html: `<style>@keyframes vp{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.18}50%{transform:translate(-50%,-50%) scale(1.4);opacity:.06}}</style>
    <div style="position:relative;width:${size}px;height:${size}px;">
      ${pulse}
      <div style="position:relative;z-index:1;width:${size}px;height:${size}px;background:${color};border-radius:50%;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.25),0 0 0 1px ${color}30;display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="${size*.46}" height="${size*.46}" viewBox="0 0 24 24" fill="white">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
        </svg>
      </div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const createReplayIcon = () => L.divIcon({
  className: "replay-marker",
  html: `<div style="width:28px;height:28px;background:#8b5cf6;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 12px rgba(139,92,246,.5);position:relative;">
    <div style="position:absolute;width:54px;height:54px;border-radius:50%;border:2px solid #8b5cf6;opacity:.35;top:-16px;left:-16px;animation:rp 1.5s infinite;"></div>
  </div><style>@keyframes rp{0%,100%{transform:scale(1);opacity:.35}50%{transform:scale(1.2);opacity:.1}}</style>`,
  iconSize: [28, 28], iconAnchor: [14, 14],
});

// ── Helpers ──────────────────────────────────────────────────
function MapFlyTo({ lat, lng, zoom = 16 }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) map.flyTo([lat, lng], zoom, { duration: 1.2 });
  }, [lat, lng]);
  return null;
}

function MapFitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (!positions?.length) return;
    const valid = positions.filter(p => p?.lat != null && p?.lng != null);
    if (valid.length > 0) {
      const bounds = L.latLngBounds(valid.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [positions]);
  return null;
}

const courseToArrow = (course) => {
  if (course == null) return "";
  const deg = Math.round(course);
  const dirs = ["N","NE","L","SE","S","SO","O","NO"];
  return dirs[Math.round(deg / 45) % 8];
};

// Reverse geocode via Nominatim (free, no key needed)
const geocodeCache = {};
async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt`,
      { headers: { "User-Agent": "HSQPortal/2.0" } }
    );
    const data = await res.json();
    const addr = data.address || {};
    const parts = [
      addr.road || addr.street,
      addr.house_number,
      addr.suburb || addr.neighbourhood || addr.district,
      addr.city || addr.town || addr.village || addr.municipality,
      addr.state,
    ].filter(Boolean);
    const result = parts.join(", ") || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    geocodeCache[key] = result;
    return result;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// ── Tile selector (floating) ──────────────────────────────────
function TileSelector({ active, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl shadow text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Layers size={14} />
        {TILE_LAYERS[active].label}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 min-w-[160px]">
          {Object.entries(TILE_LAYERS).map(([key, layer]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors text-left ${
                active === key ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <layer.icon size={13} />
              {layer.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fullscreen Tracker ────────────────────────────────────────
function FullscreenTracker({ device, position, onClose }) {
  const [tileKey, setTileKey] = useState("google");
  const [address, setAddress] = useState("Buscando endereço...");
  const [addressLoading, setAddressLoading] = useState(false);

  const speed = position ? Math.round((position.speed || 0) * 1.852) : 0;
  const lat = position?.lat ?? position?.latitude;
  const lng = position?.lng ?? position?.longitude;
  const course = position?.course ?? position?.attributes?.course ?? 0;
  const lastUpdate = position?.fixTime || position?.serverTime || position?.timestamp;

  useEffect(() => {
    if (lat == null || lng == null) return;
    setAddressLoading(true);
    reverseGeocode(lat, lng).then(addr => {
      setAddress(addr);
      setAddressLoading(false);
    });
  }, [lat?.toFixed(4), lng?.toFixed(4)]);

  const tile = TILE_LAYERS[tileKey];

  if (!position || lat == null) return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center">
      <div className="text-center text-white">
        <AlertCircle size={40} className="mx-auto mb-3 text-slate-400" />
        <p>Sem posição disponível para este veículo</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-slate-700 rounded-xl text-sm hover:bg-slate-600">Fechar</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-900" style={{paddingTop: "env(safe-area-inset-top)"}}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[10000] flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-md">
            <Car size={15} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">{device?.name}</p>
            <p className="text-white/60 text-xs">{device?.uniqueId}</p>
          </div>
        </div>
        <div className="flex-1" />
        <div className="pointer-events-auto">
          <TileSelector active={tileKey} onChange={setTileKey} />
        </div>
        <button
          onClick={onClose}
          className="pointer-events-auto p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[lat, lng]}
          zoom={17}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer key={tileKey} url={tile.url} attribution={tile.attribution} subdomains={tile.subdomains} maxZoom={tile.maxZoom || 19} />
          <MapFlyTo lat={lat} lng={lng} zoom={17} />
          <Marker position={[lat, lng]} icon={createVehicleIcon(true, true)} />
        </MapContainer>

        {/* Speed bubble (center-bottom of map) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="flex items-center gap-1 px-5 py-3 bg-black/70 backdrop-blur-md rounded-2xl shadow-xl border border-white/10">
            <span className="text-white text-4xl font-black tabular-nums">{speed}</span>
            <div className="ml-1">
              <p className="text-white/80 text-xs font-medium leading-tight">km/h</p>
              <div className="flex items-center gap-1 mt-0.5">
                <ArrowUp size={10} className="text-white/60" style={{transform:`rotate(${course}deg)`}} />
                <span className="text-white/60 text-xs">{courseToArrow(course)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom info panel */}
      <div className="bg-white rounded-t-2xl shadow-2xl px-5 pt-5 pb-6" style={{paddingBottom:"calc(1.5rem + env(safe-area-inset-bottom))"}}>
        {/* Handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

        {/* Address */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin size={17} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 font-medium mb-0.5">Localização atual</p>
            {addressLoading ? (
              <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
            ) : (
              <p className="text-slate-900 text-sm font-medium leading-snug">{address}</p>
            )}
            <p className="text-slate-400 text-xs mt-0.5 font-mono">{lat?.toFixed(6)}, {lng?.toFixed(6)}</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl">
            <Gauge size={16} className="text-blue-500 mb-1.5" />
            <span className="text-lg font-black text-slate-900 tabular-nums">{speed}</span>
            <span className="text-xs text-slate-400">km/h</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl">
            <Navigation size={16} className="text-purple-500 mb-1.5" style={{transform:`rotate(${course}deg)`}} />
            <span className="text-lg font-black text-slate-900">{courseToArrow(course)}</span>
            <span className="text-xs text-slate-400">Direção</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-slate-50 rounded-xl">
            <Clock size={16} className="text-green-500 mb-1.5" />
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {lastUpdate ? new Date(lastUpdate).toLocaleTimeString("pt-BR", {hour:"2-digit",minute:"2-digit"}) : "--:--"}
            </span>
            <span className="text-xs text-slate-400">Atualizado</span>
          </div>
        </div>

        {/* Attributes */}
        {position?.attributes && (
          <div className="mt-3 flex flex-wrap gap-2">
            {position.attributes.ignition !== undefined && (
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${position.attributes.ignition ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                Ignição {position.attributes.ignition ? "ligada" : "desligada"}
              </span>
            )}
            {position.attributes.motion !== undefined && (
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${position.attributes.motion ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                {position.attributes.motion ? "Em movimento" : "Parado"}
              </span>
            )}
            {position.attributes.batteryLevel != null && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-yellow-50 text-yellow-700">
                Bateria {Math.round(position.attributes.batteryLevel)}%
              </span>
            )}
            {position.attributes.distance != null && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 text-purple-700">
                {(position.attributes.distance / 1000).toFixed(1)} km percorridos
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardPage() {
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tileKey, setTileKey] = useState("osm");
  const [selectedId, setSelectedId] = useState(null);
  const [fullscreenId, setFullscreenId] = useState(null);
  const [error, setError] = useState("");

  // Replay
  const [replayOpen, setReplayOpen] = useState(false);
  const [replayDevice, setReplayDevice] = useState("");
  const [replayDate, setReplayDate] = useState(new Date().toISOString().split("T")[0]);
  const [replayPositions, setReplayPositions] = useState([]);
  const [replayIdx, setReplayIdx] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replayLoading, setReplayLoading] = useState(false);
  const replayRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [posRes, devRes] = await Promise.all([positionsAPI.list(), devicesAPI.list()]);
      setPositions(posRes.data || []);
      setDevices(devRes.data || []);
    } catch (e) { setError("Erro ao carregar dados"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10000);
    return () => clearInterval(id);
  }, []);

  // Replay playback
  useEffect(() => {
    if (replayRef.current) { clearInterval(replayRef.current); replayRef.current = null; }
    if (!replayPlaying || !replayPositions.length) return;
    replayRef.current = setInterval(() => {
      setReplayIdx(prev => {
        if (prev + 1 >= replayPositions.length) { setReplayPlaying(false); return prev; }
        return prev + 1;
      });
    }, 600);
    return () => clearInterval(replayRef.current);
  }, [replayPlaying, replayPositions]);

  const startReplay = async () => {
    if (!replayDevice || !replayDate) return;
    setReplayLoading(true); setError("");
    try {
      const res = await positionsAPI.history(replayDevice, `${replayDate}T00:00:00.000Z`, `${replayDate}T23:59:59.000Z`);
      const pts = (res.data || []).map(p => ({
        lat: p.latitude ?? p.lat,
        lng: p.longitude ?? p.lng,
        speed: (p.speed || 0) * 1.852,
        course: p.course || 0,
        time: p.fixTime || p.serverTime,
      })).filter(p => p.lat != null);
      if (!pts.length) { setError("Nenhuma posição encontrada para esta data"); return; }
      setReplayPositions(pts); setReplayIdx(0); setReplayPlaying(false);
    } catch (e) { setError("Erro ao carregar replay"); }
    finally { setReplayLoading(false); }
  };

  const onlineCount = positions.length;
  const offlineCount = devices.length - onlineCount;
  const maxSpeed = positions.length ? Math.round(Math.max(...positions.map(p => (p.speed || 0) * 1.852))) : 0;

  const selectedPos = selectedId ? positions.find(p => p.deviceId === selectedId) : null;
  const selectedDev = selectedId ? devices.find(d => d.id === selectedId) : null;
  const fullscreenPos = fullscreenId ? positions.find(p => p.deviceId === fullscreenId) : null;
  const fullscreenDev = fullscreenId ? devices.find(d => d.id === fullscreenId) : null;

  const tile = TILE_LAYERS[tileKey];
  const replayCurrent = replayPositions[replayIdx];
  const mapPositions = replayOpen && replayPositions.length ? replayPositions : positions;

  return (
    <>
      {/* Fullscreen tracker */}
      {fullscreenId && (
        <FullscreenTracker
          device={fullscreenDev}
          position={fullscreenPos}
          onClose={() => setFullscreenId(null)}
        />
      )}

      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900" style={{fontFamily:"Space Grotesk,sans-serif"}}>Dashboard</h1>
            <p className="text-slate-400 text-xs mt-0.5">Última atualização: {new Date().toLocaleTimeString("pt-BR")}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="btn-ghost"><RefreshCw size={15} /></button>
            <button onClick={() => { setReplayOpen(true); setReplayPositions([]); }} className="btn-primary">
              <Route size={15} />Replay
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total", value: devices.length, sub: "veículos", icon: Car, color: "blue" },
            { label: "Online", value: onlineCount, sub: "com posição", icon: Signal, color: "green" },
            { label: "Offline", value: offlineCount, sub: "sem sinal", icon: Radio, color: "slate" },
            { label: "Vel. máxima", value: `${maxSpeed}`, sub: "km/h agora", icon: Gauge, color: "purple" },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <div className={`p-2 rounded-lg bg-${color}-50`}>
                  <Icon size={14} className={`text-${color}-500`} />
                </div>
              </div>
              <p className={`text-2xl font-black text-slate-900 tabular-nums`}>{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={15} className="flex-shrink-0" />
            {error}
            <button onClick={() => setError("")} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Map + list */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Map */}
          <div className="xl:col-span-2 card overflow-hidden">
            {/* Map header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-blue-500" />
                <span className="text-sm font-semibold text-slate-700">Mapa ao vivo</span>
                <span className="text-xs text-slate-400">({onlineCount} veículo{onlineCount !== 1 ? "s" : ""})</span>
              </div>
              <TileSelector active={tileKey} onChange={setTileKey} />
            </div>

            {/* Map */}
            <div className="relative" style={{height: "440px"}}>
              {loading ? (
                <div className="absolute inset-0 bg-slate-100 animate-pulse flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                </div>
              ) : (
                <MapContainer center={[-15.788, -47.879]} zoom={5} style={{height:"100%",width:"100%"}} zoomControl={true}>
                  <TileLayer key={tileKey} url={tile.url} attribution={tile.attribution} subdomains={tile.subdomains} maxZoom={tile.maxZoom || 19} />
                  {selectedPos && <MapFlyTo lat={selectedPos.lat ?? selectedPos.latitude} lng={selectedPos.lng ?? selectedPos.longitude} zoom={15} />}
                  {!selectedId && <MapFitBounds positions={mapPositions.map(p => ({lat: p.lat ?? p.latitude, lng: p.lng ?? p.longitude}))} />}

                  {/* Replay path */}
                  {replayOpen && replayPositions.length > 0 && (
                    <>
                      <Polyline
                        positions={replayPositions.map(p => [p.lat, p.lng])}
                        pathOptions={{color:"#8b5cf6", weight:4, opacity:.7, dashArray: null}}
                      />
                      {replayCurrent && (
                        <Marker position={[replayCurrent.lat, replayCurrent.lng]} icon={createReplayIcon()}>
                          <Popup>
                            <div className="text-sm">
                              <p className="font-semibold">{replayCurrent.speed?.toFixed(0)} km/h</p>
                              <p className="text-slate-500 text-xs">{replayCurrent.time ? new Date(replayCurrent.time).toLocaleString("pt-BR") : ""}</p>
                            </div>
                          </Popup>
                        </Marker>
                      )}
                    </>
                  )}

                  {/* Live markers */}
                  {!replayOpen && positions.map(pos => {
                    const lat = pos.lat ?? pos.latitude;
                    const lng = pos.lng ?? pos.longitude;
                    if (lat == null || lng == null) return null;
                    const dev = devices.find(d => d.id === pos.deviceId);
                    const spd = Math.round((pos.speed || 0) * 1.852);
                    return (
                      <Marker
                        key={pos.deviceId}
                        position={[lat, lng]}
                        icon={createVehicleIcon(true, selectedId === pos.deviceId)}
                        eventHandlers={{ click: () => setSelectedId(pos.deviceId === selectedId ? null : pos.deviceId) }}
                      >
                        <Popup>
                          <div className="min-w-[180px]">
                            <p className="font-bold text-slate-900 text-sm mb-2">{dev?.name || pos.deviceId}</p>
                            <div className="space-y-1 text-xs text-slate-600">
                              <div className="flex justify-between">
                                <span>Velocidade:</span>
                                <span className="font-semibold text-slate-900">{spd} km/h</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Direção:</span>
                                <span className="font-semibold text-slate-900">{courseToArrow(pos.course)}</span>
                              </div>
                              {pos.fixTime && (
                                <div className="flex justify-between">
                                  <span>Atualizado:</span>
                                  <span className="font-semibold text-slate-900">{new Date(pos.fixTime).toLocaleTimeString("pt-BR")}</span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => setFullscreenId(pos.deviceId)}
                              className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Maximize2 size={12} />
                              Rastrear em tela cheia
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              )}
            </div>

            {/* Replay controls */}
            {replayOpen && (
              <div className="border-t border-slate-100 bg-purple-50/60 p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="label">Veículo</label>
                    <select className="input py-2 text-xs" value={replayDevice} onChange={e => setReplayDevice(e.target.value)}>
                      <option value="">Selecione...</option>
                      {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Data</label>
                    <input type="date" className="input py-2 text-xs" value={replayDate} onChange={e => setReplayDate(e.target.value)} />
                  </div>
                  <button onClick={startReplay} disabled={!replayDevice || replayLoading} className="btn-primary py-2 text-xs">
                    {replayLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Carregar"}
                  </button>
                  {replayPositions.length > 0 && (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button onClick={() => { if (replayIdx >= replayPositions.length-1) setReplayIdx(0); setReplayPlaying(p => !p); }}
                        className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 flex-shrink-0">
                        {replayPlaying ? <Pause size={15}/> : <Play size={15}/>}
                      </button>
                      <button onClick={() => { setReplayIdx(0); setReplayPlaying(false); }}
                        className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 flex-shrink-0">
                        <RotateCcw size={15}/>
                      </button>
                      <div className="flex-1 min-w-0">
                        <input type="range" min={0} max={replayPositions.length-1} value={replayIdx}
                          onChange={e => { setReplayIdx(Number(e.target.value)); setReplayPlaying(false); }}
                          className="w-full accent-purple-600" />
                        <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                          <span>{replayCurrent?.time ? new Date(replayCurrent.time).toLocaleTimeString("pt-BR") : "--"}</span>
                          <span>{replayIdx+1}/{replayPositions.length}</span>
                          <span className="font-medium text-purple-700">{replayCurrent?.speed?.toFixed(0)} km/h</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <button onClick={() => { setReplayOpen(false); setReplayPositions([]); setReplayPlaying(false); }}
                    className="btn-ghost text-xs py-2">Fechar</button>
                </div>
              </div>
            )}
          </div>

          {/* Vehicle list */}
          <div className="card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
              <span className="text-sm font-semibold text-slate-700">Veículos</span>
              <span className="text-xs text-slate-400">{devices.length} total</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {loading && !devices.length ? (
                <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
              ) : devices.length === 0 ? (
                <div className="p-8 text-center"><Car size={32} className="mx-auto text-slate-300 mb-2" /><p className="text-slate-400 text-sm">Nenhum veículo</p></div>
              ) : (
                devices.map(device => {
                  const pos = positions.find(p => p.deviceId === device.id);
                  const isOnline = !!pos;
                  const isSelected = selectedId === device.id;
                  const spd = pos ? Math.round((pos.speed || 0) * 1.852) : 0;
                  return (
                    <div
                      key={device.id}
                      onClick={() => setSelectedId(isSelected ? null : device.id)}
                      className={`px-4 py-3 cursor-pointer transition-all ${isSelected ? "bg-blue-50 border-l-2 border-blue-500" : "hover:bg-slate-50 border-l-2 border-transparent"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? "bg-green-50" : "bg-slate-100"}`}>
                            <Car size={18} className={isOnline ? "text-green-600" : "text-slate-400"} />
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isOnline ? "bg-green-500" : "bg-slate-300"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isSelected ? "text-blue-700" : "text-slate-800"}`}>{device.name}</p>
                          <p className="text-xs text-slate-400 font-mono truncate">{device.uniqueId}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isOnline && (
                            <span className="text-sm font-bold text-slate-700 tabular-nums">{spd}<span className="text-xs font-normal text-slate-400"> km/h</span></span>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setFullscreenId(device.id); }}
                            className={`p-1.5 rounded-lg transition-colors ml-1 ${isOnline ? "text-blue-500 hover:bg-blue-50" : "text-slate-300 cursor-not-allowed"}`}
                            disabled={!isOnline}
                            title="Tela cheia"
                          >
                            <Maximize2 size={14} />
                          </button>
                        </div>
                      </div>
                      {isSelected && pos && (
                        <div className="mt-2 ml-13 flex gap-2 flex-wrap">
                          {pos.attributes?.ignition !== undefined && (
                            <span className={`px-2 py-0.5 rounded text-xs ${pos.attributes.ignition ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                              Ignição {pos.attributes.ignition ? "on" : "off"}
                            </span>
                          )}
                          {pos.fixTime && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">
                              {new Date(pos.fixTime).toLocaleTimeString("pt-BR")}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex-shrink-0">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Online ({onlineCount})</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />Offline ({offlineCount})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
