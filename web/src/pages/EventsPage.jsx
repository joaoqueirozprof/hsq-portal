import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Activity, RefreshCw, Filter, Car, ChevronDown } from "lucide-react";

const EVENT_LABELS = {
  deviceOnline:     { label: "Dispositivo Online",        cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  deviceOffline:    { label: "Dispositivo Offline",       cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  deviceOverspeed:  { label: "Excesso de Velocidade",     cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  geofenceEnter:    { label: "Entrada em Geocerca",       cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  geofenceExit:     { label: "Saída de Geocerca",         cls: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  deviceMoving:     { label: "Movimento Detectado",       cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  deviceStopped:    { label: "Parada Detectada",          cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  ignitionOn:       { label: "Ignição Ligada",            cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  ignitionOff:      { label: "Ignição Desligada",         cls: "bg-slate-700 text-slate-400 border-slate-600" },
  alarm:            { label: "Alarme",                    cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get("/events", {
        params: {
          from: dateFrom + "T00:00:00.000Z",
          to: dateTo + "T23:59:59.000Z"
        }
      });
      setEvents(res.data || []);
    } catch (e) {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const getEventStyle = (type) => {
    return EVENT_LABELS[type] || { label: type || "Evento", cls: "bg-slate-800 text-slate-400 border-slate-700" };
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100" style={{fontFamily:"Space Grotesk,sans-serif"}}>Eventos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{events.length} eventos encontrados</p>
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
            <label className="label">Até</label>
            <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
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
        ) : events.length === 0 ? (
          <div className="p-12 text-center">
            <Activity size={36} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">Nenhum evento encontrado</p>
            <p className="text-slate-600 text-xs mt-1">Tente ajustar o período de busca</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Dispositivo</th>
                  <th>Data / Hora</th>
                  <th>Info</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, i) => {
                  const { label, cls } = getEventStyle(event.type);
                  return (
                    <tr key={event.id || i}>
                      <td>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium ${cls}`}>
                          {label}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Car size={12} className="text-slate-600" />
                          <span className="text-slate-400 text-xs">{event.deviceId || "-"}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-slate-400 text-xs">
                          {event.eventTime ? new Date(event.eventTime).toLocaleString("pt-BR") : "-"}
                        </span>
                      </td>
                      <td>
                        <span className="text-slate-600 text-xs font-mono">
                          {event.geofenceId ? `Geocerca #${event.geofenceId}` : ""}
                          {event.maintenanceId ? `Manutenção #${event.maintenanceId}` : ""}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
