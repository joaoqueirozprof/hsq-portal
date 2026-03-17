import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { positionsAPI, devicesAPI } from '../services/api';
import { Car, MapPin, Navigation, Clock } from 'lucide-react';

// Custom marker icon
const createIcon = (status) => {
  const color = status === 'online' ? '#22c55e' : '#6b7280';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background: ${color};
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

function MapUpdater({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, []);

  return null;
}

export default function DashboardPage() {
  const [positions, setPositions] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const fetchData = async () => {
    try {
      const [posRes, devRes] = await Promise.all([
        positionsAPI.list(),
        devicesAPI.list()
      ]);
      setPositions(posRes.data || []);
      setDevices(devRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const onlineCount = positions.filter(p => p.status === 'online').length;

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
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <span className="text-sm text-gray-500">
          Atualizado em {new Date().toLocaleTimeString()}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Car className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{devices.length}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Navigation className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{onlineCount}</p>
              <p className="text-sm text-gray-500">Online</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-100 rounded-lg">
              <MapPin className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{devices.length - onlineCount}</p>
              <p className="text-sm text-gray-500">Offline</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">10s</p>
              <p className="text-sm text-gray-500">Atualização</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="h-[500px]">
          <MapContainer
            center={[-23.55, -46.63]}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapUpdater positions={positions} />

            {positions.map((pos) => (
              <Marker
                key={pos.deviceId}
                position={[pos.lat, pos.lng]}
                icon={createIcon(pos.status)}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-semibold">{pos.deviceName}</h3>
                    <p className="text-sm text-gray-600">ID: {pos.uniqueId}</p>
                    <p className="text-sm">Velocidade: {pos.speed} km/h</p>
                    <p className="text-sm text-gray-500">
                      {new Date(pos.timestamp).toLocaleString()}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Device List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-gray-800">Veículos</h2>
        </div>
        <div className="divide-y max-h-64 overflow-auto">
          {devices.map((device) => {
            const pos = positions.find(p => p.deviceId === device.id);
            return (
              <div
                key={device.id}
                className="p-4 hover:bg-gray-50 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${pos ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <div>
                    <p className="font-medium">{device.name}</p>
                    <p className="text-sm text-gray-500">{device.uniqueId}</p>
                  </div>
                </div>
                {pos && (
                  <div className="text-right">
                    <p className="text-sm font-medium">{pos.speed} km/h</p>
                    <p className="text-xs text-gray-500">
                      {new Date(pos.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
