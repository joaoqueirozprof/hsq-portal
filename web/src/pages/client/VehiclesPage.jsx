import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Car, MapPin, Clock, Navigation, Battery, Fuel, Gauge } from 'lucide-react';

export default function ClientVehiclesPage() {
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchPositions, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get('/devices');
      setDevices(res.data);
      await fetchPositionsForDevices(res.data);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPositionsForDevices = async (deviceList) => {
    const newPositions = {};
    for (const device of deviceList) {
      try {
        const res = await api.get(`/positions/${device.id}`);
        // API retorna array, pegar primeiro elemento
        const data = Array.isArray(res.data) ? res.data[0] : res.data;
        if (data) {
          newPositions[device.id] = data;
        }
      } catch (e) {}
    }
    setPositions(newPositions);
  };

  const fetchPositions = async () => {
    await fetchPositionsForDevices(devices);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const formatSpeed = (speed) => {
    if (!speed && speed !== 0) return '-';
    return `${Math.round(speed)} km/h`;
  };

  const getStatusBadge = (device) => {
    const pos = positions[device.id];
    if (!pos) return { label: 'Sem sinal', class: 'bg-gray-100 text-gray-600' };

    const lastUpdate = new Date(pos.devicetime);
    const now = new Date();
    const diffMinutes = (now - lastUpdate) / 1000 / 60;

    if (diffMinutes > 30) {
      return { label: 'Offline', class: 'bg-red-100 text-red-700' };
    } else if (diffMinutes > 5) {
      return { label: 'Inativo', class: 'bg-yellow-100 text-yellow-700' };
    }
    return { label: 'Online', class: 'bg-green-100 text-green-700' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Car className="w-7 h-7" />
          Meus Veículos
        </h1>
        <span className="text-gray-500">{devices.length} veículo(s)</span>
      </div>

      {devices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Car className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">Nenhum veículo encontrado</h3>
          <p className="text-gray-500">Entre em contato com o suporte para vinculos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {devices.map((device) => {
            const pos = positions[device.id];
            const status = getStatusBadge(device);

            return (
              <div key={device.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Car className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{device.name}</h3>
                      <p className="text-sm text-gray-500">{device.uniqueId || '-'}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${status.class}`}>
                    {status.label}
                  </span>
                </div>

                {/* Info */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Navigation className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-500">Velocidade</p>
                        <p className="font-medium">{formatSpeed(pos?.attributes?.speed)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Gauge className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-500">Odômetro</p>
                        <p className="font-medium">
                          {pos?.attributes?.totalDistance
                            ? `${(pos.attributes.totalDistance / 1000).toFixed(1)} km`
                            : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Battery className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-500">Bateria</p>
                        <p className="font-medium">
                          {pos?.attributes?.batteryLevel
                            ? `${pos.attributes.batteryLevel}%`
                            : '-'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Fuel className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-gray-500">Combustível</p>
                        <p className="font-medium">
                          {pos?.attributes?.fuelLevel
                            ? `${pos.attributes.fuelLevel}%`
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      Última atualização: {formatDateTime(pos?.devicetime)}
                    </div>
                    {pos?.latitude && pos?.longitude && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <MapPin className="w-4 h-4" />
                        {pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
