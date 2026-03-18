import { useState, useEffect } from 'react';
import { geofencesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MapPin, Plus, Edit, Trash2, X, AlertCircle, Check } from 'lucide-react';

const colorPresets = [
  '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#06b6d4'
];

export default function GeofencesPage() {
  const [geofences, setGeofences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [showModal, setShowModal] = useState(false);
  const [editingGeofence, setEditingGeofence] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    area: '',
    color: '#3b82f6'
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const fetchGeofences = async () => {
    try {
      const res = await geofencesAPI.list();
      setGeofences(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGeofences();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      const data = {
        name: formData.name,
        description: formData.description,
        area: formData.area,
        attributes: { color: formData.color }
      };

      if (editingGeofence) {
        await geofencesAPI.update(editingGeofence.id, data);
      } else {
        await geofencesAPI.create(data);
      }
      setShowModal(false);
      setEditingGeofence(null);
      setFormData({ name: '', description: '', area: '', color: '#3b82f6' });
      fetchGeofences();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Erro ao salvar geofence');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (geofence) => {
    setEditingGeofence(geofence);
    setFormData({
      name: geofence.name,
      description: geofence.description || '',
      area: geofence.area || '',
      color: geofence.color || '#3b82f6'
    });
    setShowModal(true);
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Tem certeza que deseja excluir a geocerca "${name}"?`)) return;
    try {
      await geofencesAPI.delete(id);
      fetchGeofences();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir geofence');
    }
  };

  const openCreateModal = () => {
    setEditingGeofence(null);
    setFormData({ name: '', description: '', area: '', color: '#3b82f6' });
    setFormError('');
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-dark-500">Carregando geocercas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 font-display">Geocercas</h1>
          <p className="text-dark-500 text-sm mt-1">
            {geofences.length} área{geofences.length !== 1 ? 's' : ''} monitorada{geofences.length !== 1 ? 's' : ''}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-glow-blue"
          >
            <Plus size={18} />
            <span>Nova Geocerca</span>
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-600 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-danger-400 hover:text-danger-600">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Geofences Grid */}
      {geofences.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <div className="w-20 h-20 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPin size={40} className="text-primary-500" />
          </div>
          <h3 className="text-lg font-semibold text-dark-700 mb-2">Nenhuma geocerca encontrada</h3>
          <p className="text-dark-500 mb-6">Crie sua primeira área monitorada para começar</p>
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 transition-colors"
            >
              <Plus size={18} />
              <span>Criar Geocerca</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {geofences.map((geofence, index) => (
            <div
              key={geofence.id}
              className="bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden group animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Color Header */}
              <div
                className="h-3"
                style={{ backgroundColor: geofence.color }}
              />

              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${geofence.color}20` }}
                    >
                      <MapPin size={20} style={{ color: geofence.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-dark-900">{geofence.name}</h3>
                      <p className="text-sm text-dark-500">
                        {geofence.description || 'Sem descrição'}
                      </p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(geofence)}
                        className="p-2 text-dark-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(geofence.id, geofence.name)}
                        className="p-2 text-dark-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Area Preview */}
                {geofence.area && (
                  <div className="p-3 bg-dark-50 rounded-xl">
                    <p className="text-xs text-dark-400 mb-1">Coordenadas</p>
                    <p className="text-xs font-mono text-dark-600 truncate">
                      {geofence.area.substring(0, 60)}...
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-dark-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-elevated w-full max-w-lg animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-dark-100">
              <div>
                <h2 className="text-xl font-bold text-dark-900">
                  {editingGeofence ? 'Editar Geocerca' : 'Nova Geocerca'}
                </h2>
                <p className="text-sm text-dark-500 mt-1">
                  {editingGeofence ? 'Atualize as informações da área' : 'Defina a nova área de monitoramento'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-dark-100 rounded-lg transition-colors">
                <X size={20} className="text-dark-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {formError && (
                <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-600 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-2">Nome da Geocerca *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-50 border border-dark-200 rounded-xl text-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Ex: Área do Depósito Central"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-2">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-50 border border-dark-200 rounded-xl text-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={2}
                  placeholder="Descrição opcional da área..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-2">Área (WKT) *</label>
                <textarea
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-50 border border-dark-200 rounded-xl text-dark-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={4}
                  placeholder="POLYGON((-46.5 -23.5, -46.4 -23.5, -46.4 -23.6, -46.5 -23.6, -46.5 -23.5))"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 mb-2">Cor</label>
                <div className="flex flex-wrap gap-2">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormData({ ...formData, color })}
                      className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${
                        formData.color === color
                          ? 'ring-2 ring-offset-2 ring-primary-500 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      {formData.color === color && (
                        <Check size={18} className="text-white" />
                      )}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="w-10 h-10 rounded-xl border border-dark-200 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border border-dark-200 rounded-xl text-dark-700 font-medium hover:bg-dark-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {formLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      <span>{editingGeofence ? 'Salvar Alterações' : 'Criar Geocerca'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
