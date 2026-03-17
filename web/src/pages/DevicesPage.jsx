import { useState, useEffect } from 'react';
import { devicesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit, Trash2, Car, X } from 'lucide-react';

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [showModal, setShowModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    uniqueId: '',
    phone: '',
    model: '',
    contact: ''
  });

  const fetchDevices = async () => {
    try {
      const res = await devicesAPI.list();
      setDevices(res.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        await devicesAPI.update(editingDevice.id, formData);
      } else {
        await devicesAPI.create(formData);
      }
      setShowModal(false);
      setEditingDevice(null);
      setFormData({ name: '', uniqueId: '', phone: '', model: '', contact: '' });
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar dispositivo');
    }
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      uniqueId: device.uniqueId,
      phone: device.attributes?.phone || '',
      model: device.attributes?.model || '',
      contact: device.attributes?.contact || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este dispositivo?')) return;
    try {
      await devicesAPI.delete(id);
      fetchDevices();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao excluir dispositivo');
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
        <h1 className="text-2xl font-bold text-gray-800">Dispositivos</h1>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingDevice(null);
              setFormData({ name: '', uniqueId: '', phone: '', model: '', contact: '' });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
            Novo
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID Único</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Última Atualização</th>
              {isAdmin && <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-gray-400" />
                    <span className="font-medium">{device.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500">{device.uniqueId}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    device.status === 'online'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {device.status || 'offline'}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {device.lastUpdate ? new Date(device.lastUpdate).toLocaleString() : '-'}
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleEdit(device)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(device.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {devices.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Nenhum dispositivo encontrado
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {editingDevice ? 'Editar Dispositivo' : 'Novo Dispositivo'}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">ID Único</label>
                <input
                  type="text"
                  value={formData.uniqueId}
                  onChange={(e) => setFormData({ ...formData, uniqueId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contato</label>
                <input
                  type="text"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
