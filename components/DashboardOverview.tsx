
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, Clock, AlertCircle, CheckCircle2,
  MapPin, Activity, Phone, Share2,
  ChevronRight, MoreHorizontal, MessageSquare,
  ArrowUpRight, Truck, Hospital, Users2, Plane,
  RotateCcw, Search, Filter, Plus, FileText,
  ChevronDown, ChevronUp, Shield, Heart, Info,
  AlertTriangle, Navigation, CheckCircle, Send, ExternalLink, Calendar, Loader2,
  Globe, Flag, X, Maximize2, Minimize2, ClipboardCheck, TrendingDown, TrendingUp, User, Key, Building2,
  UserPlus, ShieldAlert, Volume2, BellRing, Stethoscope, PhoneCall, Siren
} from 'lucide-react';
import { EmergencyCase, EmergencyPriority, Employee, Company, OperationReport, AdminUser, AmbulanceState, CommunicationLog } from '../types';
import { COMPANIES, EMPLOYEES, PRIORITY_COLORS, AMBULANCES } from '../constants';
import NetworkMap from './NetworkMap';
import AmbulanceTracker from './AmbulanceTracker';
import { auditLogger } from '../services/auditLogger';

interface DashboardOverviewProps {
  incidents: EmergencyCase[];
  onDispatch?: (incidentId: string, ambId: string) => void;
  currentUser?: AdminUser;
  onUpdateIncident?: (incidentId: string, updates: Partial<EmergencyCase>) => void;
  ambulances?: AmbulanceState[];
  companies?: Company[];
  onStartTriage?: (companyName: string, companyId?: string) => void;
  onOpenComm?: (incidentId: string) => void;
  resources?: any[]; // Adicionado para hospitais
}

// Removido HOSPITALS_DB fixo para usar recursos da base de dados

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  incidents,
  onDispatch,
  currentUser,
  onUpdateIncident,
  ambulances = [],
  companies = COMPANIES,
  onStartTriage,
  onOpenComm,
  resources = []
}) => {
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [trackingIncidentId, setTrackingIncidentId] = useState<string | null>(null);
  const [dispatchModalId, setDispatchModalId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dispatchSteps, setDispatchSteps] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'full' | 'compact'>('full');

  const getNearbyAmbulances = (incidentCoords: [number, number], requiredBeds: number = 1) => {
    return ambulances.map(amb => {
      const dist = Math.sqrt(Math.pow(amb.currentPos[0] - incidentCoords[0], 2) + Math.pow(amb.currentPos[1] - incidentCoords[1], 2)) * 111;
      const eta = Math.round(dist * 2.5);
      
      // Smart Scoring Logic (0-100)
      let score = 0;
      const badges: { text: string, color: string }[] = [];
      
      // 1. Proximity (Max 50 points)
      const proximityScore = Math.max(0, 50 - (dist * 2));
      score += proximityScore;
      if (dist < 5) badges.push({ text: 'Muito Próxima', color: 'bg-emerald-50 text-emerald-600' });
      
      // 2. Capacity Match (Max 30 points)
      const ambBeds = amb.capacity === 'Dupla' ? 2 : 1;
      if (ambBeds >= requiredBeds) {
        score += 30;
        if (ambBeds === requiredBeds) badges.push({ text: 'Camas Ideais', color: 'bg-blue-50 text-blue-600' });
        else badges.push({ text: 'Excesso de Camas', color: 'bg-indigo-50 text-indigo-600' });
      } else {
        score += 5;
        badges.push({ text: 'Capacidade Insuficiente', color: 'bg-red-50 text-red-600' });
      }
      
      // 3. Technical Level (Max 20 points)
      if (amb.type === 'Avançada') {
        score += 20;
        badges.push({ text: 'Suporte Avançado (SAV)', color: 'bg-purple-50 text-purple-600' });
      } else {
        score += 10;
        badges.push({ text: 'Suporte Básico (SBV)', color: 'bg-slate-50 text-slate-600' });
      }

      return { 
        ...amb, 
        distance: dist, 
        eta, 
        suitabilityScore: Math.round(score),
        badges 
      };
    }).sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  };

  const getNearbyHospitals = (incidentCoords: [number, number]) => {
    return resources
      .filter(r => r.category === 'hospital' && r.location)
      .map(h => {
        let coords: [number, number] = [0, 0];
        try {
          const parsed = JSON.parse(h.location);
          if (Array.isArray(parsed)) coords = parsed as [number, number];
        } catch {
          // Fallback se não for JSON
        }
        const dist = Math.sqrt(Math.pow(coords[0] - incidentCoords[0], 2) + Math.pow(coords[1] - incidentCoords[1], 2)) * 111;
        return { ...h, coords, distance: dist };
      })
      .filter(h => h.distance > 0)
      .sort((a, b) => a.distance - b.distance);
  };

  const handleDispatch = (ambId: string) => {
    if (dispatchModalId && onDispatch) {
      onDispatch(dispatchModalId, ambId);
      setDispatchModalId(null);
    }
  };

  const renderStatusBox = (incident: EmergencyCase) => {
    const isDespatched = incident.ambulanceState !== undefined;
    const isPendingAccept = incident.ambulanceState?.phase === 'pending_accept';
    const isLive = incident.ambulanceState?.phase === 'en_route_to_patient' || incident.ambulanceState?.phase === 'evacuating';
    const isClosed = incident.status === 'closed';

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (isDespatched) setTrackingIncidentId(incident.id);
        }}
        className={`rounded-2xl p-4 flex items-center justify-between border transition-all cursor-pointer group/status ${isLive ? 'bg-blue-50 border-blue-200 shadow-md ring-2 ring-blue-500/20' :
          isPendingAccept ? 'bg-orange-50 border-orange-200 animate-pulse' :
            isClosed ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-[#F8FAFC] border-slate-100'
          } ${isDespatched && !isClosed ? 'hover:scale-[1.02] active:scale-95' : ''}`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${isLive ? 'bg-blue-600 text-white animate-pulse' :
            isPendingAccept ? 'bg-orange-500 text-white' :
              isClosed ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 border border-slate-100'
            }`}>
            {isPendingAccept ? <Clock className="w-5 h-5" /> : (isClosed ? <ClipboardCheck className="w-5 h-5" /> : <Truck className="w-5 h-5" />)}
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 leading-none">
              {isPendingAccept ? 'Aguardando Unidade' :
                isLive ? 'Rastreio Activo' :
                  isClosed ? 'Operação Concluída' : 'Aguardando Despacho'}
            </p>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-widest">
              {isPendingAccept ? 'Timeout 30s Ligado' : (isLive ? 'GPS 5s Sincronizado' : 'Protocolo Iniciado')}
            </p>
          </div>
        </div>
        {isDespatched && !isClosed && <div className="flex items-center gap-2 text-blue-600 font-black text-[9px] uppercase tracking-widest bg-blue-100/50 px-3 py-1 rounded-lg">Rastreio <ChevronRight className="w-3 h-3 group-hover/status:translate-x-1 transition-transform" /></div>}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 relative">

      {dispatchModalId && (
        <div className="fixed inset-0 z-[150] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col md:flex-row">

            {/* Esquerda: Seleção de Ambulância */}
            <div className="flex-1 p-8 border-r border-slate-100">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black font-corporate uppercase tracking-tight">Despacho Inteligente</h3>
                  <p className="text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-widest">Módulo 8: Geointeligência SSM</p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ambulâncias Mais Próximas</h4>
                {(() => {
                  const incident = incidents.find(i => i.id === dispatchModalId);
                  if (!incident) return null;
                  
                  const requiredBeds = incident.patientCount || 1;
                  const nearbyAmbs = getNearbyAmbulances(incident.coords, requiredBeds);

                  return (
                    <div className="space-y-4">
                      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users2 className="w-5 h-5 text-blue-600" />
                          <p className="text-xs font-black text-blue-900 uppercase">Necessário: {requiredBeds} Cama(s)</p>
                        </div>
                        <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-blue-100">
                          Algoritmo SSM v2.4
                        </div>
                      </div>
                      
                      {nearbyAmbs.map((amb, index) => (
                        <div key={amb.id} className={`bg-white border rounded-[2rem] p-5 flex items-center justify-between hover:shadow-xl transition-all group relative overflow-hidden ${index === 0 ? 'border-blue-500 ring-4 ring-blue-500/5' : 'border-slate-100'}`}>
                          {index === 0 && (
                            <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 text-[8px] font-black uppercase tracking-tighter rounded-bl-xl">Recomendada</div>
                          )}
                          <div className="flex items-center gap-5">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${index === 0 ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                              <Truck className="w-7 h-7" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3 mb-1.5">
                                <p className="text-sm font-black text-slate-900 leading-none">{amb.id}</p>
                                <div className="flex gap-1.5">
                                  {amb.badges.map((badge, bIdx) => (
                                    <span key={bIdx} className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter ${badge.color}`}>{badge.text}</span>
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> ETA {amb.eta} MIN</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Match Score: {amb.suitabilityScore}%</span>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => handleDispatch(amb.id)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${index === 0 ? 'bg-slate-900 text-white shadow-slate-900/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-900 hover:text-white'}`}>Despachar</button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3">Rede Hospitalar Próxima</h4>
                <div className="grid grid-cols-1 gap-2">
                  {(() => {
                    const incident = incidents.find(i => i.id === dispatchModalId);
                    if (!incident) return null;
                    return getNearbyHospitals(incident.coords).map(h => (
                      <div key={h.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <Hospital className="w-4 h-4 text-emerald-600" />
                          <span className="text-xs font-bold text-slate-700">{h.name}</span>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase">{h.distance.toFixed(1)} km</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* Direita: Checkbox Operacional */}
            <div className="w-full md:w-80 bg-slate-50 p-8">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Coordenação de Passo 2</h4>
              <div className="space-y-4">
                {[
                  'Localização GPS Validada',
                  'Empresa Cliente Notificada',
                  'Seguradora Comunicada',
                  'Triagem Inicial Concluída',
                  'Hospital de Destino Pré-avisado'
                ].map(step => (
                  <label key={step} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer transition-all hover:bg-slate-50">
                    <input 
                      type="checkbox" 
                      className="rounded text-blue-600 w-4 h-4" 
                      checked={dispatchSteps.includes(step)}
                      onChange={e => {
                        const updated = e.target.checked 
                          ? [...dispatchSteps, step]
                          : dispatchSteps.filter(s => s !== step);
                        setDispatchSteps(updated);
                      }}
                    />
                    <span className="text-[11px] font-bold text-slate-600">{step}</span>
                  </label>
                ))}
              </div>
              <button onClick={() => setDispatchModalId(null)} className="w-full mt-10 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest">Fechar Janela</button>
            </div>
          </div>
        </div>
      )}

      {trackingIncidentId && incidents.find(i => i.id === trackingIncidentId) && (
        <AmbulanceTracker
          incident={incidents.find(i => i.id === trackingIncidentId)!}
          company={companies.find(c => c.id === incidents.find(i => i.id === trackingIncidentId)?.companyId)}
          onClose={() => setTrackingIncidentId(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Chamadas OC Modal removido daqui (agora global no App.tsx) */}
        <div className="lg:col-span-12 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-2xl font-extrabold text-slate-900 font-display uppercase tracking-tight flex items-center gap-4">
              Gestão Operacional Live 
              <div className="relative flex h-3 w-3">
                <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></div>
                <div className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></div>
              </div>
            </h3>
            <div className="flex items-center bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200 shadow-sm">
              <button 
                onClick={() => setViewMode('full')}
                className={`px-6 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-widest transition-all duration-300 ${viewMode === 'full' ? 'bg-white text-blue-600 shadow-md ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Vista Completa
              </button>
              <button 
                onClick={() => setViewMode('compact')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'compact' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Vista Compacta
              </button>
            </div>
          </div>

          {/* Pending Triage Summary Bar */}
          {incidents.filter(i => i.status !== 'closed' && !i.patientName).length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-top duration-500">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-orange-900 leading-none">Triagens Pendentes</p>
                  <p className="text-[10px] font-bold text-orange-600 uppercase mt-1 tracking-widest">
                    {incidents.filter(i => i.status !== 'closed' && !i.patientName).length} Chamadas em espera de identificação
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewMode('compact')}
                className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-orange-200 transition-all"
              >
                Gerir Lista
              </button>
            </div>
          )}

          <div className="space-y-4">
            {incidents.filter(i => i.status !== 'closed').length > 0 ? (
              incidents.filter(i => i.status !== 'closed').map((incident) => {
                const company = companies.find(c => c.id === incident.companyId);
                const isExpanded = expandedCaseId === incident.id;

                return (
                  <div key={incident.id} className={`bg-white rounded-[2rem] border border-slate-200 shadow-sm transition-all duration-500 overflow-hidden ${isExpanded ? 'ring-4 ring-blue-600/5 border-blue-100' : 'hover:border-blue-300'}`}>
                    <div className={`${viewMode === 'compact' && !isExpanded ? 'p-4' : 'p-6 sm:p-8'}`}>
                      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${viewMode === 'compact' && !isExpanded ? 'mb-2' : 'mb-6'}`}>
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedCaseId(isExpanded ? null : incident.id)}>
                          <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 overflow-hidden">
                            {company ? <img src={company.logo} alt="Company Logo" className="w-full h-full object-cover" /> : <Activity className="w-7 h-7" />}
                          </div>
                          <div>
                            <h4 className="text-xl font-black text-slate-900 leading-none">{incident.patientName || 'Triagem Telefónica Pendente'}</h4>
                            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">#{incident.id} • {company?.name}</p>
                          </div>
                        </div>
                        <div className="text-right text-xs font-black text-slate-300 flex items-center gap-2"><Clock className="w-4 h-4" /> {incident.timestamp}</div>
                      </div>

                      {(isExpanded || viewMode === 'full') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="space-y-4">
                            <div className="flex gap-4">
                              <Building2 className="w-5 h-5 text-slate-300 shrink-0" />
                              <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Empresa Solicitante</p>
                                <p className="text-sm font-bold text-slate-700">{company?.name || (incident.companyId ? `Corporativo ID: ${incident.companyId}` : 'Cliente Particular')}</p>
                                {company?.address ? <p className="text-xs font-medium text-slate-500 mt-1">{company.address}</p> : (incident.locationName && !company ? <p className="text-xs font-medium text-orange-500 mt-1 uppercase tracking-tighter font-bold opacity-60">Origem Externa Registada</p> : null)}
                              </div>
                            </div>
                            <div className="flex gap-4">
                              <MapPin className="w-5 h-5 text-slate-300 shrink-0" />
                              <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Cenário Capturado por GPS</p><p className="text-sm font-bold text-slate-700">{incident.locationName}</p></div>
                            </div>
                            <div className="flex gap-4">
                              <Stethoscope className="w-5 h-5 text-slate-300 shrink-0" />
                              <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Descrição</p><p className="text-sm font-bold text-slate-700">{incident.type}</p></div>
                            </div>
                          </div>
                          <div>
                            {renderStatusBox(incident)}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button onClick={() => setDispatchModalId(incident.id)} disabled={incident.ambulanceState !== undefined || incident.status === 'closed'} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg ${incident.ambulanceState || incident.status === 'closed' ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}`}><Send className="w-4 h-4" /> {incident.status === 'closed' ? 'Histórico de Missão' : (incident.ambulanceState ? 'Unidade em Missão' : 'Despachar Unidade SSM')}</button>
                        <button
                          onClick={() => onOpenComm?.(incident.id)}
                          className="bg-[#E0F2FE] hover:bg-blue-100 text-blue-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                        >
                          <PhoneCall className="w-4 h-4" /> Canais OC
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Tem certeza que deseja encerrar este caso?')) {
                              onUpdateIncident?.(incident.id, 'closed');
                            }
                          }}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-emerald-100"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Marcar Resolvido
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white/60 border border-slate-200/50 backdrop-blur-md rounded-[4rem] p-24 text-center space-y-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 shadow-[0_20px_50px_rgba(0,0,0,0.02)]">
                <div className="w-32 h-32 bg-slate-950 text-white rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700"></div>
                  <Shield className="w-14 h-14 relative z-10 group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div className="space-y-6">
                  <h4 className="text-4xl font-extrabold text-slate-900 font-display tracking-tight uppercase">
                    {companies.find(c => c.id === currentUser?.companyId)?.name || 'Safety & Security Medical'}
                  </h4>
                  <p className="text-slate-400 font-extrabold uppercase tracking-[0.4em] text-[11px] max-w-md mx-auto leading-relaxed opacity-60">
                    Prontidão Operacional <span className="text-emerald-500">Activa</span>
                  </p>
                  <div className="h-px w-24 bg-slate-200 mx-auto"></div>
                  <p className="text-slate-500 font-medium text-sm max-w-sm mx-auto leading-relaxed">
                    O Centro de Inteligência SSM está monitorando a rede global em tempo real. Novos incidentes aparecerão instantaneamente nesta central de comando.
                  </p>
                </div>
                <div className="pt-8 flex flex-col items-center gap-6">
                  <div className="flex items-center gap-4 text-[10px] font-extrabold text-emerald-600 uppercase tracking-[0.4em] bg-emerald-50 px-8 py-3 rounded-full border border-emerald-100 shadow-sm">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                    Rede Blindada & Segura
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
