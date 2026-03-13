import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { getVehicleIconHtml } from '@/utils/vehicleIcons';

interface ReplayProps {
  token: string;
  onClose: () => void;
}

interface Device {
  deviceId: number;
  name: string;
  category: string;
}

interface ReplayPoint {
  lat: number;
  lng: number;
  speed: number;
  course: number;
  time: string;
}

interface ReplayStats {
  pontos: number;
  distancia: number;
  velMaxima: number;
  duracao: string;
}

const TILE_LAYERS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '© Esri',
    label: 'Satélite',
  },
  streets: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap',
    label: 'Ruas',
  },
  hybrid: {
    url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '© Google',
    label: 'Híbrido',
    subdomains: '0123',
  },
  terrain: {
    url: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: '© Google',
    label: 'Terreno',
    subdomains: '0123',
  },
};

const SPEED_MULTIPLIERS = [1, 2, 5, 10, 25, 50, 100] as const;
const MIN_STEP_DELAY = 20;
const MAX_STEP_DELAY = 2000;

// Dark theme CSS variables
const cssVariables = {
  '--color-bg-primary': '#1e293b',
  '--color-bg-secondary': '#0f172a',
  '--color-text-primary': '#f1f5f9',
  '--color-text-secondary': '#cbd5e1',
  '--color-border': '#334155',
  '--color-accent': '#3b82f6',
  '--color-accent-hover': '#2563eb',
  '--color-error': '#ef4444',
  '--color-success': '#22c55e',
  '--color-gray-route': '#475569',
} as React.CSSProperties;

// Map updater component to handle map state changes
function MapUpdater({
  center,
  zoom,
  shouldCenter,
}: {
  center: [number, number] | null;
  zoom: number;
  shouldCenter: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (shouldCenter && center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, shouldCenter, map]);

  return null;
}

export default function Replay({ token, onClose }: ReplayProps) {
  // UI State
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [tileLayer, setTileLayer] = useState<keyof typeof TILE_LAYERS>('streets');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Replay state
  const [replayData, setReplayData] = useState<ReplayPoint[]>([]);
  const [stats, setStats] = useState<ReplayStats | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<typeof SPEED_MULTIPLIERS[number]>(1);

  // References
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize date inputs with today's date
  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const fromDateTime = `${today}T00:00`;
    const toDateTime = now.toISOString().slice(0, 16);

    setFromDate(fromDateTime);
    setToDate(toDateTime);
  }, []);

  // Fetch devices on mount
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/tracking/devices', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error('Falha ao carregar dispositivos');

        const data = await response.json();
        const devicesList = data.devices || data;
        setDevices(devicesList);
        if (devicesList.length > 0) {
          setSelectedDevice(String(devicesList[0].deviceId));
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Erro ao carregar dispositivos'
        );
      }
    };

    fetchDevices();
  }, [token]);

  // Cleanup playback on unmount
  useEffect(() => {
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, []);

  // Stop playback when component unmounts
  useEffect(() => {
    return () => {
      setIsPlaying(false);
    };
  }, []);

  // Playback logic
  useEffect(() => {
    if (!isPlaying || replayData.length === 0) {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      return;
    }

    const playStep = () => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;

        if (nextIndex >= replayData.length) {
          setIsPlaying(false);
          return prevIndex;
        }

        const currentTime = new Date(replayData[prevIndex].time).getTime();
        const nextTime = new Date(replayData[nextIndex].time).getTime();
        const timeDiff = Math.max(nextTime - currentTime, 0);
        const delay = Math.max(
          MIN_STEP_DELAY,
          Math.min(timeDiff / speedMultiplier, MAX_STEP_DELAY)
        );

        if (playbackIntervalRef.current) {
          clearInterval(playbackIntervalRef.current);
        }

        playbackIntervalRef.current = setTimeout(() => {
          playStep();
        }, delay);

        return nextIndex;
      });
    };

    playStep();

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    };
  }, [isPlaying, replayData, speedMultiplier]);

  // Load route data
  const handleLoadRoute = useCallback(async () => {
    if (!selectedDevice || !fromDate || !toDate) {
      setError('Por favor, selecione um dispositivo e datas válidas');
      return;
    }

    setIsLoading(true);
    setError(null);
    setReplayData([]);
    setStats(null);
    setCurrentIndex(0);
    setIsPlaying(false);

    try {
      const fromISO = new Date(fromDate).toISOString();
      const toISO = new Date(toDate).toISOString();

      const response = await fetch(
        `/api/tracking/replay/${selectedDevice}?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao carregar dados da rota');
      }

      const data: ReplayPoint[] = await response.json();

      if (data.length === 0) {
        setError('Nenhum dado encontrado para o período selecionado');
        return;
      }

      setReplayData(data);

      // Calculate stats
      const calculatedStats = calculateStats(data);
      setStats(calculatedStats);
    } catch (err) {
      let errorMsg = 'Erro ao carregar dados da rota';
      if (err instanceof Error) {
        errorMsg = err.message;
      } else if (typeof err === 'object' && err !== null && 'response' in err) {
        const apiErr = err as any;
        errorMsg = apiErr.response?.data?.error || apiErr.response?.data?.message || errorMsg;
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDevice, fromDate, toDate, token]);

  // Calculate statistics from replay data
  const calculateStats = (data: ReplayPoint[]): ReplayStats => {
    if (data.length === 0) {
      return {
        pontos: 0,
        distancia: 0,
        velMaxima: 0,
        duracao: '0h 0min',
      };
    }

    const pontos = data.length;
    const velMaxima = Math.max(...data.map((p) => p.speed));

    // Calculate distance
    let distancia = 0;
    for (let i = 1; i < data.length; i++) {
      distancia += calculateDistance(
        data[i - 1].lat,
        data[i - 1].lng,
        data[i].lat,
        data[i].lng
      );
    }

    // Calculate duration
    const firstTime = new Date(data[0].time).getTime();
    const lastTime = new Date(data[data.length - 1].time).getTime();
    const durationMs = lastTime - firstTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const duracao = `${hours}h ${minutes}min`;

    return {
      pontos,
      distancia: Math.round(distancia * 100) / 100,
      velMaxima: Math.round(velMaxima),
      duracao,
    };
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number => {
    const R = 6371; // Radius of Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Player controls
  const handlePlayPause = () => {
    if (replayData.length === 0) return;

    if (isPlaying) {
      setIsPlaying(false);
    } else if (currentIndex < replayData.length - 1) {
      setIsPlaying(true);
    }
  };

  const handleStepBack = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleStepForward = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, replayData.length - 1));
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percentage = parseFloat(e.target.value);
    const newIndex = Math.round(
      (percentage / 100) * (replayData.length - 1)
    );
    setCurrentIndex(newIndex);
  };

  const handleExportVideo = () => {
    alert('Em breve!');
  };

  // Get current replay point
  const currentPoint =
    replayData.length > 0 ? replayData[currentIndex] : null;

  // Get progress trail (points from start to current)
  const progressTrail =
    replayData.length > 0
      ? replayData.slice(0, currentIndex + 1).map((p) => [p.lat, p.lng])
      : [];

  // Get full route
  const fullRoute =
    replayData.length > 0
      ? replayData.map((p) => [p.lat, p.lng])
      : [];

  // Get current position for map center
  const mapCenter: [number, number] | null = currentPoint
    ? [currentPoint.lat, currentPoint.lng]
    : null;

  // Format time display
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format speed display
  const currentSpeed = currentPoint ? Math.round(currentPoint.speed) : 0;

  // Calculate progress percentage
  const progressPercentage =
    replayData.length > 0
      ? (currentIndex / (replayData.length - 1)) * 100
      : 0;

  // Get marker icon
  const markerIcon = L.divIcon({
    html: getVehicleIconHtml(
      devices.find(d => d.deviceId === selectedDevice)?.category || 'car',
      currentPoint?.speed || 0,
      currentPoint?.course || 0,
    ),
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    className: '',
  });

  return (
    <div
      style={{
        ...cssVariables,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
      } as React.CSSProperties}
    >
      {/* Top Controls Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--color-bg-secondary)',
          borderBottom: '1px solid var(--color-border)',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flex: 1,
            minWidth: '0',
          }}
        >
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              fontSize: '14px',
              cursor: 'pointer',
              opacity: isLoading ? 0.5 : 1,
            }}
            disabled={isLoading}
          >
            <option value="">Selecione um dispositivo</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={String(device.deviceId)}>
                {device.name}
              </option>
            ))}
          </select>

          <input
            type="datetime-local"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              fontSize: '14px',
              opacity: isLoading ? 0.5 : 1,
            }}
            disabled={isLoading}
          />

          <input
            type="datetime-local"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              fontSize: '14px',
              opacity: isLoading ? 0.5 : 1,
            }}
            disabled={isLoading}
          />

          <button
            onClick={handleLoadRoute}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: isLoading || !selectedDevice ? 'var(--color-border)' : 'var(--color-accent)',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '14px',
              fontWeight: '500',
              cursor: isLoading || !selectedDevice ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
              opacity: isLoading || !selectedDevice ? 0.6 : 1,
            }}
            disabled={isLoading || !selectedDevice}
            onMouseEnter={(e) => {
              if (!isLoading && selectedDevice) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-accent-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && selectedDevice) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-accent)';
              }
            }}
          >
            {isLoading ? 'Carregando...' : 'Carregar Rota'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flex: 1,
            justifyContent: 'center',
          }}
        >
          {Object.entries(TILE_LAYERS).map(([key, layer]) => (
            <button
              key={key}
              onClick={() => setTileLayer(key as keyof typeof TILE_LAYERS)}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: tileLayer === key ? 'var(--color-accent)' : 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                border: `1px solid ${tileLayer === key ? 'var(--color-accent)' : 'var(--color-border)'}`,
                borderRadius: '0.375rem',
                fontSize: '12px',
                fontWeight: tileLayer === key ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title={layer.label}
            >
              {layer.label}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            padding: '0.5rem 0.75rem',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-error)',
            border: '1px solid var(--color-error)',
            borderRadius: '0.375rem',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="Fechar"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-error)';
            (e.currentTarget as HTMLButtonElement).style.color = 'white';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-bg-primary)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-error)';
          }}
        >
          ✕
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderBottom: '1px solid var(--color-error)',
            color: '#fca5a5',
            fontSize: '14px',
          }}
        >
          {error}
        </div>
      )}

      {/* Map Container */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {replayData.length > 0 ? (
          <MapContainer
            center={mapCenter || [0, 0]}
            zoom={17}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url={TILE_LAYERS[tileLayer].url}
              attribution={TILE_LAYERS[tileLayer].attribution}
              subdomains={(TILE_LAYERS[tileLayer] as any).subdomains}
            />

            {/* Full route */}
            {fullRoute.length > 1 && (
              <Polyline
                positions={fullRoute as [number, number][]}
                color="var(--color-gray-route)"
                weight={3}
                opacity={0.5}
              />
            )}

            {/* Progress trail */}
            {progressTrail.length > 1 && (
              <Polyline
                positions={progressTrail as [number, number][]}
                color="var(--color-success)"
                weight={4}
                opacity={0.9}
              />
            )}

            {/* Current position marker */}
            {currentPoint && (
              <Marker position={[currentPoint.lat, currentPoint.lng]} icon={markerIcon} />
            )}

            {/* Map updater for centering during playback */}
            <MapUpdater
              center={mapCenter}
              zoom={17}
              shouldCenter={isPlaying}
            />
          </MapContainer>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <p style={{ margin: 0, fontSize: '16px' }}>
              Selecione um dispositivo, defina datas e clique em "Carregar Rota"
            </p>
          </div>
        )}
      </div>

      {/* Bottom Player Bar */}
      {replayData.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: '1rem',
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-bg-secondary)',
              borderTop: '1px solid var(--color-border)',
              flexWrap: 'wrap',
              minHeight: '56px',
            }}
          >
            <button
              onClick={handleStepBack}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '0.375rem',
                fontSize: '16px',
                cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === 0 ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
              title="Voltar"
              disabled={currentIndex === 0}
              onMouseEnter={(e) => {
                if (currentIndex > 0) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentIndex > 0) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-bg-primary)';
                }
              }}
            >
              ⏮
            </button>

            <button
              onClick={handlePlayPause}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--color-accent)',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title={isPlaying ? 'Pausar' : 'Reproduzir'}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-accent-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-accent)';
              }}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            <button
              onClick={handleStepForward}
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '0.375rem',
                fontSize: '16px',
                cursor: currentIndex === replayData.length - 1 ? 'not-allowed' : 'pointer',
                opacity: currentIndex === replayData.length - 1 ? 0.5 : 1,
                transition: 'all 0.2s',
              }}
              title="Avançar"
              disabled={currentIndex === replayData.length - 1}
              onMouseEnter={(e) => {
                if (currentIndex < replayData.length - 1) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-accent)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentIndex < replayData.length - 1) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-bg-primary)';
                }
              }}
            >
              ⏭
            </button>

            <input
              type="range"
              min="0"
              max="100"
              value={progressPercentage}
              onChange={handleProgressChange}
              style={{
                flex: 1,
                minWidth: '150px',
                height: '6px',
                cursor: isPlaying ? 'not-allowed' : 'pointer',
                opacity: isPlaying ? 0.6 : 1,
              }}
              disabled={isPlaying}
            />

            <span
              style={{
                minWidth: '70px',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              {formatTime(currentPoint?.time || '')}
            </span>

            <span
              style={{
                minWidth: '65px',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              {currentSpeed} km/h
            </span>

            <span
              style={{
                minWidth: '50px',
                color: 'var(--color-text-secondary)',
                fontSize: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              {currentIndex + 1}/{replayData.length}
            </span>

            <select
              value={speedMultiplier}
              onChange={(e) =>
                setSpeedMultiplier(Number(e.target.value) as typeof SPEED_MULTIPLIERS[number])
              }
              style={{
                padding: '0.5rem 0.75rem',
                backgroundColor: isPlaying ? 'var(--color-bg-primary)' : 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '0.375rem',
                fontSize: '12px',
                cursor: isPlaying ? 'pointer' : 'not-allowed',
                opacity: isPlaying ? 1 : 0.5,
              }}
              disabled={!isPlaying}
            >
              {SPEED_MULTIPLIERS.map((mult) => (
                <option key={mult} value={mult}>
                  {mult}x
                </option>
              ))}
            </select>

            <button
              onClick={handleExportVideo}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: '0.375rem',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title="Exportar Vídeo"
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-accent)';
                (e.currentTarget as HTMLButtonElement).style.color = 'white';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--color-bg-primary)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)';
              }}
            >
              Exportar Vídeo
            </button>
          </div>

          {/* Stats Panel */}
          {stats && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-start',
                gap: '2rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-bg-secondary)',
                borderTop: '1px solid var(--color-border)',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.25rem',
                }}
              >
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                  Pontos
                </span>
                <span style={{ color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: '600' }}>
                  {stats.pontos}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.25rem',
                }}
              >
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                  Distância
                </span>
                <span style={{ color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: '600' }}>
                  {stats.distancia} km
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.25rem',
                }}
              >
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                  Vel. Máxima
                </span>
                <span style={{ color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: '600' }}>
                  {stats.velMaxima} km/h
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.25rem',
                }}
              >
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px' }}>
                  Duração
                </span>
                <span style={{ color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: '600' }}>
                  {stats.duracao}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
