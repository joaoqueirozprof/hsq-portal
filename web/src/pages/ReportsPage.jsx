import { useState, useEffect } from 'react';
import { reportsAPI, devicesAPI } from '../services/api';
import { FileText, Download, Calendar, Car, MapPin, Clock, Play, AlertCircle } from 'lucide-react';

const reportTypes = [
  { id: 'trips', name: 'Viagens', icon: Car, color: 'primary' },
  { id: 'summary', name: 'Resumo', icon: FileText, color: 'accent' },
  { id: 'route', name: 'Rota', icon: MapPin, color: 'success' },
  { id: 'stops', name: 'Paradas', icon: Clock, color: 'warning' },
  { id: 'events', name: 'Eventos', icon: Calendar, color: 'primary' },
  { id: 'geofences', name: 'Geocercas', icon: MapPin, color: 'accent' },
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

  const currentReport = reportTypes.find(t => t.id === selectedReport);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-dark-900 font-display">Relatórios</h1>
        <p className="text-dark-500 text-sm mt-1">
          Gere relatórios detalhados de acordo com o período selecionado
        </p>
      </div>

      {/* Report Type Selection */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {reportTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedReport === type.id;
          return (
            <button
              key={type.id}
              onClick={() => {
                setSelectedReport(type.id);
                setReportData([]);
              }}
              className={`
                p-4 rounded-xl text-center transition-all duration-200
                ${isSelected
                  ? `bg-gradient-to-br from-${type.color}-500 to-${type.color}-600 text-white shadow-glow-${type.color === 'primary' ? 'blue' : type.color === 'accent' ? 'orange' : type.color}`
                  : 'bg-white text-dark-700 hover:bg-dark-50 border border-dark-200'
                }
              `}
            >
              <div className={`inline-flex p-3 rounded-xl mb-2 ${
                isSelected ? 'bg-white/20' : `bg-${type.color}-500/10`
              }`}>
                <Icon size={24} className={isSelected ? 'text-white' : ''} />
              </div>
              <span className="font-medium block">{type.name}</span>
            </button>
          );
        })}
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-dark-700 mb-2">Veículo</label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full px-4 py-3 bg-dark-50 border border-dark-200 rounded-xl text-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            <label className="block text-sm font-medium text-dark-700 mb-2">Data Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 bg-dark-50 border border-dark-200 rounded-xl text-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 mb-2">Data Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-dark-50 border border-dark-200 rounded-xl text-dark-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-end gap-3">
            <button
              onClick={generateReport}
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white font-medium rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Gerando...</span>
                </>
              ) : (
                <>
                  <Play size={18} />
                  <span>Gerar Relatório</span>
                </>
              )}
            </button>
            {reportData.length > 0 && (
              <button
                onClick={exportToCSV}
                className="px-4 py-3 bg-accent-500/10 text-accent-600 rounded-xl hover:bg-accent-500/20 transition-colors"
                title="Exportar CSV"
              >
                <Download size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-xl text-danger-600 animate-slide-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} />
              <p>{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-danger-400 hover:text-danger-600">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Report Results */}
      {reportData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden animate-slide-up">
          <div className="p-5 border-b border-dark-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-${currentReport?.color}-500/10`}>
                {currentReport && <currentReport.icon size={20} className={`text-${currentReport.color}-500`} />}
              </div>
              <div>
                <h2 className="font-semibold text-dark-900">{currentReport?.name}</h2>
                <p className="text-sm text-dark-500">
                  {reportData.length} registro{reportData.length !== 1 ? 's' : ''} encontrado{reportData.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-dark-50">
                <tr>
                  {Object.keys(reportData[0] || {}).map((key) => (
                    <th
                      key={key}
                      className="px-5 py-3 text-left text-xs font-medium text-dark-500 uppercase tracking-wider"
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-100">
                {reportData.slice(0, 50).map((row, index) => (
                  <tr key={index} className="hover:bg-dark-50/50 transition-colors">
                    {Object.values(row).map((value, i) => (
                      <td key={i} className="px-5 py-4 text-sm text-dark-700">
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
            <div className="p-4 text-center text-sm text-dark-500 border-t border-dark-100">
              Mostrando 50 de {reportData.length} registros
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {reportData.length === 0 && !loading && !error && (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <div className="w-20 h-20 bg-dark-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={40} className="text-dark-300" />
          </div>
          <h3 className="text-lg font-semibold text-dark-700 mb-2">
            Selecione os filtros e gere seu relatório
          </h3>
          <p className="text-dark-500">
            Escolha o veículo, período e tipo de relatório para visualizar os dados
          </p>
        </div>
      )}
    </div>
  );
}
