import { useState, useEffect } from "react";
import { reportsAPI, devicesAPI } from "../services/api";
import {
  FileText, Download, Calendar, Car, MapPin, Clock,
  Play, AlertCircle, X, Activity, Layers, BarChart2,
  RefreshCw
} from "lucide-react";

const REPORT_TYPES = [
  { id: "trips", label: "Viagens", icon: Car, desc: "Distância, velocidade e tempo por viagem" },
  { id: "summary", label: "Resumo", icon: BarChart2, desc: "Totais por dispositivo no período" },
  { id: "stops", label: "Paradas", icon: Clock, desc: "Locais e duração das paradas" },
  { id: "events", label: "Eventos", icon: Activity, desc: "Ignição, alarmes e alertas" },
  { id: "route", label: "Rota", icon: MapPin, desc: "Pontos GPS percorridos" },
  { id: "geofences", label: "Geocercas", icon: Layers, desc: "Tempo dentro de áreas" },
];

const COL_LABELS = {
  deviceId: "ID Disp.", deviceName: "Dispositivo", maxSpeed: "Vel. Máx (km/h)",
  averageSpeed: "Vel. Média (km/h)", distance: "Distância (km)", spentFuel: "Combustível",
  duration: null, durationFormatted: "Duração", startTime: "Início", endTime: "Fim",
  startAddress: "Origem", endAddress: "Destino", latitude: "Latitude", longitude: "Longitude",
  address: "Endereço", engineHours: "Horas Motor", course: "Direção", speed: "Vel. (km/h)",
  time: "Horário", lat: "Lat", lng: "Lng", geofenceId: "Geocerca ID", type: "Tipo",
};

function formatValue(key, val) {
  if (val === null || val === undefined || val === "") return "-";
  if (key === "duration") return null; // skip raw duration
  if (key.includes("Time") || key === "time") {
    try { return new Date(val).toLocaleString("pt-BR"); } catch { return val; }
  }
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function ReportTable({ data }) {
  if (!data || data.length === 0) return null;
  const allKeys = Object.keys(data[0]).filter(k => COL_LABELS[k] !== null);
  const keys = allKeys.filter(k => COL_LABELS[k] !== undefined || !["duration"].includes(k));

  const exportCSV = () => {
    const headers = keys.map(k => COL_LABELS[k] || k);
    const rows = data.map(row => keys.map(k => {
      const v = row[k];
      return typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
    }));
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="card overflow-hidden animate-fade-in">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <p className="text-slate-300 text-sm font-medium">{data.length} registro{data.length !== 1 ? "s" : ""} encontrado{data.length !== 1 ? "s" : ""}</p>
        <button onClick={exportCSV} className="btn-ghost text-xs flex items-center gap-1.5">
          <Download size={13} />CSV
        </button>
      </div>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>{keys.map(k => <th key={k}>{COL_LABELS[k] || k}</th>)}</tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((row, i) => (
              <tr key={i}>
                {keys.map(k => {
                  const formatted = formatValue(k, row[k]);
                  if (formatted === null) return null;
                  return (
                    <td key={k}>
                      <span className={`text-xs ${k === "deviceName" ? "font-medium text-slate-800" : "text-slate-400"}`}>
                        {formatted}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 100 && (
        <div className="p-3 text-center text-xs text-slate-600 border-t border-slate-200">
          Mostrando 100 de {data.length} registros — exporte o CSV para ver todos
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const [devices, setDevices] = useState([]);
  const [selectedType, setSelectedType] = useState("trips");
  const [deviceId, setDeviceId] = useState("");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    devicesAPI.list().then(r => setDevices(r.data || [])).catch(() => {});
  }, []);

  const buildParams = () => ({
    deviceId: deviceId || undefined,
    from: dateFrom + "T00:00:00.000Z",
    to: dateTo + "T23:59:59.000Z",
  });

  const generate = async () => {
    if (!deviceId) { setError("Selecione um veículo"); return; }
    if (!dateFrom || !dateTo) { setError("Informe o período"); return; }
    setLoading(true); setError(""); setData(null);
    try {
      const params = buildParams();
      let res;
      switch (selectedType) {
        case "trips":    res = await reportsAPI.getTrips(params); break;
        case "summary":  res = await reportsAPI.getSummary(params); break;
        case "events":   res = await reportsAPI.getEvents(params); break;
        case "route":    res = await reportsAPI.getRoute(params); break;
        case "stops":    res = await reportsAPI.getStops(params); break;
        case "geofences": res = await reportsAPI.getGeofences(params); break;
        default: res = await reportsAPI.getTrips(params);
      }
      setData(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao gerar relatório. Verifique se o dispositivo tem dados no período.");
    } finally {
      setLoading(false);
    }
  };

  const currentType = REPORT_TYPES.find(t => t.id === selectedType);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900" style={{fontFamily:"Space Grotesk,sans-serif"}}>Relatórios</h1>
        <p className="text-slate-500 text-sm mt-0.5">Gere relatórios detalhados por período e veículo</p>
      </div>

      {/* Tipo de relatório */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {REPORT_TYPES.map(({ id, label, icon: Icon, desc }) => {
          const active = selectedType === id;
          return (
            <button
              key={id}
              onClick={() => { setSelectedType(id); setData(null); setError(""); }}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${
                active
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "bg-slate-100/60 border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-200"
              }`}
            >
              <Icon size={18} />
              <span className="text-xs font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Descrição do tipo selecionado */}
      {currentType && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100/60 rounded-xl border border-slate-200">
          <currentType.icon size={14} className="text-blue-400" />
          <span className="text-slate-400 text-xs">{currentType.desc}</span>
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Veículo *</label>
            <select className="input" value={deviceId} onChange={e => setDeviceId(e.target.value)}>
              <option value="">Selecione um veículo</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap gap-1.5 items-end">
            <span className="text-xs text-slate-400 mr-1">Periodo:</span>
            {[
              { label: "Hoje", fn: () => { const d=new Date().toISOString().split("T")[0]; setDateFrom(d); setDateTo(d); }},
              { label: "Ontem", fn: () => { const d=new Date(Date.now()-86400000).toISOString().split("T")[0]; setDateFrom(d); setDateTo(d); }},
              { label: "7 dias", fn: () => { const t=new Date().toISOString().split("T")[0]; const f=new Date(Date.now()-7*86400000).toISOString().split("T")[0]; setDateFrom(f); setDateTo(t); }},
              { label: "30 dias", fn: () => { const t=new Date().toISOString().split("T")[0]; const f=new Date(Date.now()-30*86400000).toISOString().split("T")[0]; setDateFrom(f); setDateTo(t); }},
            ].map(p => (
              <button key={p.label} type="button" onClick={p.fn}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors">{p.label}</button>
            ))}
          </div>
          <div>
            <label className="label">Data Início</label>
            <input type="date" className="input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">Data Fim</label>
            <input type="date" className="input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={generate} disabled={loading} className="btn-primary w-full justify-center">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Gerando...</>
                : <><Play size={15} />Gerar Relatório</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-400 text-sm flex-1">{error}</p>
          <button onClick={() => setError("")} className="text-red-400/60 hover:text-red-400 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Resultado */}
      {data !== null && data.length === 0 && !loading && (
        <div className="card p-12 text-center">
          <FileText size={36} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">Nenhum dado encontrado no período selecionado</p>
          <p className="text-slate-600 text-xs mt-1">Tente ampliar o intervalo de datas</p>
        </div>
      )}

      {data && data.length > 0 && <ReportTable data={data} />}

      {/* Estado inicial */}
      {data === null && !loading && !error && (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-slate-600" />
          </div>
          <p className="text-slate-400 text-sm font-medium">Selecione o veículo e o período</p>
          <p className="text-slate-600 text-xs mt-1">Depois clique em "Gerar Relatório"</p>
        </div>
      )}
    </div>
  );
}
