import { useState, useEffect } from 'react';
import { reportsAPI, devicesAPI } from '../services/api';
import { FileText, Download, Calendar, Car, MapPin, Clock } from 'lucide-react';

const reportTypes = [
  { id: 'trips', name: 'Viagens', icon: Car },
  { id: 'summary', name: 'Resumo', icon: FileText },
  { id: 'route', name: 'Rota', icon: MapPin },
  { id: 'stops', name: 'Paradas', icon: Clock },
  { id: 'events', name: 'Eventos', icon: Calendar },
  { id: 'geofences', name: 'Geofences', icon: MapPin },
];

export default function ReportsPage() {
  const [devices, setDevices] = useState([]);
  const [selectedReport, setSelectedReport] = useState('trips');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await devicesAPI.list();
        setDevices(res.data || []);
      } catch (err) {
        console.error('Error fetching devices:', err);
      }
    };
    fetchDevices();

    // Set default dates
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    setEndDate(now.toISOString().split('T')[0]);
    setStartDate(weekAgo.toISOString().split('T')[0]);
  }, []);

  const generateReport = async () => {
    if (!selectedDevice || !startDate || !endDate) {
      setError('Por favor, selecione o dispositivo e o período');
      return;
    }

    setLoading(true);
    setError(null);

    const params = {
      deviceId: selectedDevice,
      from: startDate,
      to: endDate,
    };

    try {
      let res;
      switch (selectedReport) {
        case 'trips':
          res = await reportsAPI.getTrips(params);
          break;
        case 'summary':
          res = await reportsAPI.getSummary(params);
          break;
        case 'events':
          res = await reportsAPI.getEvents(params);
          break;
        case 'route':
          res = await reportsAPI.getRoute(params);
          break;
        case 'stops':
          res = await reportsAPI.getStops(params);
          break;
        case 'geofences':
          res = await reportsAPI.getGeofences(params);
          break;
        default:
          res = await reportsAPI.getTrips(params);
      }
      setReportData(res.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (reportData.length === 0) return;

    const headers = Object.keys(reportData[0]);
    const csvContent = [
      headers.join(','),
      ...reportData.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value);
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_${selectedReport}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>

      {/* Report Type Selection */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {reportTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setSelectedReport(type.id);
              setReportData([]);
            }}
            className={`p-4 rounded-lg text-center transition-all ${
              selectedReport === type.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <type.icon className="mx-auto mb-2" size={24} />
            <span className="font-medium">{type.name}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dispositivo
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione...</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={generateReport}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Gerando...' : 'Gerar'}
            </button>
            {reportData.length > 0 && (
              <button
                onClick={exportToCSV}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                title="Exportar CSV"
              >
                <Download size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
          {error}
        </div>
      )}

      {/* Report Results */}
      {reportData.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              {reportTypes.find(t => t.id === selectedReport)?.name}
            </h2>
            <span className="text-sm text-gray-500">
              {reportData.length} registros
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {Object.keys(reportData[0] || {}).map((key) => (
                    <th
                      key={key}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reportData.slice(0, 50).map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    {Object.values(row).map((value, i) => (
                      <td key={i} className="px-4 py-3 text-sm text-gray-700">
                        {typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {reportData.length > 50 && (
            <div className="p-4 text-center text-sm text-gray-500">
              Mostrando 50 de {reportData.length} registros
            </div>
          )}
        </div>
      )}

      {reportData.length === 0 && !loading && !error && (
        <div className="text-center py-12 text-gray-500">
          Selecione um dispositivo e período para gerar o relatório
        </div>
      )}
    </div>
  );
}
