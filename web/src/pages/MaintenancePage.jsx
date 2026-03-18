import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Wrench, Plus, Edit2, Trash2, Search, RefreshCw, AlertTriangle, CheckCircle, Clock } from "lucide-react";

const TYPE_OPTIONS = [
  { value: "oilChange", label: "Troca de Óleo" },
  { value: "tireRotation", label: "Rodízio de Pneus" },
  { value: "brakeInspection", label: "Inspeção de Freios" },
  { value: "filterReplacement", label: "Troca de Filtro" },
  { value: "generalInspection", label: "Inspeção Geral" },
  { value: "other", label: "Outro" },
];

function getStatus(item) {
  if (!item.period && !item.start) return { label: "Ativo", cls: "badge-success", icon: CheckCircle };
  const now = Date.now();
  if (item.expiration && new Date(item.expiration).getTime() < now)
    return { label: "Vencido", cls: "badge-danger", icon: AlertTriangle };
  return { label: "Em dia", cls: "badge-success", icon: CheckCircle };
}

function MaintenanceModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    name: item?.name || "",
    type: item?.type || "oilChange",
    start: item?.start || 0,
    period: item?.period || 0,
    attributes: { description: item?.attributes?.description || "" }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError("Nome é obrigatório"); return; }
    setLoading(true); setError("");
    try {
      const payload = { ...form, start: Number(form.start), period: Number(form.period) };
      if (item) { await api.put(`/maintenance/${item.id}`, payload); }
      else { await api.post("/maintenance", payload); }
      onSave();
    } catch (err) { setError(err.response?.data?.error || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-100">{item ? "Editar Manutenção" : "Nova Manutenção"}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
            <div>
              <label className="label">Nome *</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Troca de óleo do veículo 01" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Hodômetro Inicial (km)</label>
                <input type="number" className="input" value={form.start} onChange={e => setForm({...form, start: e.target.value})} placeholder="0" />
              </div>
              <div>
                <label className="label">Período (km)</label>
                <input type="number" className="input" value={form.period} onChange={e => setForm({...form, period: e.target.value})} placeholder="5000" />
              </div>
            </div>
            <div>
              <label className="label">Descrição</label>
              <textarea className="input" rows={3} value={form.attributes.description} onChange={e => setForm({...form, attributes: {...form.attributes, description: e.target.value}})} placeholder="Detalhes sobre a manutenção..." />
            </div>
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

export default function MaintenancePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const fetchItems = async () => {
    setLoading(true);
    try { const res = await api.get("/maintenance"); setItems(res.data || []); }
    catch (e) { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchItems(); }, []);

  const handleDelete = async (id) => {
    try { await api.delete(`/maintenance/${id}`); setItems(p => p.filter(i => i.id !== id)); setDeleteId(null); }
    catch (e) { console.error(e); }
  };

  const filtered = items.filter(i => i.name?.toLowerCase().includes(search.toLowerCase()));
  const typeLabel = (type) => TYPE_OPTIONS.find(o => o.value === type)?.label || type;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100" style={{fontFamily:"Space Grotesk,sans-serif"}}>Manutenção</h1>
          <p className="text-slate-500 text-sm mt-0.5">{items.length} registros</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchItems} className="btn-ghost"><RefreshCw size={15} /></button>
          <button onClick={() => { setEditItem(null); setShowModal(true); }} className="btn-primary">
            <Plus size={15} />Nova Manutenção
          </button>
        </div>
      </div>

      <div className="relative w-full sm:w-80">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-10" placeholder="Buscar manutenção..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-7 h-7 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Wrench size={36} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">Nenhuma manutenção cadastrada</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Nome</th><th>Tipo</th><th>Hodômetro</th><th>Período</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map(item => {
                  const status = getStatus(item);
                  const StatusIcon = status.icon;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                            <Wrench size={14} className="text-orange-400" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-100 text-sm">{item.name}</p>
                            {item.attributes?.description && <p className="text-slate-600 text-xs">{item.attributes.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td><span className="text-slate-400 text-xs">{typeLabel(item.type)}</span></td>
                      <td><span className="text-slate-400 text-xs font-mono">{item.start ? `${(item.start/1000).toFixed(0)} km` : "-"}</span></td>
                      <td><span className="text-slate-400 text-xs font-mono">{item.period ? `${(item.period/1000).toFixed(0)} km` : "-"}</span></td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${status.cls}`}>
                          <StatusIcon size={11} />
                          {status.label}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => { setEditItem(item); setShowModal(true); }} className="p-1.5 text-slate-600 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-all"><Edit2 size={13} /></button>
                          <button onClick={() => setDeleteId(item.id)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
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

      {showModal && <MaintenanceModal item={editItem} onClose={() => { setShowModal(false); setEditItem(null); }} onSave={() => { setShowModal(false); setEditItem(null); fetchItems(); }} />}

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
