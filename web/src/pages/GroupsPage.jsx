import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Layers, Plus, Edit2, Trash2, Search, RefreshCw, Car } from "lucide-react";

function GroupModal({ group, onClose, onSave }) {
  const [form, setForm] = useState({
    name: group?.name || "",
    groupId: group?.groupId || 0,
    attributes: { description: group?.attributes?.description || "" }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError("Nome é obrigatório"); return; }
    setLoading(true); setError("");
    try {
      if (group) { await api.put(`/groups/${group.id}`, form); }
      else { await api.post("/groups", form); }
      onSave();
    } catch (err) { setError(err.response?.data?.error || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-100">{group ? "Editar Grupo" : "Novo Grupo"}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
            <div>
              <label className="label">Nome do Grupo *</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Frota Sul, Executivos..." />
            </div>
            <div>
              <label className="label">Descrição</label>
              <input className="input" value={form.attributes.description} onChange={e => setForm({...form, attributes: {...form.attributes, description: e.target.value}})} placeholder="Descrição opcional..." />
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

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [grpRes, devRes] = await Promise.all([api.get("/groups"), api.get("/devices")]);
      setGroups(grpRes.data || []);
      setDevices(devRes.data || []);
    } catch (e) { setGroups([]); setDevices([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleDelete = async (id) => {
    try { await api.delete(`/groups/${id}`); setGroups(p => p.filter(g => g.id !== id)); setDeleteId(null); }
    catch (e) { console.error(e); }
  };

  const getDeviceCount = (groupId) => devices.filter(d => d.groupId === groupId).length;
  const filtered = groups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100" style={{fontFamily:"Space Grotesk,sans-serif"}}>Grupos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{groups.length} grupos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-ghost"><RefreshCw size={15} /></button>
          <button onClick={() => { setEditGroup(null); setShowModal(true); }} className="btn-primary">
            <Plus size={15} />Novo Grupo
          </button>
        </div>
      </div>

      <div className="relative w-full sm:w-80">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-10" placeholder="Buscar grupo..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Grid de cards */}
      {loading ? (
        <div className="card p-12 text-center"><div className="w-7 h-7 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Layers size={36} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-500 text-sm">Nenhum grupo cadastrado</p>
          <p className="text-slate-600 text-xs mt-1">Crie grupos para organizar seus veículos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(group => {
            const count = getDeviceCount(group.id);
            const groupDevices = devices.filter(d => d.groupId === group.id).slice(0, 3);
            return (
              <div key={group.id} className="card p-4 hover:border-slate-700 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                      <Layers size={18} className="text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-100 text-sm">{group.name}</p>
                      {group.attributes?.description && <p className="text-slate-600 text-xs">{group.attributes.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditGroup(group); setShowModal(true); }} className="p-1.5 text-slate-600 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-all"><Edit2 size={13} /></button>
                    <button onClick={() => setDeleteId(group.id)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-600 text-xs flex items-center gap-1.5"><Car size={11} />{count} veículo{count !== 1 ? "s" : ""}</span>
                  </div>
                  {groupDevices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {groupDevices.map(d => (
                        <span key={d.id} className="px-2 py-0.5 bg-slate-800 rounded-md text-slate-400 text-xs">{d.name}</span>
                      ))}
                      {count > 3 && <span className="px-2 py-0.5 bg-slate-800 rounded-md text-slate-600 text-xs">+{count - 3} mais</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <GroupModal group={editGroup} onClose={() => { setShowModal(false); setEditGroup(null); }} onSave={() => { setShowModal(false); setEditGroup(null); fetchData(); }} />}

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal max-w-sm">
            <div className="modal-body text-center py-8">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-red-500" /></div>
              <h3 className="font-semibold text-slate-100 mb-1">Confirmar exclusão</h3>
              <p className="text-slate-500 text-sm">Os veículos do grupo não serão excluídos.</p>
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
