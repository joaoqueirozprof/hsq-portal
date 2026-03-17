import { useState, useEffect } from 'react';
import { geofencesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { MapPin, Plus, Edit, Trash2, X } from 'lucide-react';

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
    color: '#FF0000'
  });

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
      setFormData({ name: '', description: '', area: '', color: '#FF0000' });
      fetchGeofences();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar geofence');
    }
  };

  const handleEdit = (geofence) => {
    setEditingGeofence(geofence);
    setFormData({
      name: geofence.name,
      description: geofence.description || '',
      area: geofence.area || '',
      color: geofence.color || '#FF0000'
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta geofence?')) return;
    try {
      await geofencesAPI.delete(id);
      fetchGeofences();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir geofence');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Geofences</h1>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingGeofence(null);
              setFormData({ name: '', description: '', area: '', color: '#FF0000' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            Nova
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {geofences.map((geofence) => (
          <div key={geofence.id} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: geofence.color }}
                />
                <div>
                  <h3 className="font-semibold">{geofence.name}</h3>
                  <p className="text-sm text-gray-500">{geofence.description || 'Sem descrição'}</p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(geofence)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(geofence.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {geofences.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500">
            Nenhuma geofence encontrada
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {editingGeofence ? 'Editar Geofence' : 'Nova Geofence'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Área (WKT)</label>
                <textarea
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={3}
                  placeholder="POLYGON((-46.5 -23.5, -46.4 -23.5, -46.4 -23.6, -46.5 -23.6, -46.5 -23.5))"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 border rounded-lg cursor-pointer"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
