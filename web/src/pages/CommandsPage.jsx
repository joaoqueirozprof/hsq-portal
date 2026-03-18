import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Terminal, Send, RefreshCw, ChevronDown, CheckCircle, AlertCircle, Clock } from "lucide-react";

const COMMAND_TYPES_DEFAULT = [
  { type: "positionSingle", description: "Solicitar posição atual" },
  { type: "positionPeriodic", description: "Posição periódica" },
  { type: "positionStop", description: "Parar posição periódica" },
  { type: "engineStop", description: "Bloquear motor" },
  { type: "engineResume", description: "Desbloquear motor" },
  { type: "alarmSos", description: "Testar alarme SOS" },
  { type: "alarmVibration", description: "Alarme de vibração" },
  { type: "custom", description: "Comando personalizado" },
];

function SendCommandModal({ devices, onClose }) {
  const [form, setForm] = useState({ deviceId: "", type: "positionSingle", attributes: { data: "" } });
  const [types, setTypes] = useState(COMMAND_TYPES_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.deviceId) { setError("Selecione um dispositivo"); return; }
    setLoading(true); setError(""); setResult(null);
    try {
      const payload = {
        deviceId: Number(form.deviceId),
        type: form.type,
        attributes: form.type === "custom" ? { data: form.attributes.data } : {}
      };
      await api.post("/commands/send", payload);
      setResult("Comando enviado com sucesso!");
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao enviar comando");
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-100">Enviar Comando</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
            {result && <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm flex items-center gap-2"><CheckCircle size={14} />{result}</div>}
            <div>
              <label className="label">Dispositivo *</label>
              <select className="input" value={form.deviceId} onChange={e => setForm({...form, deviceId: e.target.value})}>
                <option value="">Selecione um dispositivo</option>
                {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo de Comando</label>
              <select className="input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                {COMMAND_TYPES_DEFAULT.map(t => <option key={t.type} value={t.type}>{t.description}</option>)}
              </select>
            </div>
            {form.type === "custom" && (
              <div>
                <label className="label">Dados do Comando</label>
                <input className="input font-mono" value={form.attributes.data} onChange={e => setForm({...form, attributes: { data: e.target.value }})} placeholder="Comando raw..." />
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Fechar</button>
            <button type="submit" disabled={loading || !!result} className="btn-primary">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send size={14} />Enviar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CommandsPage() {
  const [devices, setDevices] = useState([]);
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [devRes, cmdRes] = await Promise.all([
        api.get("/devices"),
        api.get("/commands")
      ]);
      setDevices(devRes.data || []);
      setCommands(cmdRes.data || []);
    } catch (e) {
      setDevices([]); setCommands([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const deviceName = (id) => devices.find(d => d.id === id)?.name || `#${id}`;

  const filtered = selectedDevice === "all" ? commands : commands.filter(c => c.deviceId === Number(selectedDevice));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100" style={{fontFamily:"Space Grotesk,sans-serif"}}>Comandos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{commands.length} comandos salvos</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-ghost"><RefreshCw size={15} /></button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Send size={15} />Enviar Comando
          </button>
        </div>
      </div>

      {/* Ações rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Solicitar Posição", type: "positionSingle", icon: "📍", cls: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
          { label: "Bloquear Motor", type: "engineStop", icon: "🔒", cls: "bg-red-500/10 border-red-500/20 text-red-400" },
          { label: "Desbloquear Motor", type: "engineResume", icon: "🔓", cls: "bg-green-500/10 border-green-500/20 text-green-400" },
          { label: "Testar Alarme", type: "alarmSos", icon: "🚨", cls: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" },
        ].map(action => (
          <button key={action.type} onClick={() => setShowModal(true)}
            className={`p-4 rounded-xl border flex flex-col items-start gap-2 hover:opacity-80 transition-opacity ${action.cls}`}>
            <span className="text-xl">{action.icon}</span>
            <span className="text-xs font-medium">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Filtro por dispositivo */}
      <div className="flex items-center gap-3">
        <label className="text-slate-500 text-xs">Filtrar por dispositivo:</label>
        <select className="input w-auto" value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)}>
          <option value="all">Todos</option>
          {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* Comandos salvos */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-300">Comandos Salvos no Traccar</h2>
          <p className="text-xs text-slate-600 mt-0.5">Comandos pré-configurados para envio rápido</p>
        </div>
        {loading ? (
          <div className="p-12 text-center"><div className="w-7 h-7 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Terminal size={36} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">Nenhum comando salvo</p>
            <p className="text-slate-600 text-xs mt-1">Use o Traccar para salvar comandos pré-configurados</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Descrição</th><th>Dispositivo</th><th>Tipo</th><th></th></tr></thead>
              <tbody>
                {filtered.map(cmd => (
                  <tr key={cmd.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                          <Terminal size={14} className="text-purple-400" />
                        </div>
                        <span className="font-medium text-slate-100 text-sm">{cmd.description || cmd.type}</span>
                      </div>
                    </td>
                    <td><span className="text-slate-400 text-xs">{cmd.deviceId ? deviceName(cmd.deviceId) : "Todos"}</span></td>
                    <td><span className="font-mono text-slate-500 text-xs">{cmd.type}</span></td>
                    <td>
                      <button
                        onClick={async () => {
                          try {
                            await api.post("/commands/send", { id: cmd.id });
                          } catch (e) {}
                        }}
                        className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600/30 text-purple-400 text-xs rounded-lg transition-all flex items-center gap-1.5"
                      >
                        <Send size={11} />Enviar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <SendCommandModal devices={devices} onClose={() => setShowModal(false)} />}
    </div>
  );
}
