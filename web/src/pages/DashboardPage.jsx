import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { positionsAPI, devicesAPI } from '../services/api';
import {
  Car, MapPin, Navigation, Clock, Play, Pause, RotateCcw,
  Activity, Zap, Route, Gauge, TrendingUp, Radio
} from 'lucide-react';

// Custom marker icons with premium styling
const createIcon = (status, isSelected = false) => {
  const color = status === 'online' ? '#22c55e' : '#64748b';
  const size = isSelected ? 44 : 36;
  const pulse = status === 'online' ? `
    <div style="
      position: absolute;
      width: ${size * 2}px;
      height: ${size * 2}px;
      border-radius: 50%;
      background: ${color};
      opacity: 0.2;
      animation: pulse 2s infinite;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    "></div>
  ` : '';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <style>
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.2; }
          50% { transform: translate(-50%, -50%) scale(1.3); opacity: 0.1; }
        }
      </style>
      <div style="position: relative;">
        ${pulse}
        <div style="
          background: ${color};
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3), 0 0 20px ${color}40;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 1;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="${size * 0.45}" height="${size * 0.45}" viewBox="0 0 24 24" fill="white">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

const createReplayIcon = (color = '#8b5cf6') => {
  return L.divIcon({
    className: 'replay-marker',
    html: `<div style="
      background: ${color};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4), 0 0 20px ${color}60;
      position: relative;
    ">
      <div style="
        position: absolute;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: 2px solid ${color};
        opacity: 0.3;
        top: -16px;
        left: -16px;
        animation: replayPulse 1.5s infinite;
      "></div>
    </div>
    <style>
      @keyframes replayPulse {
        0%, 100% { transform: scale(1); opacity: 0.3; }
        50% { transform: scale(1.2); opacity: 0.1; }
      }
    </style>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

function MapUpdater({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (!positions || positions.length === 0) return;

    try {
      const validPositions = positions.filter(p => p && p.lat != null && p.lng != null);
      if (validPositions.length > 0) {
        const bounds = L.latLngBounds(validPositions.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } catch (err) {
      console.error('MapUpdater error:', err);
    }
  }, [positions, map]);

  return null;
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, subtext, color, trend }) {
  return (
    <div className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-card hover:shadow-card-hover transition-all duration-300 group animate-slide-up">
      {/* Background Glow */}
      <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full bg-${color}/10 blur-2xl group-hover:scale-150 transition-transform duration-500`} />

      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-${color}/10 mb-3`}>
            <Icon size={14} className={`text-${color}`} />
            <span className={`text-xs font-medium text-${color}`}>{label}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-dark-900 font-display">{value}</p>
            {trend && (
              <span className={`text-sm font-medium ${trend > 0 ? 'text-success-500' : 'text-danger-500'}`}>
                {trend > 0 ? '+' : ''}{trend}%
              </span>
            )}
          </div>
          {subtext && (
            <p className="text-sm text-dark-500 mt-1">{subtext}</p>
          )}
        </div>

        {/* Icon */}
        <div className={`p-3 rounded-xl bg-${color}/10 group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={24} className={`text-${color}`} />
        </div>
      </div>
    </div>
  );
}

// Vehicle Card Component
function VehicleCard({ device, position, onClick, isSelected }) {
  const speed = position?.speed || 0;
  const status = position ? 'online' : 'offline';

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-xl cursor-pointer transition-all duration-200
        ${isSelected
          ? 'bg-primary-50 border-2 border-primary-500 shadow-glow-blue'
          : 'bg-white border border-dark-200 hover:border-primary-300 hover:shadow-card'
        }
      `}
    >
      <div className="flex items-center gap-4">
        {/* Status Indicator */}
        <div className="relative">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            status === 'online' ? 'bg-success-500/10' : 'bg-dark-200'
          }`}>
            <Car size={24} className={status === 'online' ? 'text-success-500' : 'text-dark-400'} />
          </div>
          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
            status === 'online' ? 'bg-success-500' : 'bg-dark-400'
          }`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-dark-900 truncate">{device.name}</p>
          <p className="text-sm text-dark-500 font-mono">{device.uniqueId}</p>
        </div>

        {/* Speed */}
        {position && (
          <div className="text-right">
            <p className="text-lg font-bold text-dark-900">{speed} <span className="text-sm font-normal text-dark-500">km/h</span></p>
            <p className="text-xs text-dark-400">
              {position.timestamp ? new Date(position.timestamp).toLocaleTimeString('pt-BR') : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [devices, setDevices] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Replay states
  const [showReplay, setShowReplay] = useState(false);
  const [replayPositions, setReplayPositions] = useState([]);
  const [replayDevice, setReplayDevice] = useState(null);
  const [replayDate, setReplayDate] = useState('');
  const [currentPosition, setCurrentPosition] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000);
  const [replayLoading, setReplayLoading] = useState(false);
  const playbackRef = useRef(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);

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
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Replay animation
  useEffect(() => {
    if (playbackRef.current) {
      clearInterval(playbackRef.current);
      playbackRef.current = null;
    }

    if (!isPlaying || replayPositions.length === 0) return;

    playbackRef.current = setInterval(() => {
      setPlaybackIndex(prev => {
        const nextIndex = prev + 1;
        if (nextIndex >= replayPositions.length) {
          setIsPlaying(false);
          return prev;
        }
        const newPos = replayPositions[nextIndex];
        if (newPos) {
          setCurrentPosition(newPos);
        }
        return nextIndex;
      });
    }, playbackSpeed);

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
        playbackRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, replayPositions]);

  const startReplay = async () => {
    if (!replayDevice || !replayDate) {
      setError('Selecione um dispositivo e data');
      return;
    }

    setReplayLoading(true);
    setError(null);

    try {
      const from = `${replayDate}T00:00:00`;
      const to = `${replayDate}T23:59:59`;

      const res = await positionsAPI.history(replayDevice, from, to);
      const positions = res.data || [];

      if (positions.length === 0) {
        setError('Não há dados de posições para esta data');
        setReplayLoading(false);
        return;
      }

      const formatted = positions.map(p => ({
        lat: p.lat || p.latitude,
        lng: p.lng || p.longitude,
        speed: p.speed || 0,
        course: p.course || 0,
        time: p.time || p.fixTime
      }));

      setReplayPositions(formatted);
      setPlaybackIndex(0);
      setCurrentPosition(formatted[0]);
      setShowReplay(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setReplayLoading(false);
    }
  };

  const togglePlay = () => {
    if (playbackIndex >= replayPositions.length - 1) {
      setPlaybackIndex(0);
      setCurrentPosition(replayPositions[0]);
    }
    setIsPlaying(!isPlaying);
  };

  const resetReplay = () => {
    setIsPlaying(false);
    setPlaybackIndex(0);
    setCurrentPosition(replayPositions[0]);
  };

  const stopReplay = () => {
    setIsPlaying(false);
    setShowReplay(false);
    setReplayPositions([]);
    setCurrentPosition(null);
    setPlaybackIndex(0);
  };

  const onlineCount = devices.filter(d => positions.some(p => p.deviceId === d.id)).length;
  const offlineCount = devices.length - onlineCount;
  const avgSpeed = positions.length > 0
    ? Math.round(positions.reduce((acc, p) => acc + (p.speed || 0), 0) / positions.length)
    : 0;

  // Loading skeleton
  if (loading && positions.length === 0 && devices.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-dark-100 rounded-2xl" />
          ))}
        </div>
        <div className="h-[500px] bg-dark-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 font-display">Visão Geral</h1>
          <p className="text-dark-500 text-sm mt-1">
            Última atualização: {new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>

        <button
          onClick={() => {
            setShowReplay(true);
            setReplayDevice(null);
            setReplayDate('');
            setReplayPositions([]);
            setCurrentPosition(null);
            setPlaybackIndex(0);
            setIsPlaying(false);
            setError(null);
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-500 to-accent-600 text-white font-medium rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all duration-200 shadow-glow-orange hover:scale-[1.02]"
        >
          <Route size={18} />
          <span>Replay de Rota</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Car}
          label="Total de Veículos"
          value={devices.length}
          subtext="dispositivos registrados"
          color="primary"
        />
        <StatCard
          icon={Radio}
          label="Online"
          value={onlineCount}
          subtext="em funcionamento"
          color="success"
          trend={12}
        />
        <StatCard
          icon={Gauge}
          label="Velocidade Média"
          value={`${avgSpeed} km/h`}
          subtext="por veículo"
          color="accent"
        />
        <StatCard
          icon={TrendingUp}
          label="Taxa de Atividade"
          value={`${Math.round((onlineCount / devices.length) * 100)}%`}
          subtext="últimas 24h"
          color="primary"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-600 animate-slide-up">
          <div className="flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Map */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="h-[450px] relative">
            <MapContainer
              center={[-23.55, -46.63]}
              zoom={10}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapUpdater positions={showReplay && replayPositions.length > 0 ? replayPositions : positions} />

              {/* Replay Path */}
              {showReplay && replayPositions.length > 0 && (
                <Polyline
                  positions={replayPositions.map(p => [p.lat, p.lng])}
                  pathOptions={{ color: '#8b5cf6', weight: 4, opacity: 0.8 }}
                />
              )}

              {/* Current Replay Position */}
              {showReplay && currentPosition && (
                <Marker
                  position={[currentPosition.lat, currentPosition.lng]}
                  icon={createReplayIcon()}
                >
                  <Popup>
                    <div className="p-2 min-w-[150px]">
                      <p className="font-semibold text-dark-900">Replay de Rota</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <p>Velocidade: <span className="font-medium">{Math.round(currentPosition.speed * 1.852)} km/h</span></p>
                        <p>Horário: <span className="font-medium">{currentPosition.time ? new Date(currentPosition.time).toLocaleTimeString('pt-BR') : '-'}</span></p>
                        <p>Posição: <span className="font-medium">{playbackIndex + 1} / {replayPositions.length}</span></p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )}

              {/* Regular Positions */}
              {!showReplay && positions.map((pos) => (
                <Marker
                  key={pos.deviceId}
                  position={[pos.lat, pos.lng]}
                  icon={createIcon(pos.status, selectedVehicleId === pos.deviceId)}
                  eventHandlers={{
                    click: () => setSelectedVehicleId(pos.deviceId)
                  }}
                >
                  <Popup>
                    <div className="p-2 min-w-[160px]">
                      <h3 className="font-semibold text-dark-900">{pos.deviceName}</h3>
                      <div className="mt-2 space-y-1 text-sm text-dark-600">
                        <p>ID: <span className="font-mono">{pos.uniqueId}</span></p>
                        <p>Velocidade: <span className="font-medium">{pos.speed} km/h</span></p>
                        <p>Última atualização: <span className="font-medium">{new Date(pos.timestamp).toLocaleString('pt-BR')}</span></p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Map Overlay Controls */}
            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-card text-sm font-medium text-dark-700">
                {positions.length} veículos no mapa
              </div>
            </div>
          </div>

          {/* Replay Controls */}
          {showReplay && (
            <div className="p-4 border-t border-dark-100 bg-gradient-to-r from-purple-50 to-indigo-50">
              <div className="flex flex-wrap items-end gap-4">
                {/* Config */}
                <div className="flex flex-wrap items-end gap-3 flex-1">
                  <div>
                    <label className="block text-xs font-medium text-dark-500 mb-1">Veículo</label>
                    <select
                      value={replayDevice || ''}
                      onChange={(e) => setReplayDevice(e.target.value)}
                      disabled={isPlaying || replayLoading}
                      className="px-3 py-2 bg-white border border-dark-200 rounded-lg text-sm disabled:opacity-50"
                    >
                      <option value="">Selecione...</option>
                      {devices.map((device) => (
                        <option key={device.id} value={device.id}>{device.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-dark-500 mb-1">Data</label>
                    <input
                      type="date"
                      value={replayDate}
                      onChange={(e) => setReplayDate(e.target.value)}
                      disabled={isPlaying || replayLoading}
                      className="px-3 py-2 bg-white border border-dark-200 rounded-lg text-sm disabled:opacity-50"
                    />
                  </div>

                  <button
                    onClick={startReplay}
                    disabled={!replayDevice || !replayDate || isPlaying || replayLoading}
                    className="px-4 py-2 bg-accent-500 text-white rounded-lg text-sm font-medium hover:bg-accent-600 disabled:opacity-50 transition-colors"
                  >
                    {replayLoading ? 'Carregando...' : 'Carregar'}
                  </button>
                </div>

                {/* Playback Controls */}
                {replayPositions.length > 0 && (
                  <div className="flex items-center gap-3 w-full xl:w-auto">
                    <button onClick={togglePlay} className="p-2.5 bg-accent-500 text-white rounded-full hover:bg-accent-600 transition-colors">
                      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button onClick={resetReplay} className="p-2.5 bg-dark-200 text-dark-600 rounded-full hover:bg-dark-300 transition-colors">
                      <RotateCcw size={18} />
                    </button>

                    <div className="flex-1">
                      <input
                        type="range"
                        min={0}
                        max={replayPositions.length - 1}
                        value={playbackIndex}
                        onChange={(e) => {
                          const idx = parseInt(e.target.value);
                          setPlaybackIndex(idx);
                          setCurrentPosition(replayPositions[idx]);
                        }}
                        className="w-full h-2 bg-dark-200 rounded-lg appearance-none cursor-pointer accent-accent-500"
                      />
                      <div className="flex justify-between text-xs text-dark-500 mt-1">
                        <span>{currentPosition?.time ? new Date(currentPosition.time).toLocaleTimeString('pt-BR') : '--:--'}</span>
                        <span>{playbackIndex + 1} / {replayPositions.length}</span>
                      </div>
                    </div>

                    <button onClick={stopReplay} className="px-3 py-2 bg-danger-500/10 text-danger-600 rounded-lg text-sm hover:bg-danger-500/20 transition-colors">
                      Fechar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Vehicle List */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 border-b border-dark-100">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-dark-900">Veículos</h2>
              <span className="text-xs text-dark-500 font-mono bg-dark-100 px-2 py-1 rounded">
                {devices.length} total
              </span>
            </div>
          </div>

          <div className="divide-y divide-dark-100 max-h-[400px] overflow-y-auto">
            {devices.length === 0 ? (
              <div className="p-8 text-center">
                <Car size={40} className="mx-auto text-dark-300 mb-3" />
                <p className="text-dark-500">Nenhum veículo encontrado</p>
              </div>
            ) : (
              devices.map((device) => {
                const pos = positions.find(p => p.deviceId === device.id);
                return (
                  <VehicleCard
                    key={device.id}
                    device={device}
                    position={pos}
                    isSelected={selectedVehicleId === device.id}
                    onClick={() => setSelectedVehicleId(device.id)}
                  />
                );
              })
            )}
          </div>

          {/* Legend */}
          <div className="p-4 bg-dark-50 border-t border-dark-100">
            <div className="flex items-center gap-4 text-xs text-dark-500">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-success-500" />
                <span>Online</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-dark-400" />
                <span>Offline</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
