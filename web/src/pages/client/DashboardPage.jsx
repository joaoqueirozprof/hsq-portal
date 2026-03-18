import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../../services/api';
import { Car, MapPin, Clock, Navigation, ChevronUp, ChevronDown, Maximize2, Minimize2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix para ícones do Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const carIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/744/744502.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 14);
    }
  }, [center, map]);
  return null;
}

export default function ClientDashboardPage() {
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [mapCenter, setMapCenter] = useState([-23.5505, -46.6333]);
  const [sheetOpen, setSheetOpen] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchPositions, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      const res = await api.get('/devices');
      setDevices(res.data);
      if (res.data.length > 0 && !selectedDevice) {
        setSelectedDevice(res.data[0]);
      }
    } catch (error) {
      console.error('Erro ao buscar dispositivos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const newPositions = {};
      for (const device of devices) {
        try {
          const res = await api.get(`/positions/${device.id}`);
          const data = Array.isArray(res.data) ? res.data[0] : res.data;
          if (data) {
            newPositions[device.id] = data;
          }
        } catch (e) {}
      }
      setPositions(newPositions);
    } catch (error) {
      console.error('Erro ao buscar posições:', error);
    }
  };

  const getMarkerPosition = (deviceId) => {
    const pos = positions[deviceId];
    if (pos && pos.latitude && pos.longitude) {
      return [pos.latitude, pos.longitude];
    }
    return null;
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR');
  };

  const formatSpeed = (speed) => {
    if (!speed) return '0 km/h';
    return `${Math.round(speed)} km/h`;
  };

  const handleDeviceSelect = (device) => {
    setSelectedDevice(device);
    const pos = positions[device.id];
    if (pos && pos.latitude && pos.longitude) {
      setMapCenter([pos.latitude, pos.longitude]);
    }
  };

  const onlineCount = devices.filter(d => {
    const pos = positions[d.id];
    return pos && pos.latitude;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={`relative ${fullscreen ? 'fixed inset-0 z-50' : 'h-full'} flex flex-col`}>
      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={13}
          className="h-full w-full"
          style={{ minHeight: fullscreen ? '100vh' : '400px' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUpdater center={mapCenter} />

          {devices.map((device) => {
            const pos = getMarkerPosition(device.id);
            if (!pos) return null;

            return (
              <Marker
                key={device.id}
                position={pos}
                icon={carIcon}
                eventHandlers={{
                  click: () => handleDeviceSelect(device),
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[150px]">
                    <h3 className="font-bold">{device.name}</h3>
                    <p className="text-sm">Velocidade: {formatSpeed(positions[device.id]?.attributes?.speed)}</p>
                    <p className="text-sm">Atualizado: {formatTime(positions[device.id]?.devicetime)}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {/* Fullscreen toggle */}
        <button
          onClick={() => setFullscreen(!fullscreen)}
          className="absolute top-4 right-4 z-[1000] bg-white p-3 rounded-full shadow-lg touch-target active:bg-gray-100"
        >
          {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </button>
      </div>

      {/* Bottom Sheet - Device List */}
      <div
        className={`
          ${fullscreen ? 'hidden' : 'relative'}
          bg-white rounded-t-2xl shadow-lg z-[1000] transition-all duration-300
          ${sheetOpen ? '' : ''}
        `}
        style={{ maxHeight: sheetOpen ? '50vh' : '80px', overflow: 'hidden' }}
      >
        {/* Handle */}
        <div
          className="flex items-center justify-center py-2 cursor-pointer"
          onClick={() => setSheetOpen(!sheetOpen)}
        >
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-4 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-gray-800">
              Meus Veículos
            </h2>
            <span className="text-sm text-gray-500">({onlineCount}/{devices.length})</span>
          </div>
          <button
            onClick={() => setSheetOpen(!sheetOpen)}
            className="p-2 hover:bg-gray-100 rounded-full touch-target"
          >
            {sheetOpen ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          </button>
        </div>

        {/* Device List */}
        <div className="px-4 pb-6 overflow-y-auto" style={{ maxHeight: 'calc(50vh - 80px)' }}>
          {devices.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Car className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum veículo vinculado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((device) => {
                const pos = positions[device.id];
                const hasPosition = pos && pos.latitude;
                const isSelected = selectedDevice?.id === device.id;

                return (
                  <div
                    key={device.id}
                    onClick={() => handleDeviceSelect(device)}
                    className={`
                      p-4 rounded-xl cursor-pointer transition-all touch-target
                      ${isSelected ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-gray-50 hover:bg-gray-100'}
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          hasPosition ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'
                        }`}>
                          <Car size={20} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{device.name}</h3>
                          <p className="text-xs text-gray-500">{device.uniqueId || 'Sem ID'}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        hasPosition ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {hasPosition ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    {hasPosition && (
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Navigation className="w-4 h-4" />
                          {formatSpeed(pos.attributes?.speed)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTime(pos.devicetime)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
