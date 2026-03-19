import { useState, useEffect } from "react";
import { useToast } from "../context/ToastContext";
import { driversAPI } from "../services/api";
import { Users, Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";

function DriverModal({ driver, onClose, onSave }) {
  const [form, setForm] = useState({
    name: driver?.name || "",
    uniqueId: driver?.uniqueId || "",
    attributes: {
      phone: driver?.attributes?.phone || "",
      license: driver?.attributes?.license || "",
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.uniqueId) { setError("Nome e ID são obrigatórios"); return; }
    setLoading(true); setError("");
    try {
      if (driver) { await driversAPI.update(driver.id, form); }
      else { await driversAPI.create(form); }
      onSave();
    } catch (err) { setError(err.response?.data?.error || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-900">{driver ? "Editar Motorista" : "Novo Motorista"}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
            <div>
              <label className="label">Nome Completo *</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nome do motorista" />
            </div>
            <div>
              <label className="label">ID Único *</label>
              <input className="input" value={form.uniqueId} onChange={e => setForm({...form, uniqueId: e.target.value})} placeholder="Identificador único" disabled={!!driver} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Telefone</label>
                <input className="input" value={form.attributes.phone} onChange={e => setForm({...form, attributes: {...form.attributes, phone: e.target.value}})} placeholder="+55..." />
              </div>
              <div>
                <label className="label">Número da CNH</label>
                <input className="input" value={form.attributes.license} onChange={e => setForm({...form, attributes: {...form.attributes, license: e.target.value}})} placeholder="00000000000" />
              </div>
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

export default function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const toast = useToast();

  const fetchDrivers = async () => {
    setLoading(true);
    try { const res = await driversAPI.list(); setDrivers(res.data || []); }
    catch (e) { setDrivers([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDrivers(); }, []);

  const handleDelete = async (id) => {
    try { await driversAPI.delete(id); setDrivers(p => p.filter(d => d.id !== id)); setDeleteId(null); }
    catch (e) { console.error(e); }
  };

  const filtered = drivers.filter(d => d.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900" style={{fontFamily:"Space Grotesk,sans-serif"}}>Motoristas</h1>
          <p className="text-slate-500 text-sm mt-0.5">{drivers.length} cadastrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchDrivers} className="btn-ghost"><RefreshCw size={15} /></button>
          <button onClick={() => { setEditDriver(null); setShowModal(true); }} className="btn-primary">
            <Plus size={15} />Novo Motorista
          </button>
        </div>
      </div>

      <div className="relative w-full sm:w-80">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-10" placeholder="Buscar motorista..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-7 h-7 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center"><Users size={36} className="mx-auto text-slate-700 mb-3" /><p className="text-slate-500 text-sm">Nenhum motorista encontrado</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Motorista</th><th>ID</th><th>Telefone</th><th>CNH</th><th></th></tr></thead>
              <tbody>
                {filtered.map(driver => (
                  <tr key={driver.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-600/20 flex items-center justify-center">
                          <span className="text-blue-400 text-xs font-bold uppercase">{driver.name?.charAt(0)}</span>
                        </div>
                        <span className="font-medium text-slate-900 text-sm">{driver.name}</span>
                      </div>
                    </td>
                    <td><span className="font-mono text-slate-500 text-xs">{driver.uniqueId}</span></td>
                    <td><span className="text-slate-500 text-xs">{driver.attributes?.phone || "-"}</span></td>
                    <td><span className="text-slate-500 text-xs">{driver.attributes?.license || "-"}</span></td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditDriver(driver); setShowModal(true); }} className="p-1.5 text-slate-600 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-all"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteId(driver.id)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <DriverModal driver={editDriver} onClose={() => { setShowModal(false); setEditDriver(null); }} onSave={() => { setShowModal(false); setEditDriver(null); fetchDrivers(); toast.success("Motorista salvo"); }} />}

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
