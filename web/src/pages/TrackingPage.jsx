import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { positionsAPI, devicesAPI } from "../services/api";
import {
  Car, MapPin, Search, X, ChevronRight, ChevronLeft, Wifi, WifiOff,
  Gauge, Navigation, Clock, Maximize2, Minimize2, Layers, Satellite, Map as MapIcon,
  Eye, EyeOff, Radio, Signal, Battery, Zap, AlertTriangle, BarChart2,
  Target, Crosshair, Route, Filter, ArrowUpDown, RefreshCw, Settings,
  Thermometer, MapPinOff, Activity, Power, Move, Square, Grid2x2, PanelLeft, Expand, Shrink
} from "lucide-react";

// ========== TILES ==========
const TILES = {
  osm:       { label: "OpenStreetMap", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", sub: "abc", attr: "OSM" },
  google:    { label: "Google Maps",   url: "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", sub: "0123", attr: "Google" },
  hybrid:    { label: "Hibrido",       url: "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", sub: "0123", attr: "Google" },
  satellite: { label: "Satelite",      url: "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", sub: "0123", attr: "Google" },
};

// ========== CAR ICON ==========
function buildCarIcon(course = 0, color = "#2563eb", size = 40) {
  const h = Math.round(size * 1.5);
  const w = size;
  return L.divIcon({
    className: "",
    html: `<div style="width:${w}px;height:${h}px;transform:rotate(${course}deg);will-change:transform;filter:drop-shadow(0 3px 8px rgba(0,0,0,.35));">
      <svg viewBox="0 0 44 66" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <polygon points="22,0 17,9 27,9" fill="white" opacity=".9"/>
        <rect x="3" y="8" width="38" height="50" rx="13" fill="${color}"/>
        <rect x="8" y="4" width="28" height="9" rx="5" fill="${color}"/>
        <rect x="10" y="56" width="24" height="8" rx="5" fill="${color}" opacity=".8"/>
        <rect x="9" y="13" width="26" height="15" rx="5" fill="rgba(200,230,255,.92)"/>
        <rect x="12" y="29" width="20" height="14" rx="4" fill="${color}" opacity=".85"/>
        <rect x="11" y="44" width="22" height="11" rx="4" fill="rgba(200,230,255,.65)"/>
        <rect x="7" y="3" width="10" height="5" rx="2.5" fill="#fef08a"/>
        <rect x="27" y="3" width="10" height="5" rx="2.5" fill="#fef08a"/>
        <rect x="7" y="58" width="10" height="5" rx="2.5" fill="#fca5a5"/>
        <rect x="27" y="58" width="10" height="5" rx="2.5" fill="#fca5a5"/>
        <rect x="0" y="14" width="5" height="10" rx="2" fill="#1e293b"/>
        <rect x="39" y="14" width="5" height="10" rx="2" fill="#1e293b"/>
        <rect x="0" y="44" width="5" height="10" rx="2" fill="#1e293b"/>
        <rect x="39" y="44" width="5" height="10" rx="2" fill="#1e293b"/>
      </svg>
    </div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });
}

// ========== HELPERS ==========
const DIRS = ["N","NE","L","SE","S","SO","O","NO"];
const courseDir = c => DIRS[Math.round((c || 0) / 45) % 8];

const geocodeCache = {};
async function reverseGeocode(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache[key]) return geocodeCache[key];
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=pt`, { headers: { "User-Agent": "HSQPortal/3.0" } });
    const d = await r.json();
    const a = d.address || {};
    const parts = [a.road, a.house_number, a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean);
    const result = parts.join(", ") || d.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    geocodeCache[key] = result;
    return result;
  } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
}

function timeAgo(dateStr) {
  if (!dateStr) return "--";
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

// ========== MAP COMPONENTS ==========
function MapFollow({ lat, lng, follow }) {
  const map = useMap();
  const prev = useRef(null);
  useEffect(() => {
    if (!follow || lat == null || lng == null) return;
    if (!prev.current) map.setView([lat, lng], 17, { animate: false });
    else map.panTo([lat, lng], { animate: true, duration: 1.5 });
    prev.current = [lat, lng];
  }, [lat?.toFixed(5), lng?.toFixed(5), follow]);
  return null;
}

function FitAllBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    const pts = positions.filter(p => p.lat != null).map(p => [p.lat, p.lng]);
    if (pts.length > 1) map.fitBounds(pts, { padding: [50, 50], maxZoom: 14 });
    else if (pts.length === 1) map.setView(pts[0], 14);
  }, []);
  return null;
}

function AnimatedMarker({ lat, lng, course, color, size, selected, onClick, children }) {
  const ref = useRef(null);
  const animRef = useRef(null);
  const fromRef = useRef(null);
  const icon = buildCarIcon(course || 0, color, size || 40);

  useEffect(() => {
    if (!ref.current || lat == null) return;
    const to = [lat, lng];
    const from = fromRef.current || to;
    fromRef.current = to;
    if (Math.abs(from[0] - to[0]) < 0.000005 && Math.abs(from[1] - to[1]) < 0.000005) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const t0 = performance.now();
    const dur = 4000;
    const tick = now => {
      const t = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - t, 3);
      ref.current?.setLatLng([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]);
      if (t < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [lat, lng]);

  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current); }, []);
  if (lat == null) return null;
  return <Marker ref={ref} position={[lat, lng]} icon={icon} eventHandlers={{ click: onClick }}>{children}</Marker>;
}

// ========== VEHICLE SIDEBAR ==========
function VehicleSidebar({ vehicles, selectedId, onSelect, collapsed, onToggle }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return vehicles.filter(v => {
      const matchSearch = !search || v.device.name?.toLowerCase().includes(search.toLowerCase()) || v.device.uniqueId?.includes(search);
      const matchFilter = filter === "all" ||
        (filter === "online" && v.position) ||
        (filter === "offline" && !v.position) ||
        (filter === "moving" && v.position && v.position.speed > 2) ||
        (filter === "stopped" && v.position && v.position.speed <= 2);
      return matchSearch && matchFilter;
    });
  }, [vehicles, search, filter]);

  const counts = useMemo(() => ({
    all: vehicles.length,
    online: vehicles.filter(v => v.position).length,
    offline: vehicles.filter(v => !v.position).length,
    moving: vehicles.filter(v => v.position && v.position.speed > 2).length,
    stopped: vehicles.filter(v => v.position && v.position.speed <= 2).length,
  }), [vehicles]);

  if (collapsed) {
    return (
      <div className="w-12 bg-white border-r border-slate-200 flex flex-col items-center py-3 gap-2 flex-shrink-0">
        <button onClick={onToggle} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500" title="Expandir painel">
          <ChevronRight size={16} />
        </button>
        <div className="w-8 h-px bg-slate-200 my-1" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-green-600">{counts.online}</span>
          <span className="text-[10px] text-slate-400">ON</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-slate-400">{counts.offline}</span>
          <span className="text-[10px] text-slate-400">OFF</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Veiculos</h2>
          <p className="text-xs text-slate-400">{counts.online} online de {counts.all}</p>
        </div>
        <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 lg:block hidden">
          <PanelLeft size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-slate-50 flex-shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs placeholder-slate-400 focus:border-blue-300 focus:bg-white outline-none transition-colors"
            placeholder="Buscar veiculo..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X size={12}/></button>}
        </div>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 flex gap-1 flex-wrap border-b border-slate-50 flex-shrink-0">
        {[
          { key: "all", label: "Todos", count: counts.all },
          { key: "online", label: "Online", count: counts.online },
          { key: "moving", label: "Movendo", count: counts.moving },
          { key: "stopped", label: "Parados", count: counts.stopped },
          { key: "offline", label: "Offline", count: counts.offline },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${filter === f.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Vehicle List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Car size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-400 text-xs">Nenhum veiculo encontrado</p>
          </div>
        ) : filtered.map(v => {
          const pos = v.position;
          const isOnline = !!pos;
          const isMoving = pos && pos.speed > 2;
          const isSel = selectedId === v.device.id;
          const speed = pos ? Math.round(pos.speed || 0) : 0;
          const hasAlert = pos?.attributes?.batteryLevel != null && pos.attributes.batteryLevel < 20;

          return (
            <div key={v.device.id} onClick={() => onSelect(v.device.id)}
              className={`px-3 py-2.5 cursor-pointer transition-all border-l-3 ${
                isSel ? "bg-blue-50 border-l-blue-600" : "hover:bg-slate-50 border-l-transparent"
              }`}>
              <div className="flex items-center gap-2.5">
                <div className="relative flex-shrink-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    isMoving ? "bg-green-50" : isOnline ? "bg-blue-50" : "bg-slate-100"
                  }`}>
                    <Car size={16} className={isMoving ? "text-green-600" : isOnline ? "text-blue-600" : "text-slate-400"} />
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                    isMoving ? "bg-green-500" : isOnline ? "bg-blue-500" : "bg-slate-300"
                  }`} />
                  {hasAlert && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isSel ? "text-blue-700" : "text-slate-800"}`}>{v.device.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isOnline ? (
                      <>
                        <span className={`text-[10px] font-bold ${isMoving ? "text-green-600" : "text-blue-600"}`}>
                          {speed} km/h
                        </span>
                        <span className="text-[10px] text-slate-400">{courseDir(pos.course)}</span>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-400">Offline</span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-slate-400">{timeAgo(pos?.fixTime || v.device.lastUpdate)}</p>
                  {isMoving && (
                    <div className="flex items-center gap-0.5 mt-0.5 justify-end">
                      <Move size={9} className="text-green-500" />
                      <span className="text-[9px] text-green-600 font-medium">Em rota</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ========== VEHICLE DETAIL DRAWER ==========
function VehicleDrawer({ vehicle, onClose }) {
  const [address, setAddress] = useState("Buscando...");
  const [trail, setTrail] = useState([]);
  const [trailHours, setTrailHours] = useState(0);
  const pos = vehicle?.position;
  const dev = vehicle?.device;
  const lat = pos?.lat;
  const lng = pos?.lng;
  const speed = pos ? Math.round(pos.speed || 0) : 0;
  const course = pos?.course || 0;

  useEffect(() => {
    if (lat != null) reverseGeocode(lat, lng).then(setAddress);
  }, [lat?.toFixed(4), lng?.toFixed(4)]);

  const loadTrail = async (hours) => {
    if (!dev) return;
    setTrailHours(hours);
    if (hours === 0) { setTrail([]); return; }
    try {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - hours * 3600000).toISOString();
      const r = await positionsAPI.history(dev.id, from, to);
      setTrail((r.data || []).map(p => ({ lat: p.latitude ?? p.lat, lng: p.longitude ?? p.lng, speed: p.speed, time: p.fixTime })).filter(p => p.lat != null));
    } catch { setTrail([]); }
  };

  if (!vehicle) return null;

  return (
    <div className="w-96 bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0 overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${pos ? "bg-blue-600" : "bg-slate-400"}`}>
            <Car size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{dev.name}</h3>
            <p className="text-xs text-slate-400 font-mono">{dev.uniqueId}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!pos ? (
          <div className="p-8 text-center">
            <WifiOff size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">Veiculo sem sinal</p>
            <p className="text-slate-400 text-xs mt-1">Ultima vez visto: {timeAgo(dev.lastUpdate)}</p>
          </div>
        ) : (
          <>
            {/* Speed Hero */}
            <div className="px-5 py-5 bg-gradient-to-b from-slate-50 to-white">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <p className="text-5xl font-black text-slate-900 tabular-nums leading-none">{speed}</p>
                  <p className="text-xs text-slate-400 mt-1">km/h</p>
                </div>
                <div className="w-px h-16 bg-slate-200" />
                <div className="text-center">
                  <Navigation size={28} className="text-blue-500 mx-auto mb-1" style={{ transform: `rotate(${course}deg)` }} />
                  <p className="text-sm font-bold text-slate-700">{courseDir(course)}</p>
                  <p className="text-[10px] text-slate-400">{course.toFixed(0)}deg</p>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="px-5 py-3 border-t border-slate-100">
              <div className="flex items-start gap-2.5">
                <MapPin size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Localizacao</p>
                  <p className="text-sm text-slate-800 leading-snug mt-0.5">{address}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{lat?.toFixed(6)}, {lng?.toFixed(6)}</p>
                </div>
              </div>
            </div>

            {/* Telemetry Grid */}
            <div className="px-5 py-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Telemetria</p>
              <div className="grid grid-cols-2 gap-2">
                {pos.attributes?.ignition !== undefined && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${pos.attributes.ignition ? "bg-green-50" : "bg-slate-50"}`}>
                    <Power size={13} className={pos.attributes.ignition ? "text-green-600" : "text-slate-400"} />
                    <div>
                      <p className="text-[10px] text-slate-400">Ignicao</p>
                      <p className={`text-xs font-semibold ${pos.attributes.ignition ? "text-green-700" : "text-slate-500"}`}>
                        {pos.attributes.ignition ? "Ligada" : "Desligada"}
                      </p>
                    </div>
                  </div>
                )}
                {pos.attributes?.motion !== undefined && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${pos.attributes.motion ? "bg-blue-50" : "bg-slate-50"}`}>
                    <Move size={13} className={pos.attributes.motion ? "text-blue-600" : "text-slate-400"} />
                    <div>
                      <p className="text-[10px] text-slate-400">Movimento</p>
                      <p className={`text-xs font-semibold ${pos.attributes.motion ? "text-blue-700" : "text-slate-500"}`}>
                        {pos.attributes.motion ? "Sim" : "Nao"}
                      </p>
                    </div>
                  </div>
                )}
                {pos.attributes?.batteryLevel != null && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${pos.attributes.batteryLevel < 20 ? "bg-red-50" : "bg-green-50"}`}>
                    <Battery size={13} className={pos.attributes.batteryLevel < 20 ? "text-red-500" : "text-green-600"} />
                    <div>
                      <p className="text-[10px] text-slate-400">Bateria</p>
                      <p className={`text-xs font-semibold ${pos.attributes.batteryLevel < 20 ? "text-red-700" : "text-green-700"}`}>
                        {Math.round(pos.attributes.batteryLevel)}%
                      </p>
                    </div>
                  </div>
                )}
                {pos.attributes?.totalDistance != null && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50">
                    <Route size={13} className="text-purple-600" />
                    <div>
                      <p className="text-[10px] text-slate-400">Odometro</p>
                      <p className="text-xs font-semibold text-purple-700">{(pos.attributes.totalDistance / 1000).toFixed(0)} km</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50">
                  <Clock size={13} className="text-slate-500" />
                  <div>
                    <p className="text-[10px] text-slate-400">Atualizado</p>
                    <p className="text-xs font-semibold text-slate-700">{timeAgo(pos.fixTime || pos.timestamp)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50">
                  <Signal size={13} className="text-slate-500" />
                  <div>
                    <p className="text-[10px] text-slate-400">Status</p>
                    <p className="text-xs font-semibold text-green-700">{dev.status || "online"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trail Controls */}
            <div className="px-5 py-3 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Rastro / Historico</p>
              <div className="flex gap-1.5">
                {[
                  { h: 0, label: "Desligado" },
                  { h: 1, label: "1h" },
                  { h: 6, label: "6h" },
                  { h: 24, label: "24h" },
                ].map(t => (
                  <button key={t.h} onClick={() => loadTrail(t.h)}
                    className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg transition-colors ${
                      trailHours === t.h ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}>{t.label}</button>
                ))}
              </div>
              {trail.length > 0 && (
                <p className="text-[10px] text-slate-400 mt-1.5">{trail.length} pontos no rastro</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Return trail data for parent to render on map */}
      {vehicle._setTrail && vehicle._setTrail(trail)}
    </div>
  );
}

// ========== STATUS BAR ==========
function StatusBar({ vehicles, lastRefresh }) {
  const online = vehicles.filter(v => v.position).length;
  const moving = vehicles.filter(v => v.position && v.position.speed > 2).length;
  const alerts = vehicles.filter(v => v.position?.attributes?.batteryLevel != null && v.position.attributes.batteryLevel < 20).length;

  return (
    <div className="h-9 bg-slate-900 flex items-center px-4 gap-5 flex-shrink-0 text-[11px]">
      <div className="flex items-center gap-1.5">
        <Car size={11} className="text-slate-400" />
        <span className="text-slate-300 font-medium">{vehicles.length} veiculos</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
        <span className="text-green-400 font-medium">{online} online</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Move size={10} className="text-blue-400" />
        <span className="text-blue-400 font-medium">{moving} movendo</span>
      </div>
      {alerts > 0 && (
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={10} className="text-red-400" />
          <span className="text-red-400 font-medium">{alerts} alertas</span>
        </div>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-1.5">
        <RefreshCw size={10} className="text-slate-500" />
        <span className="text-slate-500">{lastRefresh ? new Date(lastRefresh).toLocaleTimeString("pt-BR") : "--"}</span>
      </div>
    </div>
  );
}

// ========== MAP CONTROLS ==========
function MapToolbar({ tileKey, setTileKey, followMode, setFollowMode, onFitAll, splitMode, setSplitMode, onFullscreen, isFullscreen }) {
  const [tileOpen, setTileOpen] = useState(false);
  return (
    <>
      {/* Tile selector - TOP RIGHT */}
      <div className="absolute top-3 right-3 z-[1000]">
        <div className="relative">
          <button onClick={() => setTileOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg text-xs font-medium text-slate-700 hover:bg-white transition-colors">
            <Layers size={13} />{TILES[tileKey].label}
          </button>
          {tileOpen && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl min-w-[150px] overflow-hidden z-[9999]">
              {Object.entries(TILES).map(([k, t]) => (
                <button key={k} onClick={() => { setTileKey(k); setTileOpen(false); }}
                  className={"w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left transition-colors " + (tileKey === k ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50")}>
                  {k === "satellite" || k === "hybrid" ? <Satellite size={12}/> : <MapIcon size={12}/>}
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Action buttons - BOTTOM RIGHT */}
      <div className="absolute bottom-5 right-3 z-[1000] flex flex-col gap-1.5">
        <button onClick={onFullscreen} title={isFullscreen ? "Sair tela cheia" : "Tela cheia"}
          className="p-2.5 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg text-slate-600 hover:text-blue-600 hover:bg-white transition-colors">
          {isFullscreen ? <Shrink size={15} /> : <Expand size={15} />}
        </button>
        <button onClick={onFitAll} title="Ver todos"
          className="p-2.5 bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg text-slate-600 hover:text-blue-600 hover:bg-white transition-colors">
          <Maximize2 size={15} />
        </button>
        <button onClick={() => setFollowMode(f => !f)} title={followMode ? "Parar seguir" : "Seguir veiculo"}
          className={"p-2.5 backdrop-blur border rounded-xl shadow-lg transition-colors " + (followMode ? "bg-blue-600 border-blue-600 text-white" : "bg-white/95 border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-white")}>
          <Crosshair size={15} />
        </button>
        <div className="hidden lg:flex flex-col gap-1.5">
          <button onClick={() => setSplitMode(1)} title="Mapa unico"
            className={"p-2.5 backdrop-blur border rounded-xl shadow-lg transition-colors " + (splitMode === 1 ? "bg-blue-600 border-blue-600 text-white" : "bg-white/95 border-slate-200 text-slate-600 hover:bg-white")}>
            <Square size={15} />
          </button>
          <button onClick={() => setSplitMode(2)} title="2 mapas"
            className={"p-2.5 backdrop-blur border rounded-xl shadow-lg transition-colors " + (splitMode === 2 ? "bg-blue-600 border-blue-600 text-white" : "bg-white/95 border-slate-200 text-slate-600 hover:bg-white")}>
            <Grid2x2 size={15} />
          </button>
        </div>
      </div>
    </>
  );
}

// ========== SINGLE MAP PANEL ==========
function TrackingMapPanel({ vehicles, selectedId, tileKey, followMode, trail, fitTrigger, label }) {
  const tile = TILES[tileKey];
  const selVehicle = vehicles.find(v => v.device.id === selectedId);
  const selPos = selVehicle?.position;

  return (
    <div className="relative w-full h-full">
      {label && (
        <div className="absolute top-3 left-3 z-[1000] px-3 py-1.5 bg-white/90 backdrop-blur border border-slate-200 rounded-lg shadow text-xs font-semibold text-slate-700">
          {label}
        </div>
      )}
      <MapContainer center={[-15.788, -47.879]} zoom={5} style={{ height: "100%", width: "100%" }}
        zoomControl={false} attributionControl={false}>
        <TileLayer key={tileKey} url={tile.url} subdomains={tile.sub} maxZoom={20} />

        {fitTrigger > 0 && <FitAllBounds positions={vehicles.filter(v => v.position).map(v => v.position)} />}

        {selPos && <MapFollow lat={selPos.lat} lng={selPos.lng} follow={followMode} />}

        {/* Trail polyline */}
        {trail.length > 1 && (
          <Polyline positions={trail.map(p => [p.lat, p.lng])} pathOptions={{ color: "#8b5cf6", weight: 3, opacity: 0.7, dashArray: "6 4" }} />
        )}

        {/* All vehicle markers */}
        {vehicles.map(v => {
          const p = v.position;
          if (!p || p.lat == null) return null;
          const isMoving = p.speed > 2;
          const isSel = selectedId === v.device.id;
          const color = isSel ? "#1d4ed8" : isMoving ? "#16a34a" : "#64748b";
          return (
            <AnimatedMarker key={v.device.id} lat={p.lat} lng={p.lng} course={p.course || 0}
              color={color} size={isSel ? 46 : 36} selected={isSel}
              onClick={() => {}}>
              <Popup>
                <div className="min-w-[170px]">
                  <p className="font-bold text-slate-900 text-sm">{v.device.name}</p>
                  <div className="mt-1.5 space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between"><span>Velocidade</span><strong>{Math.round(p.speed || 0)} km/h</strong></div>
                    <div className="flex justify-between"><span>Direcao</span><strong>{courseDir(p.course)}</strong></div>
                    <div className="flex justify-between"><span>Atualizado</span><strong>{timeAgo(p.fixTime)}</strong></div>
                  </div>
                </div>
              </Popup>
            </AnimatedMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

// ========== MAIN TRACKING PAGE ==========
export default function TrackingPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedId2, setSelectedId2] = useState(null);
  const [tileKey, setTileKey] = useState("google");
  const [followMode, setFollowMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [splitMode, setSplitMode] = useState(1);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [trail, setTrail] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveAddress, setLiveAddress] = useState("");
  const [liveKm, setLiveKm] = useState(0);
  const mapContainerRef = useRef(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [posRes, devRes] = await Promise.all([positionsAPI.list(), devicesAPI.list()]);
      const positions = posRes.data || [];
      const devices = devRes.data || [];
      const posMap = {};
      positions.forEach(p => { posMap[p.deviceId] = p; });
      const merged = devices.map(d => ({
        device: d,
        position: posMap[d.id] || null,
      }));
      setVehicles(merged);
      setLastRefresh(new Date());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, []);

  const handleSelect = (id) => {
    if (splitMode === 2 && selectedId && selectedId !== id) {
      setSelectedId2(id);
    } else {
      setSelectedId(id);
      setSelectedId2(null);
    }
    setShowDrawer(true);
    setFollowMode(true);
  };

  const selectedVehicle = vehicles.find(v => v.device.id === selectedId);

  useEffect(() => {
    const sv = vehicles.find(v => v.device.id === selectedId);
    const p = sv?.position;
    if (p && p.lat != null) {
      reverseGeocode(p.lat, p.lng).then(setLiveAddress);
      if (p.attributes?.totalDistance != null) setLiveKm(p.attributes.totalDistance / 1000);
    }
  }, [selectedId, vehicles]);

  // Mobile sidebar toggle
  const [mobileSidebar, setMobileSidebar] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] bg-slate-50">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Carregando rastreamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-slate-100 overflow-hidden -m-4 sm:-m-5 lg:-m-6">
      {/* Mobile sidebar toggle */}
      <button onClick={() => setMobileSidebar(true)}
        className="lg:hidden fixed bottom-14 left-3 z-[2000] p-3 bg-white border border-slate-200 rounded-xl shadow-lg text-slate-700">
        <Car size={18} />
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
          {vehicles.filter(v => v.position).length}
        </span>
      </button>

      {/* Mobile sidebar overlay */}
      {mobileSidebar && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[2000] lg:hidden" onClick={() => setMobileSidebar(false)} />
          <div className="fixed inset-y-0 left-0 z-[2001] w-80 lg:hidden">
            <VehicleSidebar vehicles={vehicles} selectedId={selectedId} onSelect={id => { handleSelect(id); setMobileSidebar(false); }} collapsed={false} onToggle={() => setMobileSidebar(false)} />
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <VehicleSidebar vehicles={vehicles} selectedId={selectedId} onSelect={handleSelect}
          collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      </div>

      {/* Map area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Map */}
        <div ref={mapContainerRef} className="flex-1 relative bg-slate-900">
          {splitMode === 1 ? (
            <TrackingMapPanel vehicles={vehicles} selectedId={selectedId} tileKey={tileKey}
              followMode={followMode} trail={trail} fitTrigger={fitTrigger} />
          ) : (
            <div className="grid grid-cols-2 h-full gap-px bg-slate-300">
              <TrackingMapPanel vehicles={vehicles} selectedId={selectedId} tileKey={tileKey}
                followMode={followMode} trail={trail} fitTrigger={fitTrigger}
                label={vehicles.find(v => v.device.id === selectedId)?.device.name || "Selecione"} />
              <TrackingMapPanel vehicles={vehicles} selectedId={selectedId2} tileKey={tileKey}
                followMode={followMode} trail={[]} fitTrigger={fitTrigger}
                label={vehicles.find(v => v.device.id === selectedId2)?.device.name || "Selecione"} />
            </div>
          )}

          {/* Live info panel */}
          {selectedId && selectedVehicle?.position && (
            <div className="absolute bottom-5 left-3 z-[1000] max-w-[340px]">
              <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-xl shadow-lg px-4 py-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <Car size={12} className="text-white" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 truncate">{selectedVehicle.device.name}</p>
                  <span className="text-xs font-bold text-blue-600 tabular-nums ml-auto">{Math.round(selectedVehicle.position.speed || 0)} km/h</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin size={12} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-slate-600 leading-snug">{liveAddress || "Buscando endereco..."}</p>
                </div>
                {liveKm > 0 && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Route size={11} className="text-purple-500" />
                    <span className="text-[11px] text-slate-500">Odometro: <strong className="text-slate-700">{liveKm.toFixed(1)} km</strong></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Map toolbar */}
          <MapToolbar tileKey={tileKey} setTileKey={setTileKey} followMode={followMode} setFollowMode={setFollowMode}
            onFitAll={() => setFitTrigger(t => t + 1)} splitMode={splitMode} setSplitMode={setSplitMode}
            onFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />
        </div>

        {/* Status bar */}
        <StatusBar vehicles={vehicles} lastRefresh={lastRefresh} />
      </div>

      {/* Detail drawer - desktop */}
      {showDrawer && selectedVehicle && (
        <div className="hidden lg:flex">
          <VehicleDrawer vehicle={{ ...selectedVehicle, _setTrail: setTrail }}
            onClose={() => { setShowDrawer(false); setTrail([]); }} />
        </div>
      )}

      {/* Detail drawer - mobile (bottom sheet) */}
      {showDrawer && selectedVehicle && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-[2000] max-h-[65vh] bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 overflow-y-auto animate-slide-up">
          <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mt-2 mb-1" />
          <VehicleDrawer vehicle={{ ...selectedVehicle, _setTrail: setTrail }}
            onClose={() => { setShowDrawer(false); setTrail([]); }} />
        </div>
      )}
    </div>
  );
}
