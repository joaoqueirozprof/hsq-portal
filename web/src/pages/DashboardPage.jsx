import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { positionsAPI, devicesAPI } from "../services/api";
import {
  Car, MapPin, Play, Pause, RotateCcw, Route, Gauge,
  Radio, Signal, Maximize2, Layers, Satellite, Map,
  X, RefreshCw, AlertCircle, ArrowUp, Clock, Navigation
} from "lucide-react";

// ─── Tile layers ─────────────────────────────────────────────
const TILES = {
  osm:       { label: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",          sub: "abc",  attr: "© OpenStreetMap" },
  google:    { label: "Google Maps",   url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",        sub: "0123", attr: "© Google" },
  hybrid:    { label: "Híbrido",       url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",        sub: "0123", attr: "© Google" },
  satellite: { label: "Satélite",      url: "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",        sub: "0123", attr: "© Google" },
};

// ─── Car icon (top-down SVG, rotates with course) ─────────────
function buildCarIcon(course = 0, color = "#2563eb", size = 44) {
  const h = Math.round(size * 1.5);
  const w = size;
  return L.divIcon({
    className: "",
    html: `
      <div style="width:${w}px;height:${h}px;transform:rotate(${course}deg);will-change:transform;
                  filter:drop-shadow(0 4px 10px rgba(0,0,0,.40));">
        <svg viewBox="0 0 44 66" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
          <!-- Direction arrow at front -->
          <polygon points="22,0 17,9 27,9" fill="white" opacity=".95"/>
          <!-- Body -->
          <rect x="3"  y="8"  width="38" height="50" rx="13" fill="${color}"/>
          <!-- Hood -->
          <rect x="8"  y="4"  width="28" height="9"  rx="5"  fill="${color}"/>
          <!-- Trunk -->
          <rect x="10" y="56" width="24" height="8"  rx="5"  fill="${color}" opacity=".8"/>
          <!-- Windshield (front) -->
          <rect x="9"  y="13" width="26" height="15" rx="5"  fill="rgba(200,230,255,.92)"/>
          <!-- Roof -->
          <rect x="12" y="29" width="20" height="14" rx="4"  fill="${color === '#2563eb' ? '#1d4ed8' : color}" opacity=".9"/>
          <!-- Rear window -->
          <rect x="11" y="44" width="22" height="11" rx="4"  fill="rgba(200,230,255,.65)"/>
          <!-- Left door line -->
          <rect x="4"  y="30" width="3"  height="12" rx="1.5" fill="white" opacity=".15"/>
          <!-- Right door line -->
          <rect x="37" y="30" width="3"  height="12" rx="1.5" fill="white" opacity=".15"/>
          <!-- Headlights -->
          <rect x="7"  y="3"  width="10" height="5"  rx="2.5" fill="#fef08a"/>
          <rect x="27" y="3"  width="10" height="5"  rx="2.5" fill="#fef08a"/>
          <!-- Taillights -->
          <rect x="7"  y="58" width="10" height="5"  rx="2.5" fill="#fca5a5"/>
          <rect x="27" y="58" width="10" height="5"  rx="2.5" fill="#fca5a5"/>
          <!-- Wheels -->
          <rect x="0"  y="14" width="5"  height="10" rx="2"  fill="#1e293b"/>
          <rect x="39" y="14" width="5"  height="10" rx="2"  fill="#1e293b"/>
          <rect x="0"  y="44" width="5"  height="10" rx="2"  fill="#1e293b"/>
          <rect x="39" y="44" width="5"  height="10" rx="2"  fill="#1e293b"/>
        </svg>
      </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });
}

function buildReplayIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:32px;height:32px;background:#8b5cf6;border-radius:50%;
                       border:3px solid #fff;box-shadow:0 4px 14px rgba(139,92,246,.6);
                       position:relative;">
             <div style="position:absolute;width:60px;height:60px;border-radius:50%;
                         border:2px solid #8b5cf6;opacity:.3;top:-17px;left:-17px;
                         animation:rp 1.5s ease-in-out infinite;"></div>
           </div>
           <style>@keyframes rp{0%,100%{transform:scale(1);opacity:.3}50%{transform:scale(1.25);opacity:.1}}</style>`,
    iconSize: [32, 32], iconAnchor: [16, 16],
  });
}

// ─── Helpers ──────────────────────────────────────────────────
const dirs = ["N","NE","L","SE","S","SO","O","NO"];
const courseDir = (c) => dirs[Math.round((c || 0) / 45) % 8];

const geocodeCache = {};
async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt`,
      { headers: { "User-Agent": "HSQPortal/2.0" } }
    );
    const d = await r.json();
    const a = d.address || {};
    const parts = [a.road, a.house_number, a.suburb || a.neighbourhood, a.city || a.town || a.village, a.state].filter(Boolean);
    const result = parts.join(", ") || d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    geocodeCache[key] = result;
    return result;
  } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
}

// ─── Map auto-follow ──────────────────────────────────────────

function FitBoundsButton({ positions }) {
  const map = useMap();
  const handleFit = () => {
    const pts = positions.filter(p => (p.lat ?? p.latitude) != null).map(p => [p.lat ?? p.latitude, p.lng ?? p.longitude]);
    if (pts.length > 0) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  };
  return (
    <button onClick={handleFit} title="Ver todos"
      className="absolute top-3 left-3 z-[1000] p-2 bg-white border border-slate-200 rounded-xl shadow text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors">
      <Maximize2 size={14} />
    </button>
  );
}

function MapFollow({ lat, lng }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (lat == null || lng == null) return;
    if (!prev.current) { map.setView([lat, lng], 18, { animate: false }); }
    else { map.panTo([lat, lng], { animate: true, duration: 1.5, easeLinearity: 0.25 }); }
    prev.current = [lat, lng];
  }, [lat?.toFixed(5), lng?.toFixed(5)]);
  return null;
}

// ─── Animated car marker ──────────────────────────────────────
function AnimatedCarMarker({ lat, lng, course, color, selected, onClick, children }) {
  const markerRef = useRef(null);
  const animRef   = useRef(null);
  const fromRef   = useRef(null);
  const iconRef   = useRef(null);

  // Build/update icon when course changes
  const icon = buildCarIcon(course || 0, color || "#2563eb", selected ? 50 : 42);

  // Smooth animation between positions
  useEffect(() => {
    if (!markerRef.current || lat == null || lng == null) return;
    const to = [lat, lng];
    const from = fromRef.current || to;
    fromRef.current = to;

    // Skip trivial moves
    if (Math.abs(from[0] - to[0]) < 0.000005 && Math.abs(from[1] - to[1]) < 0.000005) return;

    if (animRef.current) cancelAnimationFrame(animRef.current);
    const t0 = performance.now();
    const dur = 3000; // 3s smooth glide

    const tick = (now) => {
      const t = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
      markerRef.current?.setLatLng([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [lat, lng]);

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);

  if (lat == null || lng == null) return null;
  return (
    <Marker ref={markerRef} position={[lat, lng]} icon={icon} eventHandlers={{ click: onClick }}>
      {children}
    </Marker>
  );
}

// ─── Tile selector ─────────────────────────────────────────────
function TileSelector({ active, onChange, dark = false }) {
  const [open, setOpen] = useState(false);
  const base = dark
    ? "bg-black/40 border-white/20 text-white hover:bg-black/60 backdrop-blur-sm"
    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50";
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-xl shadow text-xs font-medium transition-colors ${base}`}>
        <Layers size={13} />{TILES[active].label}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-[9999] min-w-[160px] overflow-hidden">
          {Object.entries(TILES).map(([k, t]) => (
            <button key={k} onClick={() => { onChange(k); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-left transition-colors
                ${active === k ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}>
              {k === "satellite" || k === "hybrid" ? <Satellite size={13}/> : <Map size={13}/>}
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FULLSCREEN TRACKER (Uber-like) ───────────────────────────
function FullscreenTracker({ device, deviceId, initialPos, onClose }) {
  const [pos, setPos]         = useState(initialPos);
  const [address, setAddress] = useState("Buscando endereço…");
  const [addrLoad, setAddrLoad] = useState(true);
  const [tileKey, setTileKey] = useState("google");
  const markerRef = useRef(null);
  const animRef   = useRef(null);
  const fromRef   = useRef(null);

  const lat    = pos?.lat ?? pos?.latitude;
  const lng    = pos?.lng ?? pos?.longitude;
  const course = pos?.course ?? pos?.attributes?.course ?? 0;
  const speed  = pos ? Math.round(pos.speed || 0) : 0;
  const lastUp = pos?.fixTime || pos?.serverTime;

  // ── Real-time polling every 5s ─────────────────────────────
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await positionsAPI.list();
        const p = (r.data || []).find(p => p.deviceId === deviceId);
        if (p) setPos(p);
      } catch {}
    };
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [deviceId]);

  // ── Smooth marker animation ────────────────────────────────
  useEffect(() => {
    if (!markerRef.current || lat == null) return;
    const to = [lat, lng];
    const from = fromRef.current || to;
    fromRef.current = to;
    if (Math.abs(from[0]-to[0]) < 0.000005 && Math.abs(from[1]-to[1]) < 0.000005) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const t0 = performance.now(); const dur = 3500;
    const tick = (now) => {
      const t = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 3);
      markerRef.current?.setLatLng([from[0]+(to[0]-from[0])*e, from[1]+(to[1]-from[1])*e]);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [lat, lng]);

  // ── Reverse geocode ────────────────────────────────────────
  useEffect(() => {
    if (lat == null) return;
    setAddrLoad(true);
    reverseGeocode(lat, lng).then(a => { setAddress(a); setAddrLoad(false); });
  }, [lat?.toFixed(4), lng?.toFixed(4)]);

  const tile = TILES[tileKey];

  if (lat == null) return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex items-center justify-center">
      <div className="text-center"><AlertCircle size={40} className="mx-auto mb-3 text-slate-500"/>
        <p className="text-slate-300">Sem posição disponível</p>
        <button onClick={onClose} className="mt-4 px-5 py-2 bg-slate-700 rounded-xl text-white text-sm hover:bg-slate-600">Fechar</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{paddingTop:"env(safe-area-inset-top)"}}>
      {/* ── Map fills everything ── */}
      <div className="flex-1 relative">
        <MapContainer center={[lat, lng]} zoom={18} style={{height:"100%",width:"100%"}}
          zoomControl={false} attributionControl={false}>
          <TileLayer key={tileKey} url={tile.url} subdomains={tile.sub} maxZoom={20} />
          <MapFollow lat={lat} lng={lng} />
          {/* Animated car on map */}
          <Marker ref={markerRef} position={[lat, lng]} icon={buildCarIcon(course, "#2563eb", 52)} />
        </MapContainer>

        {/* ── Top bar (overlay) ── */}
        <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center gap-2 px-4 py-3
                        bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none">
          <div className="flex items-center gap-2.5 pointer-events-auto">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
              <Car size={16} className="text-white"/>
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-tight">{device?.name}</p>
              <p className="text-white/50 text-xs">{device?.uniqueId}</p>
            </div>
          </div>
          <div className="flex-1"/>
          <div className="pointer-events-auto"><TileSelector active={tileKey} onChange={setTileKey} dark /></div>
          <button onClick={onClose}
            className="pointer-events-auto p-2 bg-white/15 hover:bg-white/25 text-white rounded-xl backdrop-blur-sm transition-colors">
            <X size={18}/>
          </button>
        </div>

        {/* ── Speed bubble (center-bottom of map) ── */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border border-white/10"
               style={{background:"rgba(10,15,30,.78)", backdropFilter:"blur(12px)"}}>
            <div className="text-center">
              <p className="text-white text-4xl font-black tabular-nums leading-none">{speed}</p>
              <p className="text-white/60 text-xs mt-0.5">km/h</p>
            </div>
            <div className="w-px h-10 bg-white/15"/>
            <div className="text-center">
              <Navigation size={18} className="text-white/80 mx-auto mb-0.5"
                style={{transform:`rotate(${course}deg)`}}/>
              <p className="text-white/60 text-xs">{courseDir(course)}</p>
            </div>
            {lastUp && (
              <>
                <div className="w-px h-10 bg-white/15"/>
                <div className="text-center">
                  <p className="text-white text-sm font-bold tabular-nums">
                    {new Date(lastUp).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}
                  </p>
                  <p className="text-white/60 text-xs">atualizado</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom panel ── */}
      <div className="bg-white flex-shrink-0 rounded-t-3xl shadow-2xl"
           style={{paddingBottom:"max(1.25rem, env(safe-area-inset-bottom))"}}>
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3 mb-4"/>
        {/* Address */}
        <div className="flex items-start gap-3 px-5 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <MapPin size={17} className="text-blue-600"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400 font-medium mb-0.5">Localização atual</p>
            {addrLoad
              ? <div className="h-4 bg-slate-100 rounded animate-pulse w-4/5"/>
              : <p className="text-slate-900 text-sm font-medium leading-snug">{address}</p>}
            <p className="text-slate-400 text-xs mt-0.5 font-mono">{lat?.toFixed(6)}, {lng?.toFixed(6)}</p>
          </div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 px-5">
          {[
            { icon: Gauge,     label: "Velocidade", value: `${speed} km/h`, color: "blue" },
            { icon: Navigation,label: "Direção",    value: courseDir(course), color: "purple" },
            { icon: Clock,     label: "Sinal",
              value: lastUp ? new Date(lastUp).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) : "--",
              color: "green" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className={`flex flex-col items-center p-3 bg-${color}-50 rounded-2xl`}>
              <Icon size={16} className={`text-${color}-500 mb-1.5`}/>
              <p className={`text-base font-black text-${color}-700 tabular-nums`}>{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
        {/* Extra attributes */}
        {pos?.attributes && (
          <div className="flex flex-wrap gap-2 px-5 mt-3">
            {pos.attributes.ignition !== undefined && (
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${pos.attributes.ignition ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                Ignição {pos.attributes.ignition ? "ligada" : "desligada"}
              </span>
            )}
            {pos.attributes.motion !== undefined && (
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${pos.attributes.motion ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                {pos.attributes.motion ? "Em movimento" : "Parado"}
              </span>
            )}
            {pos.attributes.batteryLevel != null && (
              <span className="px-2.5 py-1 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-medium">
                Bateria {Math.round(pos.attributes.batteryLevel)}%
              </span>
            )}
            {pos.attributes.distance != null && (
              <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                {(pos.attributes.distance / 1000).toFixed(1)} km trip
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────
export default function DashboardPage() {
  const [devices,  setDevices]  = useState([]);
  const [positions,setPositions]= useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tileKey,  setTileKey]  = useState("osm");
  const [selectedId, setSelectedId] = useState(null);
  const [trackId,    setTrackId]    = useState(null);
  const [error,    setError]    = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");

  // Replay
  const [replayOpen,     setReplayOpen]     = useState(false);
  const [replayDevice,   setReplayDevice]   = useState("");
  const [replayDate,     setReplayDate]     = useState(new Date().toISOString().split("T")[0]);
  const [replayPts,      setReplayPts]      = useState([]);
  const [replayIdx,      setReplayIdx]      = useState(0);
  const [replayPlaying,  setReplayPlaying]  = useState(false);
  const [replayLoading,  setReplayLoading]  = useState(false);
  const replayRef = useRef(null);
  const [replaySpeed, setReplaySpeed] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([positionsAPI.list(), devicesAPI.list()]);
      setPositions(p.data || []);
      setDevices(d.data || []);
    } catch { setError("Erro ao carregar dados"); }
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
    if (!replayPlaying || !replayPts.length) return;
    replayRef.current = setInterval(() => {
      setReplayIdx(p => { if (p+1 >= replayPts.length) { setReplayPlaying(false); return p; } return p+1; });
    }, Math.max(100, 600 / replaySpeed));
    return () => clearInterval(replayRef.current);
  }, [replayPlaying, replayPts]);

  const loadReplay = async () => {
    if (!replayDevice || !replayDate) return;
    setReplayLoading(true); setError("");
    try {
      const r = await positionsAPI.history(replayDevice, `${replayDate}T00:00:00.000Z`, `${replayDate}T23:59:59.000Z`);
      const pts = (r.data || []).map(p => ({
        lat: p.latitude ?? p.lat, lng: p.longitude ?? p.lng,
        speed: (p.speed || 0) * 1.852, course: p.course || 0,
        time: p.fixTime || p.serverTime,
      })).filter(p => p.lat != null);
      if (!pts.length) { setError("Nenhuma posição para esta data"); return; }
      setReplayPts(pts); setReplayIdx(0); setReplayPlaying(false);
    } catch { setError("Erro ao carregar replay"); }
    finally { setReplayLoading(false); }
  };

  const onlineCount  = positions.length;
  const offlineCount = devices.length - onlineCount;
  const maxSpeed     = positions.length ? Math.round(Math.max(...positions.map(p => p.speed||0))) : 0;
  const tile         = TILES[tileKey];
  const replayCur    = replayPts[replayIdx];
  const trackDev     = trackId ? devices.find(d => d.id === trackId) : null;
  const trackPos     = trackId ? positions.find(p => p.deviceId === trackId) : null;

  return (
    <>
      {/* ── FULLSCREEN TRACKER ── */}
      {trackId && (
        <FullscreenTracker
          device={trackDev}
          deviceId={trackId}
          initialPos={trackPos}
          onClose={() => setTrackId(null)}
        />
      )}

      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900" style={{fontFamily:"Space Grotesk,sans-serif"}}>Dashboard</h1>
            <p className="text-slate-400 text-xs mt-0.5">Atualiza a cada 10s</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchData} className="btn-ghost"><RefreshCw size={15}/></button>
            <button onClick={() => { setReplayOpen(true); setReplayPts([]); }} className="btn-primary">
              <Route size={15}/>Replay
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label:"Total",       value: devices.length,  sub:"veículos",   icon: Car,    color:"blue"   },
            { label:"Online",      value: onlineCount,     sub:"com posição", icon: Signal, color:"green"  },
            { label:"Offline",     value: offlineCount,    sub:"sem sinal",   icon: Radio,  color:"slate"  },
            { label:"Vel. máxima", value: `${maxSpeed}`,   sub:"km/h agora",  icon: Gauge,  color:"purple" },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400 font-medium">{label}</p>
                <div className={`p-2 rounded-lg bg-${color}-50`}><Icon size={14} className={`text-${color}-500`}/></div>
              </div>
              <p className="text-2xl font-black text-slate-900 tabular-nums">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <AlertCircle size={15}/>{error}
            <button onClick={() => setError("")} className="ml-auto"><X size={14}/></button>
          </div>
        )}

        {/* Map + list */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Map card */}
          <div className="xl:col-span-2 card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-blue-500"/>
                <span className="text-sm font-semibold text-slate-700">Mapa ao vivo</span>
                <span className="text-xs text-slate-400">({onlineCount} online)</span>
              </div>
              <TileSelector active={tileKey} onChange={setTileKey}/>
            </div>

            <div className="relative overflow-hidden rounded-b-2xl" style={{height:"440px"}}>
              {loading ? (
                <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"/>
                </div>
              ) : (
                <MapContainer center={[-15.788,-47.879]} zoom={5} style={{height:"100%",width:"100%"}}>
                  <TileLayer key={tileKey} url={tile.url} subdomains={tile.sub} attribution={tile.attr} maxZoom={20}/>
                  <FitBoundsButton positions={positions} />

                  {/* Selected vehicle fly-to */}
                  {selectedId && (() => {
                    const p = positions.find(p => p.deviceId === selectedId);
                    const lat = p?.lat ?? p?.latitude;
                    const lng = p?.lng ?? p?.longitude;
                    return lat != null ? <MapFollow lat={lat} lng={lng}/> : null;
                  })()}

                  {/* Replay path */}
                  {replayOpen && replayPts.length > 0 && (
                    <>
                      <Polyline positions={replayPts.map(p => [p.lat,p.lng])}
                        pathOptions={{color:"#8b5cf6",weight:4,opacity:.7}}/>
                      {replayCur && (
                        <Marker position={[replayCur.lat,replayCur.lng]} icon={buildReplayIcon()}>
                          <Popup>
                            <p className="font-bold">{replayCur.speed?.toFixed(0)} km/h</p>
                            <p className="text-xs text-slate-500">{replayCur.time ? new Date(replayCur.time).toLocaleString("pt-BR") : ""}</p>
                          </Popup>
                        </Marker>
                      )}
                    </>
                  )}

                  {/* Live vehicles with smooth animation */}
                  {!replayOpen && positions.map(pos => {
                    const lat = pos.lat ?? pos.latitude;
                    const lng = pos.lng ?? pos.longitude;
                    if (lat == null || lng == null) return null;
                    const dev = devices.find(d => d.id === pos.deviceId);
                    const spd = Math.round(pos.speed || 0);
                    const isSel = selectedId === pos.deviceId;
                    return (
                      <AnimatedCarMarker
                        key={pos.deviceId}
                        lat={lat} lng={lng}
                        course={pos.course || 0}
                        color={isSel ? "#1d4ed8" : "#2563eb"}
                        selected={isSel}
                        onClick={() => setSelectedId(pos.deviceId === selectedId ? null : pos.deviceId)}
                      >
                        <Popup>
                          <div className="min-w-[190px]">
                            <p className="font-bold text-slate-900 text-sm mb-2">{dev?.name || `#${pos.deviceId}`}</p>
                            <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                              <div className="flex justify-between">
                                <span>Velocidade</span>
                                <span className="font-bold text-slate-900">{spd} km/h</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Direção</span>
                                <span className="font-bold text-slate-900">{courseDir(pos.course)}</span>
                              </div>
                              {pos.fixTime && (
                                <div className="flex justify-between">
                                  <span>Atualizado</span>
                                  <span className="font-bold text-slate-900">{new Date(pos.fixTime).toLocaleTimeString("pt-BR")}</span>
                                </div>
                              )}
                            </div>
                            <button onClick={() => setTrackId(pos.deviceId)}
                              className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors">
                              <Maximize2 size={13}/>Rastrear em tela cheia
                            </button>
                          </div>
                        </Popup>
                      </AnimatedCarMarker>
                    );
                  })}
                </MapContainer>
              )}
            </div>

            {/* Replay controls */}
            {replayOpen && (
              <div className="border-t border-slate-100 bg-purple-50/60 px-4 py-3">
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
                    <input type="date" className="input py-2 text-xs" value={replayDate} onChange={e => setReplayDate(e.target.value)}/>
                  </div>
                  <button onClick={loadReplay} disabled={!replayDevice||replayLoading} className="btn-primary py-2 text-xs">
                    {replayLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : "Carregar"}
                  </button>
                  {replayPts.length > 0 && (
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <button onClick={() => { if(replayIdx>=replayPts.length-1) setReplayIdx(0); setReplayPlaying(p=>!p); }}
                        className="p-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 flex-shrink-0">
                        {replayPlaying ? <Pause size={15}/> : <Play size={15}/>}
                      </button>
                      <button onClick={() => { setReplayIdx(0); setReplayPlaying(false); }}
                        className="p-2 bg-slate-200 text-slate-600 rounded-xl flex-shrink-0">
                        <RotateCcw size={15}/>
                      </button>
                      <div className="flex items-center gap-1">
                        {[1,2,5,10].map(s => (
                          <button key={s} onClick={() => setReplaySpeed(s)}
                            className={"px-2 py-1 rounded-lg text-xs font-bold transition-colors " + (replaySpeed === s ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}>
                            {s}x
                          </button>
                        ))}
                      </div>
                      <div className="flex-1 min-w-0">
                        <input type="range" min={0} max={replayPts.length-1} value={replayIdx}
                          onChange={e => { setReplayIdx(Number(e.target.value)); setReplayPlaying(false); }}
                          className="w-full accent-purple-600"/>
                        <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                          <span>{replayCur?.time ? new Date(replayCur.time).toLocaleTimeString("pt-BR") : "--"}</span>
                          <span className="text-purple-700 font-semibold">{replayCur?.speed?.toFixed(0)} km/h</span>
                          <span>{replayIdx+1}/{replayPts.length}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <button onClick={() => { setReplayOpen(false); setReplayPts([]); setReplayPlaying(false); }}
                    className="btn-ghost text-xs py-2">Fechar</button>
                </div>
              </div>
            )}
          </div>

          {/* Vehicle list */}
          <div className="card flex flex-col" style={{maxHeight:"540px"}}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0">
              <span className="text-sm font-semibold text-slate-700">Veículos</span>
              <span className="text-xs text-slate-400">{devices.length} total</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {loading && !devices.length ? (
                <div className="p-8 text-center"><div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto"/></div>
              ) : devices.length === 0 ? (
                <div className="p-8 text-center"><Car size={32} className="mx-auto text-slate-300 mb-2"/><p className="text-slate-400 text-sm">Nenhum veículo</p></div>
              ) : (
                devices.filter(d => !vehicleSearch || d.name?.toLowerCase().includes(vehicleSearch.toLowerCase()) || d.uniqueId?.includes(vehicleSearch)).map(dev => {
                  const pos = positions.find(p => p.deviceId === dev.id);
                  const isOnline = !!pos;
                  const isSel = selectedId === dev.id;
                  const spd = pos ? Math.round(pos.speed||0) : 0;
                  return (
                    <div key={dev.id} onClick={() => setSelectedId(isSel ? null : dev.id)}
                      className={`px-4 py-3 cursor-pointer transition-all border-l-2 ${isSel ? "bg-blue-50 border-blue-500" : "hover:bg-slate-50 border-transparent"}`}>
                      <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? "bg-green-50" : "bg-slate-100"}`}>
                            <Car size={18} className={isOnline ? "text-green-600" : "text-slate-400"}/>
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isOnline ? "bg-green-500" : "bg-slate-300"}`}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isSel ? "text-blue-700" : "text-slate-800"}`}>{dev.name}</p>
                          <p className="text-xs text-slate-400 font-mono truncate">{dev.uniqueId}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isOnline && <span className="text-sm font-bold text-slate-700 tabular-nums">{spd}<span className="text-xs font-normal text-slate-400"> km/h</span></span>}
                          <button onClick={e => { e.stopPropagation(); if(isOnline) setTrackId(dev.id); }}
                            title={isOnline ? "Rastrear em tela cheia" : "Veículo offline"}
                            className={`p-1.5 rounded-lg transition-colors ml-1 ${isOnline ? "text-blue-500 hover:bg-blue-50 hover:text-blue-700" : "text-slate-300 cursor-not-allowed"}`}>
                            <Maximize2 size={14}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex-shrink-0">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Online ({onlineCount})</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block"/>Offline ({offlineCount})</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
