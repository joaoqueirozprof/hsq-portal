import { useState, useEffect } from "react";
import { api } from "../services/api";
import { Shield, Plus, Edit2, Trash2, Search, RefreshCw, User, Crown, Key } from "lucide-react";

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    password: "",
    role: user?.role || "user",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) { setError("Nome e e-mail são obrigatórios"); return; }
    if (!user && !form.password) { setError("Senha obrigatória para novo usuário"); return; }
    setLoading(true); setError("");
    try {
      const payload = { name: form.name, email: form.email, role: form.role };
      if (form.password) payload.password = form.password;
      if (user) { await api.put(`/users/${user.id}`, payload); }
      else { await api.post("/users", payload); }
      onSave();
    } catch (err) { setError(err.response?.data?.error || "Erro ao salvar"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-100">{user ? "Editar Usuário" : "Novo Usuário"}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
            <div>
              <label className="label">Nome Completo *</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nome do usuário" />
            </div>
            <div>
              <label className="label">E-mail *</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@exemplo.com" disabled={!!user} />
            </div>
            <div>
              <label className="label">{user ? "Nova Senha (deixe vazio para manter)" : "Senha *"}</label>
              <input type="password" className="input" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="••••••••" />
            </div>
            <div>
              <label className="label">Perfil</label>
              <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </select>
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

function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError("Senha deve ter pelo menos 6 caracteres"); return; }
    setLoading(true); setError("");
    try {
      await api.put(`/users/${user.id}`, { password });
      setDone(true);
    } catch (err) { setError(err.response?.data?.error || "Erro ao redefinir senha"); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal max-w-sm">
        <div className="modal-header">
          <h3 className="font-semibold text-slate-100">Redefinir Senha</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 text-lg leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {done ? (
              <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">Senha redefinida com sucesso!</div>
            ) : (
              <>
                {error && <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
                <p className="text-slate-400 text-sm">Definir nova senha para <strong className="text-slate-200">{user.name}</strong></p>
                <div>
                  <label className="label">Nova Senha</label>
                  <input type="password" className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoFocus />
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">{done ? "Fechar" : "Cancelar"}</button>
            {!done && (
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Redefinir"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    try { const res = await api.get("/users"); setUsers(res.data || []); }
    catch (e) { setUsers([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleDelete = async (id) => {
    try { await api.delete(`/users/${id}`); setUsers(p => p.filter(u => u.id !== id)); setDeleteId(null); }
    catch (e) { console.error(e); }
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100" style={{fontFamily:"Space Grotesk,sans-serif"}}>Usuários do Portal</h1>
          <p className="text-slate-500 text-sm mt-0.5">{users.length} usuários cadastrados</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchUsers} className="btn-ghost"><RefreshCw size={15} /></button>
          <button onClick={() => { setEditUser(null); setShowModal(true); }} className="btn-primary">
            <Plus size={15} />Novo Usuário
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-slate-500 text-xs">Total</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{users.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-slate-500 text-xs">Admins</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{users.filter(u => u.role === "admin").length}</p>
        </div>
        <div className="card p-4">
          <p className="text-slate-500 text-xs">Usuários</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{users.filter(u => u.role === "user").length}</p>
        </div>
      </div>

      <div className="relative w-full sm:w-80">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input className="input pl-10" placeholder="Buscar usuário..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-7 h-7 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center"><Shield size={36} className="mx-auto text-slate-700 mb-3" /><p className="text-slate-500 text-sm">Nenhum usuário encontrado</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Usuário</th><th>E-mail</th><th>Perfil</th><th>Último Acesso</th><th></th></tr></thead>
              <tbody>
                {filtered.map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${user.role === "admin" ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-blue-600/10 border border-blue-600/20"}`}>
                          {user.role === "admin" ? <Crown size={14} className="text-yellow-400" /> : <User size={14} className="text-blue-400" />}
                        </div>
                        <span className="font-medium text-slate-100 text-sm">{user.name}</span>
                      </div>
                    </td>
                    <td><span className="text-slate-400 text-xs">{user.email}</span></td>
                    <td>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium ${user.role === "admin" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
                        {user.role === "admin" ? "Admin" : "Usuário"}
                      </span>
                    </td>
                    <td><span className="text-slate-500 text-xs">{user.last_login ? new Date(user.last_login).toLocaleString("pt-BR") : "Nunca"}</span></td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setResetUser(user); setShowResetModal(true); }} title="Redefinir senha" className="p-1.5 text-slate-600 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-all"><Key size={13} /></button>
                        <button onClick={() => { setEditUser(user); setShowModal(true); }} className="p-1.5 text-slate-600 hover:text-blue-400 hover:bg-blue-600/10 rounded-lg transition-all"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteId(user.id)} className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <UserModal user={editUser} onClose={() => { setShowModal(false); setEditUser(null); }} onSave={() => { setShowModal(false); setEditUser(null); fetchUsers(); }} />}
      {showResetModal && resetUser && <ResetPasswordModal user={resetUser} onClose={() => { setShowResetModal(false); setResetUser(null); }} />}

      {deleteId && (
        <div className="modal-overlay">
          <div className="modal max-w-sm">
            <div className="modal-body text-center py-8">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4"><Trash2 size={20} className="text-red-500" /></div>
              <h3 className="font-semibold text-slate-100 mb-1">Confirmar exclusão</h3>
              <p className="text-slate-500 text-sm">O usuário perderá acesso ao portal.</p>
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
