import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';

interface Geofence {
  id: string;
  name: string;
  area: string;
  attributes?: Record<string, unknown>;
}

interface ParsedGeofence extends Geofence {
  lat: number;
  lng: number;
  radius: number;
}

interface GeofencesProps {
  token: string;
  onClose: () => void;
}

interface FormState {
  name: string;
  radius: number;
  lat: number | null;
  lng: number | null;
}

/**
 * Parses geofence area string in format "CIRCLE (lat lng, radius)"
 * Returns { lat, lng, radius } or null if parsing fails
 */
function parseGeofenceArea(area: string): {
  lat: number;
  lng: number;
  radius: number;
} | null {
  const match = area.match(/CIRCLE\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*,\s*([\d.]+)\s*\)/);
  if (!match) return null;

  return {
    lat: parseFloat(match[1]),
    lng: parseFloat(match[2]),
    radius: parseFloat(match[3]),
  };
}

/**
 * Formats geofence coordinates to area string
 */
function formatGeofenceArea(lat: number, lng: number, radius: number): string {
  return `CIRCLE (${lat} ${lng}, ${radius})`;
}

/**
 * Map click handler component
 */
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Geofences Management Component
 */
export default function Geofences({ token, onClose }: GeofencesProps) {
  const [geofences, setGeofences] = useState<ParsedGeofence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [formState, setFormState] = useState<FormState>({
    name: '',
    radius: 500,
    lat: null,
    lng: null,
  });

  const [mapCenter, setMapCenter] = useState<[number, number]>([-15.8, -48.0]); // Brazil center

  // Load geofences on mount
  useEffect(() => {
    loadGeofences();
  }, []);

  const loadGeofences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/tracking/geofences', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? 'Não autorizado'
            : 'Erro ao carregar geocercas'
        );
      }

      const data: Geofence[] = await response.json();
      const parsed = data
        .map((gf) => {
          const parsed = parseGeofenceArea(gf.area);
          if (!parsed) return null;
          return { ...gf, ...parsed };
        })
        .filter((gf): gf is ParsedGeofence => gf !== null);

      setGeofences(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    setFormState((prev) => ({ ...prev, lat, lng }));
  }, []);

  const handleCreateGeofence = useCallback(async () => {
    if (!formState.name || formState.lat === null || formState.lng === null) {
      setError('Preencha todos os campos');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const area = formatGeofenceArea(
        formState.lat,
        formState.lng,
        formState.radius
      );

      const response = await fetch('/api/tracking/geofences', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formState.name,
          area,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao criar geocerca');
      }

      await loadGeofences();
      setFormState({
        name: '',
        radius: 500,
        lat: null,
        lng: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setCreating(false);
    }
  }, [formState, token, loadGeofences]);

  const handleDeleteGeofence = useCallback(
    async (id: string) => {
      try {
        setDeleting(id);
        setError(null);

        const response = await fetch(`/api/tracking/geofences/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao deletar geocerca');
        }

        await loadGeofences();
        setDeleteConfirm(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setDeleting(null);
      }
    },
    [token, loadGeofences]
  );

  const isFormValid =
    formState.name.trim() && formState.lat !== null && formState.lng !== null;

  // Marker for clicked position on map
  const mapMarker = useMemo(() => {
    if (formState.lat === null || formState.lng === null) return null;
    return (
      <Marker
        position={[formState.lat, formState.lng]}
        icon={L.icon({
          iconUrl:
            'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
          shadowUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        })}
      />
    );
  }, [formState.lat, formState.lng]);

  // Circle for new geofence preview
  const newGeofenceCircle = useMemo(() => {
    if (formState.lat === null || formState.lng === null) return null;
    return (
      <Circle
        center={[formState.lat, formState.lng]}
        radius={formState.radius}
        color="#fbbf24"
        fill
        fillOpacity={0.1}
        weight={2}
      />
    );
  }, [formState.lat, formState.lng, formState.radius]);

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    backgroundColor: '#1e293b',
    borderBottom: '1px solid #334155',
    zIndex: 10,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 600,
    margin: 0,
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#e2e8f0',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  };

  const sidebarStyle: React.CSSProperties = {
    width: '300px',
    backgroundColor: '#1e293b',
    borderRight: '1px solid #334155',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const formSectionStyle: React.CSSProperties = {
    padding: '16px',
    borderBottom: '1px solid #334155',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    margin: '0 0 12px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#cbd5e1',
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '4px',
    color: '#e2e8f0',
    fontSize: '14px',
    fontFamily: 'inherit',
  };

  const coordinatesStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '12px',
    padding: '8px',
    backgroundColor: '#0f172a',
    borderRadius: '4px',
    fontFamily: 'monospace',
  };

  const instructionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '12px',
    padding: '8px',
    backgroundColor: '#0f172a',
    borderRadius: '4px',
    fontStyle: 'italic',
  };

  const createButtonStyle: React.CSSProperties = {
    padding: '10px 16px',
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'background-color 0.2s',
  };

  const createButtonDisabledStyle: React.CSSProperties = {
    ...createButtonStyle,
    backgroundColor: '#475569',
    cursor: 'not-allowed',
    opacity: 0.6,
  };

  const errorStyle: React.CSSProperties = {
    padding: '12px 16px',
    backgroundColor: '#7f1d1d',
    borderLeft: '3px solid #dc2626',
    color: '#fca5a5',
    fontSize: '12px',
    margin: '8px 16px 0 16px',
    borderRadius: '4px',
  };

  const listSectionStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: '16px',
  };

  const loadingStyle: React.CSSProperties = {
    textAlign: 'center',
    color: '#94a3b8',
    padding: '20px',
    fontSize: '14px',
  };

  const emptyStyle: React.CSSProperties = {
    textAlign: 'center',
    color: '#64748b',
    padding: '20px',
    fontSize: '14px',
  };

  const listStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const listItemStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  };

  const listItemContentStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0,
  };

  const listItemNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: '#e2e8f0',
    wordBreak: 'break-word',
  };

  const listItemDetailsStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#94a3b8',
  };

  const deleteButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
    flexShrink: 0,
  };

  const confirmDeleteStyle: React.CSSProperties = {
    display: 'flex',
    gap: '4px',
    flexShrink: 0,
  };

  const confirmButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: '#dc2626',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'background-color 0.2s',
  };

  const confirmButtonDisabledStyle: React.CSSProperties = {
    ...confirmButtonStyle,
    backgroundColor: '#7f1d1d',
    cursor: 'not-allowed',
    opacity: 0.6,
  };

  const cancelButtonStyle: React.CSSProperties = {
    padding: '6px 12px',
    backgroundColor: '#475569',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'background-color 0.2s',
  };

  const cancelButtonDisabledStyle: React.CSSProperties = {
    ...cancelButtonStyle,
    cursor: 'not-allowed',
    opacity: 0.6,
  };

  const mapContainerStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  };

  const mapStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>Geocercas</h1>
        <button style={closeButtonStyle} onClick={onClose}>
          ✕
        </button>
      </div>

      <div style={contentStyle}>
        {/* Left sidebar */}
        <div style={sidebarStyle}>
          {/* Create form */}
          <div style={formSectionStyle}>
            <h2 style={sectionTitleStyle}>Criar Geocerca</h2>

            <div style={formGroupStyle}>
              <label style={labelStyle}>Nome</label>
              <input
                type="text"
                style={inputStyle}
                value={formState.name}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Nome da geocerca"
              />
            </div>

            <div style={formGroupStyle}>
              <label style={labelStyle}>Raio (metros)</label>
              <input
                type="number"
                style={inputStyle}
                value={formState.radius}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    radius: Math.max(1, parseInt(e.target.value) || 500),
                  }))
                }
                min="1"
                step="100"
              />
            </div>

            {formState.lat !== null && formState.lng !== null ? (
              <div style={coordinatesStyle}>
                <div>Lat: {formState.lat.toFixed(6)}</div>
                <div>Lng: {formState.lng.toFixed(6)}</div>
              </div>
            ) : (
              <div style={instructionStyle}>
                Clique no mapa para posicionar
              </div>
            )}

            <button
              style={!isFormValid || creating ? createButtonDisabledStyle : createButtonStyle}
              onClick={handleCreateGeofence}
              disabled={!isFormValid || creating}
            >
              {creating ? 'Criando...' : 'Criar Geocerca'}
            </button>
          </div>

          {/* Error message */}
          {error && <div style={errorStyle}>{error}</div>}

          {/* Geofences list */}
          <div style={listSectionStyle}>
            <h2 style={sectionTitleStyle}>
              Geocercas ({geofences.length})
            </h2>

            {loading ? (
              <div style={loadingStyle}>Carregando...</div>
            ) : geofences.length === 0 ? (
              <div style={emptyStyle}>Nenhuma geocerca criada</div>
            ) : (
              <div style={listStyle}>
                {geofences.map((gf) => (
                  <div key={gf.id} style={listItemStyle}>
                    <div style={listItemContentStyle}>
                      <div style={listItemNameStyle}>{gf.name}</div>
                      <div style={listItemDetailsStyle}>
                        <div>Raio: {Math.round(gf.radius)}m</div>
                        <div style={coordinatesStyle}>
                          {gf.lat.toFixed(4)}, {gf.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>

                    {deleteConfirm === gf.id ? (
                      <div style={confirmDeleteStyle}>
                        <button
                          style={deleting === gf.id ? confirmButtonDisabledStyle : confirmButtonStyle}
                          onClick={() => handleDeleteGeofence(gf.id)}
                          disabled={deleting === gf.id}
                        >
                          Confirmar
                        </button>
                        <button
                          style={deleting === gf.id ? cancelButtonDisabledStyle : cancelButtonStyle}
                          onClick={() => setDeleteConfirm(null)}
                          disabled={deleting === gf.id}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        style={deleteButtonStyle}
                        onClick={() => setDeleteConfirm(gf.id)}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right side - Map */}
        <div style={mapContainerStyle}>
          <MapContainer
            center={mapCenter}
            zoom={4}
            style={mapStyle}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler onMapClick={handleMapClick} />

            {/* Existing geofences */}
            {geofences.map((gf) => (
              <Circle
                key={gf.id}
                center={[gf.lat, gf.lng]}
                radius={gf.radius}
                color="#8b5cf6"
                fill
                fillOpacity={0.15}
                weight={2}
              >
                <Tooltip>{gf.name}</Tooltip>
              </Circle>
            ))}

            {/* New geofence preview */}
            {newGeofenceCircle}
            {mapMarker}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
