import React, { useState, useEffect } from 'react';

interface Device {
  deviceId: string;
  name: string;
  category: string;
}

interface TripReport {
  inicio: string;
  fim: string;
  de: string;
  para: string;
  distancia: number;
  duracao: number;
  velocidadeMedia: number;
  velocidadeMaxima: number;
}

interface StopReport {
  inicio: string;
  fim: string;
  duracao: number;
  local: string;
  lat: number;
  lng: number;
}

interface SummaryReport {
  distanciaTotal: number;
  tempoEmMovimento: number;
  tempoParado: number;
  velocidadeMedia: number;
  velocidadeMaxima: number;
  viagens: number;
}

interface EventReport {
  dataHora: string;
  tipo: string;
  descricao: string;
  velocidade?: number;
}

type ReportType = 'trips' | 'stops' | 'summary' | 'events';

interface ReportsProps {
  token: string;
  onClose: () => void;
}

export default function Reports({ token, onClose }: ReportsProps) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [reportType, setReportType] = useState<ReportType>('trips');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [reportData, setReportData] = useState<any>(null);

  // Initialize dates on component mount
  useEffect(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    setFromDate(formatDateTimeLocal(today));
    setToDate(formatDateTimeLocal(now));

    fetchDevices();
  }, []);

  const formatDateTimeLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/tracking/devices', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao carregar dispositivos');
      }

      const data = await response.json();
      setDevices(data.devices || []);

      if (data.devices && data.devices.length > 0) {
        setSelectedDevice(data.devices[0].deviceId);
      }
    } catch (err) {
      setError('Erro ao carregar dispositivos');
      console.error(err);
    }
  };

  const generateReport = async () => {
    if (!selectedDevice) {
      setError('Selecione um dispositivo');
      return;
    }

    setLoading(true);
    setError('');
    setReportData(null);

    try {
      const fromISO = new Date(fromDate).toISOString();
      const toISO = new Date(toDate).toISOString();

      const response = await fetch(
        `/api/tracking/reports/${reportType}/${selectedDevice}?from=${encodeURIComponent(
          fromISO
        )}&to=${encodeURIComponent(toISO)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao gerar relatório');
      }

      const data = await response.json();
      setReportData(data);
    } catch (err) {
      setError('Erro ao gerar relatório. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const formatDistance = (km: number): string => {
    return `${km.toFixed(1)} km`;
  };

  const formatSpeed = (speed: number): string => {
    return `${speed.toFixed(1)} km/h`;
  };

  const getEventColor = (type: string): string => {
    const colors: Record<string, string> = {
      deviceOnline: '#22c55e',
      deviceOffline: '#ef4444',
      geofenceEnter: '#3b82f6',
      geofenceExit: '#f59e0b',
      ignitionOn: '#22c55e',
      ignitionOff: '#ef4444',
      alarm: '#ef4444',
    };
    return colors[type] || '#6b7280';
  };

  const getEventLabel = (type: string): string => {
    const labels: Record<string, string> = {
      deviceOnline: 'Dispositivo Online',
      deviceOffline: 'Dispositivo Offline',
      geofenceEnter: 'Entrada Geofence',
      geofenceExit: 'Saída Geofence',
      ignitionOn: 'Ignição Ligada',
      ignitionOff: 'Ignição Desligada',
      alarm: 'Alarme',
    };
    return labels[type] || type;
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    position: 'relative',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  };

  const headerTitleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '4px 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const controlsBarStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  };

  const controlGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  };

  const selectStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    fontSize: '14px',
    minWidth: '200px',
    cursor: 'pointer',
  };

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    fontSize: '14px',
    minWidth: '160px',
  };

  const reportTypeGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
  };

  const reportTypeButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    backgroundColor: active ? 'var(--accent-blue)' : 'var(--bg-card)',
    color: active ? '#fff' : 'var(--text-primary)',
    border: active ? 'none' : '1px solid var(--border)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'all 0.2s ease',
  });

  const generateButtonStyle: React.CSSProperties = {
    padding: '8px 24px',
    backgroundColor: 'var(--accent-blue)',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'opacity 0.2s ease',
  };

  const errorStyle: React.CSSProperties = {
    padding: '12px 20px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    borderBottom: '1px solid #ef4444',
    fontSize: '14px',
  };

  const reportContentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
  };

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    color: 'var(--text-muted)',
    fontSize: '16px',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h2 style={headerTitleStyle}>Relatórios</h2>
        <button style={closeButtonStyle} onClick={onClose} aria-label="Fechar">
          ✕
        </button>
      </div>

      <div style={controlsBarStyle}>
        <div style={controlGroupStyle}>
          <label style={labelStyle} htmlFor="deviceSelect">Dispositivo</label>
          <select
            id="deviceSelect"
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            style={selectStyle}
          >
            <option value="">Selecione um dispositivo</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.name}
              </option>
            ))}
          </select>
        </div>

        <div style={reportTypeGroupStyle}>
          {[
            { type: 'trips' as ReportType, label: 'Viagens' },
            { type: 'stops' as ReportType, label: 'Paradas' },
            { type: 'summary' as ReportType, label: 'Resumo' },
            { type: 'events' as ReportType, label: 'Eventos' },
          ].map((item) => (
            <button
              key={item.type}
              style={reportTypeButtonStyle(reportType === item.type)}
              onClick={() => setReportType(item.type)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={controlGroupStyle}>
          <label style={labelStyle} htmlFor="fromDate">De</label>
          <input
            id="fromDate"
            type="datetime-local"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={controlGroupStyle}>
          <label style={labelStyle} htmlFor="toDate">Até</label>
          <input
            id="toDate"
            type="datetime-local"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          style={{
            ...generateButtonStyle,
            opacity: loading || !selectedDevice ? 0.6 : 1,
            cursor: loading || !selectedDevice ? 'not-allowed' : 'pointer',
          }}
          onClick={generateReport}
          disabled={loading || !selectedDevice}
        >
          {loading ? 'Gerando...' : 'Gerar'}
        </button>
      </div>

      {error && <div style={errorStyle}>{error}</div>}

      <div style={reportContentStyle}>
        {reportType === 'trips' && reportData && (
          <TripsReport data={reportData} formatDate={formatDate} formatDistance={formatDistance} formatDuration={formatDuration} formatSpeed={formatSpeed} />
        )}

        {reportType === 'stops' && reportData && (
          <StopsReport data={reportData} formatDate={formatDate} formatDuration={formatDuration} />
        )}

        {reportType === 'summary' && reportData && (
          <SummaryReport data={reportData} formatDistance={formatDistance} formatDuration={formatDuration} formatSpeed={formatSpeed} />
        )}

        {reportType === 'events' && reportData && (
          <EventsReport data={reportData} formatDate={formatDate} formatSpeed={formatSpeed} getEventColor={getEventColor} getEventLabel={getEventLabel} />
        )}

        {!reportData && !loading && !error && (
          <div style={emptyStateStyle}>
            Selecione os filtros e clique em "Gerar" para visualizar o relatório
          </div>
        )}
      </div>
    </div>
  );
}

// Trips Report Component
function TripsReport({
  data,
  formatDate,
  formatDistance,
  formatDuration,
  formatSpeed,
}: {
  data: any;
  formatDate: (date: string) => string;
  formatDistance: (km: number) => string;
  formatDuration: (seconds: number) => string;
  formatSpeed: (speed: number) => string;
}) {
  const trips: TripReport[] = data.trips || [];

  const tableWrapperStyle: React.CSSProperties = {
    overflowX: 'auto',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  };

  const theadStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderBottom: '2px solid var(--border)',
    position: 'sticky',
    top: 0,
  };

  const thStyle: React.CSSProperties = {
    padding: '12px',
    textAlign: 'left',
    fontWeight: 600,
    color: 'var(--text-primary)',
  };

  const tbodyTrStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--border)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px',
    color: 'var(--text-primary)',
  };

  const noDataStyle: React.CSSProperties = {
    padding: '24px',
    textAlign: 'center',
    color: 'var(--text-muted)',
  };

  return (
    <div style={tableWrapperStyle}>
      <table style={tableStyle}>
        <thead style={theadStyle}>
          <tr>
            <th style={thStyle}>Início</th>
            <th style={thStyle}>Fim</th>
            <th style={thStyle}>De</th>
            <th style={thStyle}>Para</th>
            <th style={thStyle}>Distância</th>
            <th style={thStyle}>Duração</th>
            <th style={thStyle}>Vel. Média</th>
            <th style={thStyle}>Vel. Máx.</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip, idx) => (
            <tr key={idx} style={tbodyTrStyle}>
              <td style={tdStyle}>{formatDate(trip.inicio)}</td>
              <td style={tdStyle}>{formatDate(trip.fim)}</td>
              <td style={tdStyle} title={trip.de}>{trip.de}</td>
              <td style={tdStyle} title={trip.para}>{trip.para}</td>
              <td style={tdStyle}>{formatDistance(trip.distancia)}</td>
              <td style={tdStyle}>{formatDuration(trip.duracao)}</td>
              <td style={tdStyle}>{formatSpeed(trip.velocidadeMedia)}</td>
              <td style={tdStyle}>{formatSpeed(trip.velocidadeMaxima)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {trips.length === 0 && (
        <div style={noDataStyle}>Nenhuma viagem encontrada no período</div>
      )}
    </div>
  );
}

// Stops Report Component
function StopsReport({
  data,
  formatDate,
  formatDuration,
}: {
  data: any;
  formatDate: (date: string) => string;
  formatDuration: (seconds: number) => string;
}) {
  const stops: StopReport[] = data.stops || [];

  const tableWrapperStyle: React.CSSProperties = {
    overflowX: 'auto',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  };

  const theadStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderBottom: '2px solid var(--border)',
    position: 'sticky',
    top: 0,
  };

  const thStyle: React.CSSProperties = {
    padding: '12px',
    textAlign: 'left',
    fontWeight: 600,
    color: 'var(--text-primary)',
  };

  const tbodyTrStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--border)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px',
    color: 'var(--text-primary)',
  };

  const noDataStyle: React.CSSProperties = {
    padding: '24px',
    textAlign: 'center',
    color: 'var(--text-muted)',
  };

  return (
    <div style={tableWrapperStyle}>
      <table style={tableStyle}>
        <thead style={theadStyle}>
          <tr>
            <th style={thStyle}>Início</th>
            <th style={thStyle}>Fim</th>
            <th style={thStyle}>Duração</th>
            <th style={thStyle}>Local</th>
            <th style={thStyle}>Coordenadas</th>
          </tr>
        </thead>
        <tbody>
          {stops.map((stop, idx) => (
            <tr key={idx} style={tbodyTrStyle}>
              <td style={tdStyle}>{formatDate(stop.inicio)}</td>
              <td style={tdStyle}>{formatDate(stop.fim)}</td>
              <td style={tdStyle}>{formatDuration(stop.duracao)}</td>
              <td style={tdStyle} title={stop.local}>{stop.local}</td>
              <td style={tdStyle}>
                {stop.lat.toFixed(6)}, {stop.lng.toFixed(6)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {stops.length === 0 && (
        <div style={noDataStyle}>Nenhuma parada encontrada no período</div>
      )}
    </div>
  );
}

// Summary Report Component
function SummaryReport({
  data,
  formatDistance,
  formatDuration,
  formatSpeed,
}: {
  data: SummaryReport;
  formatDistance: (km: number) => string;
  formatDuration: (seconds: number) => string;
  formatSpeed: (speed: number) => string;
}) {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '16px',
  };

  return (
    <div style={gridStyle}>
      <SummaryCard
        label="Distância Total"
        value={formatDistance(data.distanciaTotal)}
      />
      <SummaryCard
        label="Tempo em Movimento"
        value={formatDuration(data.tempoEmMovimento)}
      />
      <SummaryCard
        label="Tempo Parado"
        value={formatDuration(data.tempoParado)}
      />
      <SummaryCard
        label="Velocidade Média"
        value={formatSpeed(data.velocidadeMedia)}
      />
      <SummaryCard
        label="Velocidade Máxima"
        value={formatSpeed(data.velocidadeMaxima)}
      />
      <SummaryCard
        label="Viagens"
        value={data.viagens.toString()}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  const valueStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--accent-blue)',
  };

  return (
    <div style={cardStyle}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
    </div>
  );
}

// Events Report Component
function EventsReport({
  data,
  formatDate,
  formatSpeed,
  getEventColor,
  getEventLabel,
}: {
  data: any;
  formatDate: (date: string) => string;
  formatSpeed: (speed: number) => string;
  getEventColor: (type: string) => string;
  getEventLabel: (type: string) => string;
}) {
  const events: EventReport[] = data.events || [];

  const tableWrapperStyle: React.CSSProperties = {
    overflowX: 'auto',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px',
  };

  const theadStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    borderBottom: '2px solid var(--border)',
    position: 'sticky',
    top: 0,
  };

  const thStyle: React.CSSProperties = {
    padding: '12px',
    textAlign: 'left',
    fontWeight: 600,
    color: 'var(--text-primary)',
  };

  const tbodyTrStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--border)',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px',
    color: 'var(--text-primary)',
  };

  const badgeStyle = (color: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: color,
    color: '#fff',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
  });

  const noDataStyle: React.CSSProperties = {
    padding: '24px',
    textAlign: 'center',
    color: 'var(--text-muted)',
  };

  return (
    <div style={tableWrapperStyle}>
      <table style={tableStyle}>
        <thead style={theadStyle}>
          <tr>
            <th style={thStyle}>Data/Hora</th>
            <th style={thStyle}>Tipo</th>
            <th style={thStyle}>Descrição</th>
            <th style={thStyle}>Velocidade</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, idx) => (
            <tr key={idx} style={tbodyTrStyle}>
              <td style={tdStyle}>{formatDate(event.dataHora)}</td>
              <td style={tdStyle}>
                <span style={badgeStyle(getEventColor(event.tipo))}>
                  {getEventLabel(event.tipo)}
                </span>
              </td>
              <td style={tdStyle}>{event.descricao}</td>
              <td style={tdStyle}>{event.velocidade !== undefined ? formatSpeed(event.velocidade) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {events.length === 0 && (
        <div style={noDataStyle}>Nenhum evento encontrado no período</div>
      )}
    </div>
  );
}
