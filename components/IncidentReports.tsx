import React, { useState, useMemo } from 'react';
import {
  FileBarChart, Clock, Truck, Building2, MapPin, Activity,
  ChevronDown, ChevronUp, Download, Filter, Search, CheckCircle2,
  AlertTriangle, ShieldCheck, Calendar, User, Timer, Navigation,
  Hospital, ClipboardCheck, Phone, MessageSquare, TrendingUp, ArrowRight
} from 'lucide-react';
import { EmergencyCase, Company, AdminUser, AmbulanceState } from '../types';

interface IncidentReportsProps {
  incidents: EmergencyCase[];
  companies: Company[];
  currentUser: AdminUser;
}

const IncidentReports: React.FC<IncidentReportsProps> = ({ incidents, companies, currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCompany, setFilterCompany] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Only show resolved/closed incidents
  const resolvedIncidents = useMemo(() => {
    return incidents
      .filter(inc => inc.status === 'closed')
      .filter(inc => {
        if (filterCompany !== 'all' && inc.companyId !== filterCompany) return false;
        if (filterPriority !== 'all' && inc.priority !== filterPriority) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            inc.id.toLowerCase().includes(q) ||
            inc.type.toLowerCase().includes(q) ||
            inc.patientName?.toLowerCase().includes(q) ||
            inc.locationName?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by created_at descending
        const dateA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
        const dateB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
        return dateB - dateA;
      });
  }, [incidents, filterCompany, filterPriority, searchQuery]);

  // Calculate operation metrics
  const getOperationMetrics = (inc: EmergencyCase) => {
    const ambState = inc.ambulanceState as any;
    const report = inc.report;
    const timestamps = report?.timestamps || ambState?.timestamps;

    let responseTime = '--';
    let evacuationTime = '--';
    let totalTime = '--';

    if (timestamps) {
      const dispatched = timestamps.dispatched;
      const arrivedPatient = timestamps.arrivedAtPatient;
      const leftHospital = timestamps.leftForHospital;
      const arrivedHospital = timestamps.arrivedAtHospital;

      if (dispatched && arrivedPatient) {
        responseTime = `${calculateMinDiff(dispatched, arrivedPatient)} min`;
      }
      if (arrivedPatient && arrivedHospital) {
        evacuationTime = `${calculateMinDiff(arrivedPatient, arrivedHospital)} min`;
      }
      if (dispatched && arrivedHospital) {
        totalTime = `${calculateMinDiff(dispatched, arrivedHospital)} min`;
      }
    }

    return { responseTime, evacuationTime, totalTime };
  };

  const calculateMinDiff = (start: string, end: string) => {
    try {
      const parseTime = (t: string) => {
        const parts = t.match(/(\d{1,2}):(\d{2})/);
        if (parts) return parseInt(parts[1]) * 60 + parseInt(parts[2]);
        return new Date(t).getTime() / 60000;
      };
      const diff = Math.abs(parseTime(end) - parseTime(start));
      return Math.round(diff);
    } catch {
      return '--';
    }
  };

  // Stats summary
  const stats = useMemo(() => {
    const total = resolvedIncidents.length;
    const critical = resolvedIncidents.filter(i => i.priority === 'A').length;
    const withAmbulance = resolvedIncidents.filter(i => i.ambulanceState).length;
    const companiesInvolved = new Set(resolvedIncidents.map(i => i.companyId).filter(Boolean)).size;
    return { total, critical, withAmbulance, companiesInvolved };
  }, [resolvedIncidents]);

  const handleExportReport = (inc: EmergencyCase) => {
    const company = companies.find(c => c.id === inc.companyId);
    const metrics = getOperationMetrics(inc);
    const ambState = inc.ambulanceState as any;
    const report = inc.report;

    const reportText = `
══════════════════════════════════════════════
  RELATÓRIO DE OCORRÊNCIA - SSM MEDICAL
══════════════════════════════════════════════

ID Incidente: ${inc.id}
Data/Hora: ${inc.timestamp}
Tipo: ${inc.type}
Prioridade: ${inc.priority === 'A' ? 'CRÍTICA' : inc.priority === 'B' ? 'ALTA' : inc.priority === 'C' ? 'MODERADA' : 'BAIXA'}
Status: RESOLVIDO

── EMPRESA SOLICITANTE ──
Nome: ${company?.name || 'N/A'}
Plano: ${company?.plan || 'N/A'}
Endereço: ${company?.address || 'N/A'}

── PACIENTE ──
Nome: ${inc.patientName || 'Não identificado'}
Localização: ${inc.locationName}
Coordenadas GPS: ${inc.coords?.join(', ') || 'N/A'}

── VIATURA DESIGNADA ──
ID: ${ambState?.id || inc.ambulanceId || 'N/A'}
Placa: ${ambState?.plate || 'N/A'}
Tipo: ${ambState?.type || 'N/A'}
Motorista: ${ambState?.driverName || 'N/A'}

── MÉTRICAS OPERACIONAIS ──
Tempo de Resposta: ${metrics.responseTime}
Tempo de Evacuação: ${metrics.evacuationTime}
Tempo Total da Operação: ${metrics.totalTime}

── RELATÓRIO CLÍNICO ──
Hospital: ${report?.hospitalName || 'N/A'}
Paramédico: ${report?.paramedicName || 'N/A'}
Estado Consciência: ${report?.consciousnessState || 'N/A'}
Sinais Vitais:
  - Pressão: ${report?.vitalSigns?.bp || 'N/A'}
  - Freq. Cardíaca: ${report?.vitalSigns?.hr || 'N/A'}
  - SpO2: ${report?.vitalSigns?.spo2 || 'N/A'}
Procedimentos: ${report?.procedures?.join(', ') || 'N/A'}
Observações: ${report?.observations || 'N/A'}

══════════════════════════════════════════════
  Gerado por SSM Digital Command Center
  ${new Date().toLocaleString()}
══════════════════════════════════════════════
`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${inc.id}_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase font-display tracking-tight flex items-center gap-3">
            <FileBarChart className="w-8 h-8 text-blue-600" /> Relatórios de Ocorrências
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">
            Gestão de Risco • Casos Resolvidos • Métricas Operacionais
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Resolvidos', value: stats.total, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
          { label: 'Casos Críticos', value: stats.critical, icon: AlertTriangle, color: 'bg-red-50 text-red-600 border-red-100' },
          { label: 'Com Evacuação', value: stats.withAmbulance, icon: Truck, color: 'bg-blue-50 text-blue-600 border-blue-100' },
          { label: 'Empresas Envolvidas', value: stats.companiesInvolved, icon: Building2, color: 'bg-purple-50 text-purple-600 border-purple-100' },
        ].map((stat, i) => (
          <div key={i} className={`rounded-2xl p-6 border ${stat.color} flex items-center gap-4`}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-sm border border-current/10">
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-3xl font-black leading-none">{stat.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest mt-1 opacity-60">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Pesquisar</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ID, tipo, paciente..."
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20"
            />
          </div>
        </div>
        <div className="min-w-[180px]">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Empresa</label>
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="w-full py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Todas as Empresas</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Prioridade</label>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="w-full py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          >
            <option value="all">Todas</option>
            <option value="A">Crítica (A)</option>
            <option value="B">Alta (B)</option>
            <option value="C">Moderada (C)</option>
            <option value="D">Baixa (D)</option>
          </select>
        </div>
      </div>

      {/* Incident List */}
      <div className="space-y-4">
        {resolvedIncidents.length === 0 ? (
          <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-20 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto mb-4">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nenhum caso resolvido encontrado</p>
            <p className="text-slate-300 text-xs mt-2">Os casos encerrados aparecerão aqui para análise e geração de relatórios.</p>
          </div>
        ) : (
          resolvedIncidents.map((inc) => {
            const company = companies.find(c => c.id === inc.companyId);
            const isExpanded = expandedId === inc.id;
            const metrics = getOperationMetrics(inc);
            const ambState = inc.ambulanceState as any;
            const report = inc.report;
            const priorityLabel = inc.priority === 'A' ? 'CRÍTICA' : inc.priority === 'B' ? 'ALTA' : inc.priority === 'C' ? 'MODERADA' : 'BAIXA';
            const priorityColor = inc.priority === 'A' ? 'bg-red-50 text-red-600 border-red-100' :
              inc.priority === 'B' ? 'bg-orange-50 text-orange-600 border-orange-100' :
              inc.priority === 'C' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' : 'bg-slate-50 text-slate-500 border-slate-200';

            return (
              <div key={inc.id} className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden transition-all">
                {/* Header Row */}
                <div
                  className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : inc.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="text-lg font-black text-slate-900 leading-none">{inc.patientName || 'Paciente Não Identificado'}</h4>
                        <span className={`px-3 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider border ${priorityColor}`}>
                          {priorityLabel}
                        </span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        #{inc.id} • {company?.name || 'N/A'} • {inc.timestamp}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5 text-blue-500" /> {metrics.responseTime}</span>
                      <span className="flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5 text-orange-500" /> {metrics.evacuationTime}</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-emerald-500" /> {metrics.totalTime}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExportReport(inc); }}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95"
                    >
                      <Download className="w-3.5 h-3.5" /> Exportar
                    </button>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-300" /> : <ChevronDown className="w-5 h-5 text-slate-300" />}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-8 bg-slate-50/30 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* Column 1: Incident Info */}
                      <div className="space-y-6">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5" /> Dados do Incidente
                        </h5>
                        <div className="space-y-4">
                          <InfoRow label="Tipo" value={inc.type} />
                          <InfoRow label="Localização" value={inc.locationName} />
                          <InfoRow label="Coordenadas" value={inc.coords?.join(', ') || 'N/A'} />
                          <InfoRow label="Empresa" value={company?.name || 'N/A'} />
                          <InfoRow label="Plano" value={company?.plan || 'N/A'} />
                        </div>
                      </div>

                      {/* Column 2: Ambulance & Response */}
                      <div className="space-y-6">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5" /> Resposta Operacional
                        </h5>
                        <div className="space-y-4">
                          <InfoRow label="Viatura" value={ambState?.id || inc.ambulanceId || 'N/A'} />
                          <InfoRow label="Placa" value={ambState?.plate || 'N/A'} />
                          <InfoRow label="Tipo Viatura" value={ambState?.type || 'N/A'} />
                          <InfoRow label="Motorista" value={ambState?.driverName || 'N/A'} />
                          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-2">
                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Métricas de Tempo</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600">Tempo de Resposta</span>
                              <span className="text-sm font-black text-blue-600">{metrics.responseTime}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600">Tempo de Evacuação</span>
                              <span className="text-sm font-black text-orange-600">{metrics.evacuationTime}</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-blue-100 pt-2">
                              <span className="text-xs font-black text-slate-700">Tempo Total</span>
                              <span className="text-lg font-black text-emerald-600">{metrics.totalTime}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Column 3: Clinical Report */}
                      <div className="space-y-6">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <Hospital className="w-3.5 h-3.5" /> Relatório Clínico
                        </h5>
                        {report ? (
                          <div className="space-y-4">
                            <InfoRow label="Hospital" value={report.hospitalName} />
                            <InfoRow label="Paramédico" value={report.paramedicName} />
                            <InfoRow label="Consciência" value={report.consciousnessState} />
                            <div className="bg-white rounded-xl p-4 border border-slate-100 space-y-2">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sinais Vitais</p>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="text-center p-2 bg-slate-50 rounded-lg">
                                  <p className="text-lg font-black text-slate-900">{report.vitalSigns?.bp || '--'}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">PA</p>
                                </div>
                                <div className="text-center p-2 bg-slate-50 rounded-lg">
                                  <p className="text-lg font-black text-slate-900">{report.vitalSigns?.hr || '--'}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">FC</p>
                                </div>
                                <div className="text-center p-2 bg-slate-50 rounded-lg">
                                  <p className="text-lg font-black text-slate-900">{report.vitalSigns?.spo2 || '--'}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase">SpO2</p>
                                </div>
                              </div>
                            </div>
                            {report.procedures && report.procedures.length > 0 && (
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Procedimentos</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {report.procedures.map((p, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-bold rounded-lg border border-emerald-100">{p}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {report.observations && <InfoRow label="Observações" value={report.observations} />}
                          </div>
                        ) : (
                          <div className="bg-white rounded-xl p-6 border border-slate-100 text-center">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sem relatório clínico registado</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
    <p className="text-sm font-bold text-slate-700">{value}</p>
  </div>
);

export default IncidentReports;
