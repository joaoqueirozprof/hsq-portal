import { useState, useEffect } from "react";
import { devicesAPI } from "../services/api";
import { Car, Plus, Search, Edit2, Trash2, RefreshCw } from "lucide-react";

function DeviceModal({ device, onClose, onSave }) {
  const [form, setForm] = useState({
    name: device?.name || "",
    uniqueId: device?.uniqueId || "",
    attributes: {
      phone: device?.attributes?.phone || "",
      model: device?.attributes?.model || "",
      category: device?.attributes?.category || "default",
      contact: device?.attributes?.contact || "",
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.uniqueId) { setError("Nome e ID são obrigatórios"); return; }
    setLoading(true); setError("");
    try {
      if (device) { await devicesAPI.update(device.id, form); }
      else { await devicesAPI.create(form); }
      onSave();
    } catch (err) { setError(err.response?.data?.error || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-100">{device ? "Editar Veículo" : "Novo Veículo"}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
            <div>
              <label className="label">Nome do Veículo *</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Caminhão 01" />
            </div>
            <div>
              <label className="label">IMEI / ID Único *</label>
              <input className="input font-mono" value={form.uniqueId} onChange={e => setForm({...form, uniqueId: e.target.value})} placeholder="358000000000000" disabled={!!device} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Telefone</label>
                <input className="input" value={form.attributes.phone} onChange={e => setForm({...form, attributes: {...form.attributes, phone: e.target.value}})} placeholder="+5511999999999" />
              </div>
              <div>
                <label className="label">Modelo</label>
                <input className="input" value={form.attributes.model} onChange={e => setForm({...form, attributes: {...form.attributes, model: e.target.value}})} placeholder="FMB920" />
              </div>
              <div>
                <label className="label">Contato</label>
                <input className="input" value={form.attributes.contact} onChange={e => setForm({...form, attributes: {...form.attributes, contact: e.target.value}})} placeholder="Responsável" />
              </div>
              <div>
                <label className="label">Categoria</label>
                <select className="input" value={form.attributes.category} onChange={e => setForm({...form, attributes: {...form.attributes, category: e.target.value}})}>
                  <option value="default">Padrão</option>
                  <option value="truck">Caminhão</option>
                  <option value="car">Carro</option>
                  <option value="motorcycle">Moto</option>
                  <option value="bus">Ônibus</option>
                  <option value="van">Van</option>
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (device ? "Salvar" : "Criar Veículo")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modalDevice, setModalDevice] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const fetchDevices = async () => {
    try { const res = await devicesAPI.list(); setDevices(res.data || []); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDevices(); }, []);

  const handleDelete = async (id) => {
    try { await devicesAPI.delete(id); setDevices(p => p.filter(d => d.id !== id)); setDeleteId(null); }
    catch (e) { console.error(e); }
  };

  const filtered = devices.filter(d => {
    const m = d.name.toLowerCase().includes(search.toLowerCase()) || d.uniqueId.includes(search);
    const f = filter === "all" || d.status === filter;
    return m && f;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100" style={{fontFamily:"Space Grotesk,sans-serif"}}>Veículos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{devices.length} cadastrados · {devices.filter(d=>d.status==="online").length} online</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchDevices} className="btn-ghost"><RefreshCw size={15} /></button>
          <button onClick={() => { setModalDevice(null); setShowModal(true); }} className="btn-primary">
            <Plus size={15} /><span>Novo Veículo</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-10" placeholder="Buscar por nome ou IMEI..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {["all","online","offline"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all border ${
              filter === f ? "bg-blue-600/20 text-blue-400 border-blue-600/30" : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-100"
            }`}>
              {f === "all" ? "Todos" : f === "online" ? "Online" : "Offline"}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-7 h-7 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center"><Car size={36} className="mx-auto text-slate-700 mb-3" /><p className="text-slate-500 text-sm">Nenhum veículo encontrado</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Veículo</th><th>IMEI</th><th>Status</th><th>Categoria</th><th>Telefone</th><th>Última atualização</th><th></th></tr></thead>
              <tbody>
                {filtered.map(device => (
                  <tr key={device.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${device.status==="online" ? "bg-green-500/15" : "bg-slate-800"}`}>
                          <Car size={14} className={device.status==="online" ? "text-green-500" : "text-slate-600"} />
                        </div>
                        <span className="font-medium text-slate-100 text-sm">{device.name}</span>
                      </div>
                    </td>
                    <td><span className="font-mono text-slate-500 text-xs">{device.uniqueId}</span></td>
                    <td>
                      {device.status === "online"
                        ? <span className="badge-online"><span className="w-1.5 h-1.5 rounded-full bg-green-400 status-pulse" />Online</span>
                        : <span className="badge-offline"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" />Offline</span>
                      }
                    </td>
                    <td><span className="text-slate-500 text-xs capitalize">{device.attributes?.category || "-"}</span></td>
                    <td><span className="text-slate-500 text-xs">{device.attributes?.phone || "-"}</span></td>
                    <td><span className="text-slate-600 text-xs">{device.lastUpdate ? new Date(device.lastUpdate).toLocaleString("pt-BR") : "-"}</span></td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setModalDevice(device); setShowModal(true); }} className="p-1.5 text-slate-600 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-all"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteId(device.id)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <DeviceModal device={modalDevice} onClose={() => { setShowModal(false); setModalDevice(null); }} onSave={() => { setShowModal(false); setModalDevice(null); fetchDevices(); }} />}

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal max-w-sm">
            <div className="modal-body text-center py-8">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-red-500" /></div>
              <h3 className="font-semibold text-slate-100 mb-1">Confirmar exclusão</h3>
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
