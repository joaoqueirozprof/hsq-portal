import { useState, useEffect } from "react";
import { api, devicesAPI } from "../services/api";
import { Activity, RefreshCw, Filter, Car, Search, X } from "lucide-react";

const EVENT_LABELS = {
  deviceOnline:     { label: "Dispositivo Online",    cls: "bg-green-50 text-green-700 border-green-200" },
  deviceOffline:    { label: "Dispositivo Offline",   cls: "bg-red-50 text-red-700 border-red-200" },
  deviceOverspeed:  { label: "Excesso de Velocidade", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  geofenceEnter:    { label: "Entrada em Geocerca",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  geofenceExit:     { label: "Saida de Geocerca",     cls: "bg-orange-50 text-orange-700 border-orange-200" },
  deviceMoving:     { label: "Movimento Detectado",   cls: "bg-green-50 text-green-700 border-green-200" },
  deviceStopped:    { label: "Parada Detectada",      cls: "bg-slate-100 text-slate-600 border-slate-200" },
  ignitionOn:       { label: "Ignicao Ligada",        cls: "bg-green-50 text-green-700 border-green-200" },
  ignitionOff:      { label: "Ignicao Desligada",     cls: "bg-slate-100 text-slate-600 border-slate-200" },
  alarm:            { label: "Alarme",                cls: "bg-red-50 text-red-700 border-red-200" },
};

const EVENT_TYPES = [
  { value: "", label: "Todos os tipos" },
  { value: "deviceOnline", label: "Dispositivo Online" },
  { value: "deviceOffline", label: "Dispositivo Offline" },
  { value: "deviceOverspeed", label: "Excesso de Velocidade" },
  { value: "geofenceEnter", label: "Entrada em Geocerca" },
  { value: "geofenceExit", label: "Saida de Geocerca" },
  { value: "deviceMoving", label: "Movimento" },
  { value: "deviceStopped", label: "Parada" },
  { value: "ignitionOn", label: "Ignicao Ligada" },
  { value: "ignitionOff", label: "Ignicao Desligada" },
  { value: "alarm", label: "Alarme" },
];

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [filterDevice, setFilterDevice] = useState("");
  const [filterType, setFilterType] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 25;

  useEffect(() => {
    devicesAPI.list().then(r => setDevices(r.data || [])).catch(() => {});
  }, []);

  const deviceMap = {};
  devices.forEach(d => { deviceMap[d.id] = d.name; });

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = {
        from: dateFrom + "T00:00:00.000Z",
        to: dateTo + "T23:59:59.000Z"
      };
      if (filterDevice) params.deviceId = filterDevice;
      if (filterType) params.type = filterType;
      const res = await api.get("/events", { params });
      setPage(1);
      setEvents(res.data || []);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (devices.length > 0) fetchEvents(); }, [devices]);

  const getEventStyle = (type) => {
    return EVENT_LABELS[type] || { label: type || "Evento", cls: "bg-slate-100 text-slate-600 border-slate-200" };
  };

  const filtered = events;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900" style={{fontFamily:"Space Grotesk,sans-serif"}}>Eventos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{filtered.length} eventos encontrados</p>
        </div>
        <button onClick={fetchEvents} className="btn-ghost"><RefreshCw size={15} /></button>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">De</label>
            <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Ate</label>
            <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div>
            <label className="label">Veiculo</label>
            <select className="input" value={filterDevice} onChange={e => setFilterDevice(e.target.value)}>
              <option value="">Todos</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)}>
              {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <button onClick={fetchEvents} disabled={loading} className="btn-primary">
            <Filter size={14} />
            {loading ? "Buscando..." : "Filtrar"}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-7 h-7 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Activity size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">Nenhum evento encontrado</p>
            <p className="text-slate-400 text-xs mt-1">Tente ajustar o periodo ou os filtros</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Veiculo</th>
                  <th>Data / Hora</th>
                  <th>Info</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice((page-1)*perPage, page*perPage).map((event, i) => {
                  const { label, cls } = getEventStyle(event.type);
                  const devName = deviceMap[event.deviceId] || "Dispositivo #" + event.deviceId;
                  return (
                    <tr key={event.id || i}>
                      <td>
                        <span className={"inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium " + cls}>
                          {label}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Car size={13} className="text-blue-500" />
                          <span className="text-slate-800 text-sm font-medium">{devName}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-slate-700 text-sm">
                          {event.eventTime ? new Date(event.eventTime).toLocaleString("pt-BR") : "-"}
                        </span>
                      </td>
                      <td>
                        <span className="text-slate-500 text-xs">
                          {event.geofenceId ? "Geocerca #" + event.geofenceId : ""}
                          {event.maintenanceId ? "Manutencao #" + event.maintenanceId : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > perPage && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <span className="text-xs text-slate-400">{(page-1)*perPage+1}-{Math.min(page*perPage, filtered.length)} de {filtered.length}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">Anterior</button>
              <button onClick={() => setPage(p => Math.min(Math.ceil(filtered.length/perPage), p+1))} disabled={page >= Math.ceil(filtered.length/perPage)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">Proximo</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
