import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";
import { MapPin, Plus, Edit2, Trash2, Search, RefreshCw, Map, List, Circle, Square } from "lucide-react";
import { MapContainer, TileLayer, Polygon, Circle as LeafletCircle, Popup, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function parseArea(area) {
  if (!area) return null;
  if (area.startsWith("CIRCLE")) {
    const match = area.match(/CIRCLE\s*\(([^,]+),([^,]+),([^)]+)\)/);
    if (match) return { type: "circle", lat: parseFloat(match[1]), lng: parseFloat(match[2]), radius: parseFloat(match[3]) };
  }
  if (area.startsWith("POLYGON")) {
    const match = area.match(/POLYGON\s*\(\(([^)]+)\)\)/);
    if (match) {
      const coords = match[1].split(",").map(p => {
        const parts = p.trim().split(/\s+/);
        return [parseFloat(parts[1]), parseFloat(parts[0])];
      });
      return { type: "polygon", coords };
    }
  }
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

function GeofenceModal({ geofence, onClose, onSave }) {
  const [form, setForm] = useState({
    name: geofence?.name || "",
    description: geofence?.description || "",
    areaType: "circle",
    lat: "",
    lng: "",
    radius: "500",
    area: geofence?.area || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clickedPoint, setClickedPoint] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (geofence?.area) {
      const parsed = parseArea(geofence.area);
      if (parsed?.type === "circle") {
        setForm(f => ({ ...f, areaType: "circle", lat: String(parsed.lat), lng: String(parsed.lng), radius: String(parsed.radius) }));
        setPreview(parsed);
      } else if (parsed?.type === "polygon") {
        setForm(f => ({ ...f, areaType: "polygon" }));
        setPreview(parsed);
      }
    }
  }, []);

  const buildArea = () => {
    if (form.areaType === "circle") {
      const la = parseFloat(form.lat), ln = parseFloat(form.lng), r = parseFloat(form.radius);
      if (isNaN(la) || isNaN(ln) || isNaN(r)) return null;
      return `CIRCLE (${la}, ${ln}, ${r})`;
    }
    return form.area;
  };

  const handleMapClick = (latlng) => {
    setClickedPoint(latlng);
    setForm(f => ({ ...f, lat: String(latlng.lat.toFixed(6)), lng: String(latlng.lng.toFixed(6)) }));
    const la = latlng.lat, ln = latlng.lng, r = parseFloat(form.radius) || 500;
    setPreview({ type: "circle", lat: la, lng: ln, radius: r });
  };

  const handleRadiusChange = (val) => {
    setForm(f => ({ ...f, radius: val }));
    if (form.lat && form.lng) {
      setPreview({ type: "circle", lat: parseFloat(form.lat), lng: parseFloat(form.lng), radius: parseFloat(val) || 500 });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError("Nome é obrigatório"); return; }
    const area = buildArea();
    if (!area) { setError("Defina as coordenadas da área"); return; }
    setLoading(true); setError("");
    try {
      const payload = { name: form.name, description: form.description, area };
      if (geofence) { await api.put(`/geofences/${geofence.id}`, payload); }
      else { await api.post("/geofences", payload); }
      onSave();
    } catch (err) { setError(err.response?.data?.error || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  const mapCenter = (form.lat && form.lng)
    ? [parseFloat(form.lat), parseFloat(form.lng)]
    : [-15.788, -47.879];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth: "700px", width: "95vw"}}>
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900">{geofence ? "Editar Geocerca" : "Nova Geocerca"}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nome *</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nome da geocerca" />
              </div>
              <div>
                <label className="label">Descrição</label>
                <input className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Descrição opcional" />
              </div>
            </div>
            <div>
              <label className="label">Tipo de Área</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm({...form, areaType: "circle"})}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs flex items-center justify-center gap-2 transition-colors ${form.areaType === "circle" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700"}`}>
                  <Circle size={14} />Círculo
                </button>
                <button type="button" onClick={() => setForm({...form, areaType: "polygon"})}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs flex items-center justify-center gap-2 transition-colors ${form.areaType === "polygon" ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700"}`}>
                  <Square size={14} />Polígono (WKT)
                </button>
              </div>
            </div>
            {form.areaType === "circle" ? (
              <>
                <p className="text-xs text-slate-600">Clique no mapa para definir o centro, ou informe as coordenadas manualmente.</p>
                <div className="rounded-xl overflow-hidden border border-slate-200" style={{height: "220px"}}>
                  <MapContainer center={mapCenter} zoom={preview ? 12 : 5} style={{height: "100%", width: "100%"}}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapClickHandler onMapClick={handleMapClick} />
                    {preview?.type === "circle" && !isNaN(preview.lat) && !isNaN(preview.lng) && (
                      <LeafletCircle center={[preview.lat, preview.lng]} radius={preview.radius}
                        pathOptions={{color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.2}} />
                    )}
                  </MapContainer>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Latitude</label>
                    <input className="input font-mono text-xs" value={form.lat} onChange={e => setForm({...form, lat: e.target.value})} placeholder="-15.788" />
                  </div>
                  <div>
                    <label className="label">Longitude</label>
                    <input className="input font-mono text-xs" value={form.lng} onChange={e => setForm({...form, lng: e.target.value})} placeholder="-47.879" />
                  </div>
                  <div>
                    <label className="label">Raio (metros)</label>
                    <input className="input font-mono text-xs" value={form.radius} onChange={e => handleRadiusChange(e.target.value)} placeholder="500" />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="label">WKT da Área</label>
                <textarea className="input font-mono text-xs" rows={3}
                  value={form.area} onChange={e => setForm({...form, area: e.target.value})}
                  placeholder="POLYGON ((lng1 lat1, lng2 lat2, lng3 lat3, lng1 lat1))" />
                <p className="text-xs text-slate-600 mt-1">Formato WKT do Traccar. Ex: POLYGON ((-47.9 -15.8, -47.8 -15.8, -47.8 -15.7, -47.9 -15.7, -47.9 -15.8))</p>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GeofencesPage() {
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editGeofence, setEditGeofence] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [view, setView] = useState("list");

  const fetchGeofences = async () => {
    setLoading(true);
    try { const res = await api.get("/geofences"); setGeofences(res.data || []); }
    catch (e) { setGeofences([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGeofences(); }, []);

  const handleDelete = async (id) => {
    try { await api.delete(`/geofences/${id}`); setGeofences(p => p.filter(g => g.id !== id)); setDeleteId(null); }
    catch (e) { console.error(e); }
  };

  const filtered = geofences.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));
  const mapLayers = filtered.map(g => ({ id: g.id, name: g.name, parsed: parseArea(g.area) })).filter(g => g.parsed);
  const mapCenter = mapLayers.length > 0 && mapLayers[0].parsed?.lat
    ? [mapLayers[0].parsed.lat, mapLayers[0].parsed.lng]
    : [-15.788, -47.879];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900" style={{fontFamily:"Space Grotesk,sans-serif"}}>Geocercas</h1>
          <p className="text-slate-500 text-sm mt-0.5">{geofences.length} cadastradas</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchGeofences} className="btn-ghost"><RefreshCw size={15} /></button>
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            <button onClick={() => setView("list")} className={`px-3 py-2 text-xs flex items-center gap-1.5 transition-colors ${view === "list" ? "bg-slate-200 text-slate-900" : "bg-slate-100 text-slate-500 hover:text-slate-700"}`}>
              <List size={13} />Lista
            </button>
            <button onClick={() => setView("map")} className={`px-3 py-2 text-xs flex items-center gap-1.5 transition-colors ${view === "map" ? "bg-slate-200 text-slate-900" : "bg-slate-100 text-slate-500 hover:text-slate-700"}`}>
              <Map size={13} />Mapa
            </button>
          </div>
          <button onClick={() => { setEditGeofence(null); setShowModal(true); }} className="btn-primary">
            <Plus size={15} />Nova Geocerca
          </button>
        </div>
      </div>

      <div className="relative w-full sm:w-80">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-10" placeholder="Buscar geocerca..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {view === "map" ? (
        <div className="card overflow-hidden" style={{height: "500px"}}>
          <MapContainer center={mapCenter} zoom={5} style={{height: "100%", width: "100%"}}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {mapLayers.map(layer => {
              const { id, name, parsed } = layer;
              if (parsed.type === "circle") {
                return (
                  <LeafletCircle key={id} center={[parsed.lat, parsed.lng]} radius={parsed.radius}
                    pathOptions={{color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.2}}>
                    <Popup><strong className="text-slate-800">{name}</strong><br /><span className="text-xs text-slate-600">Raio: {parsed.radius}m</span></Popup>
                  </LeafletCircle>
                );
              }
              if (parsed.type === "polygon") {
                return (
                  <Polygon key={id} positions={parsed.coords}
                    pathOptions={{color: "#8b5cf6", fillColor: "#8b5cf6", fillOpacity: 0.2}}>
                    <Popup><strong className="text-slate-800">{name}</strong></Popup>
                  </Polygon>
                );
              }
              return null;
            })}
          </MapContainer>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {loading ? (
            <div className="p-12 text-center"><div className="w-7 h-7 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <MapPin size={36} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-500 text-sm">Nenhuma geocerca cadastrada</p>
              <p className="text-slate-600 text-xs mt-1">Clique em "Nova Geocerca" para criar uma área</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Nome</th><th>Tipo</th><th>Dimensões</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(geofence => {
                    const parsed = parseArea(geofence.area);
                    return (
                      <tr key={geofence.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                              <MapPin size={14} className="text-purple-400" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900 text-sm">{geofence.name}</p>
                              {geofence.description && <p className="text-slate-600 text-xs">{geofence.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium ${parsed?.type === "circle" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"}`}>
                            {parsed?.type === "circle" ? "Círculo" : parsed?.type === "polygon" ? "Polígono" : "Área"}
                          </span>
                        </td>
                        <td>
                          <span className="text-slate-500 text-xs font-mono">
                            {parsed?.type === "circle" ? `r=${parsed.radius}m` : parsed?.type === "polygon" ? `${parsed.coords?.length} pontos` : "-"}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => { setEditGeofence(geofence); setShowModal(true); }} className="p-1.5 text-slate-600 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-all"><Edit2 size={13} /></button>
                            <button onClick={() => setDeleteId(geofence.id)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showModal && <GeofenceModal geofence={editGeofence} onClose={() => { setShowModal(false); setEditGeofence(null); }} onSave={() => { setShowModal(false); setEditGeofence(null); fetchGeofences(); }} />}

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal max-w-sm">
            <div className="modal-body text-center py-8">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-red-500" /></div>
              <h3 className="font-semibold text-slate-900 mb-1">Confirmar exclusão</h3>
              <p className="text-slate-500 text-sm">Esta ação não pode ser desfeita.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setDeleteId(null)} className="btn-secondary flex-1 justify-center">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} className="btn-danger flex-1 justify-center">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
