
import React, { useState, useEffect, useRef } from 'react';
import {
  Siren, Phone, MapPin, ShieldCheck, Activity, X,
  Heart, Bell, AlertCircle, CheckCircle2, Info, Clock,
  ChevronRight, Shield, Navigation, Truck, User, PhoneCall,
  MessageSquare, AlertTriangle
} from 'lucide-react';
import { AMBULANCES } from '../constants';
import { auditLogger } from '../services/auditLogger';
import { EmergencyCase, EmergencyPriority, AdminUser, AmbulanceState, OperationReport, Employee, CommunicationLog, Company, Resource } from '../types';
import { WebRTCService, WebRTCState } from '../services/webRTCService';
import { loadGoogleMaps } from '../services/googleMapsLoader';
import { dbService } from '../services/dbService';

interface CorporateClientModeProps {
  onTriggerEmergency: () => void;
  onLogout: () => void;
  adminName: string;
  companyId?: string;
  currentUser: AdminUser;
  employees: Employee[];
  companies?: Company[];
  onOpenChat: (incidentId: string) => void;
  incidents?: EmergencyCase[];
}

const CorporateClientMode: React.FC<CorporateClientModeProps> = ({
  onTriggerEmergency,
  onLogout,
  adminName,
  companyId,
  currentUser,
  employees,
  companies = [],
  onOpenChat,
  incidents = []
}) => {
  // Estados: idle -> confirming -> activating -> active (call) -> waiting_dispatch -> tracking
  const [panicStep, setPanicStep] = useState<'idle' | 'confirming' | 'activating' | 'active' | 'waiting_dispatch' | 'tracking'>('idle');
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);
  
  // Find my active incident
  const myActiveIncident = incidents.find(i => i.id === activeIncidentId || (i.companyId === currentUser.companyId && i.status !== 'resolved'));
  
  const [isCallActive, setIsCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<number | null>(null);
  const [eta, setEta] = useState(8);
  const [ambulancePos, setAmbulancePos] = useState<[number, number]>([-25.965, 32.575]);

  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const ambulanceMarkerRef = useRef<google.maps.Marker | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);

  // WebRTC State
  const [webrtcState, setWebrtcState] = useState<WebRTCState>({
    peerId: null,
    isConnected: false,
    incomingCall: null,
    activeCall: null,
    localStream: null,
    remoteStream: null,
    isVolumeActive: false,
    isVideoActive: false
  });

  const webrtcService = useRef<WebRTCService | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      loadGoogleMaps(apiKey).then(() => setIsApiReady(true));
    }
  }, []);

  useEffect(() => {
    if (!webrtcService.current && companyId) {
      webrtcService.current = new WebRTCService((stateUpdate) => {
        setWebrtcState(prev => ({ ...prev, ...stateUpdate }));
      });
      webrtcService.current.initialize(`ssm-client-${companyId}`);
    }

    return () => {
      webrtcService.current?.destroy();
      webrtcService.current = null;
    };
  }, [companyId]);

  useEffect(() => {
    if (webrtcState.remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = webrtcState.remoteStream;
    }
  }, [webrtcState.remoteStream]);

  useEffect(() => {
    if (webrtcState.localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = webrtcState.localStream;
    }
  }, [webrtcState.localStream]);

  useEffect(() => {
    if (webrtcState.incomingCall) {
      // Auto-answer from central for emergency
      webrtcService.current?.answerCall(webrtcState.incomingCall, false);
    }
  }, [webrtcState.incomingCall]);

  useEffect(() => {
    setIsCallActive(!!webrtcState.activeCall);
    if (webrtcState.activeCall) {
      if (!callTimerRef.current) {
        setCallDuration(0);
        callTimerRef.current = window.setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
      if (panicStep === 'active') {
        setPanicStep('waiting_dispatch');
        setTimeout(() => setPanicStep('tracking'), 3500);
      }
    }
  }, [webrtcState.activeCall]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const company = companies.find(c => c.id === companyId);
  const companyName = company?.name || 'Cliente SSM';
  const companyLocationName = company?.address || company?.city || 'Localização não definida';
  
  // Exemplo central da empresa, pode vir do Supabase no futuro.
  const clientLocation: [number, number] = [-25.9680, 32.5710]; 

  // Real GPS tracking of assigned ambulance
  useEffect(() => {
    let interval: number;
    if (panicStep === 'tracking' && myActiveIncident?.ambulanceId) {
      interval = window.setInterval(async () => {
        try {
          const amb = (await dbService.getAmbulances()).find(a => a.id === myActiveIncident.ambulanceId);
          if (amb && amb.currentPos) {
            const nextPos = amb.currentPos;
            setAmbulancePos(nextPos);
            
            if (ambulanceMarkerRef.current) {
              ambulanceMarkerRef.current.setPosition({ lat: nextPos[0], lng: nextPos[1] });
            }

            // Real ETA using Directions Service
            if (isApiReady) {
              const directionsService = new google.maps.DirectionsService();
              directionsService.route({
                origin: { lat: nextPos[0], lng: nextPos[1] },
                destination: { lat: clientLocation[0], lng: clientLocation[1] },
                travelMode: google.maps.TravelMode.DRIVING
              }, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK && result && directionsRendererRef.current) {
                  directionsRendererRef.current.setDirections(result);
                  const leg = result.routes[0].legs[0];
                  if (leg && leg.duration) {
                    setEta(Math.round(leg.duration.value / 60));
                  }
                }
              });
            }
          }
        } catch (err) {
          console.error("Erro ao rastrear ambulância:", err);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [panicStep, myActiveIncident?.ambulanceId, isApiReady]);

  // Google Maps Initialization
  useEffect(() => {
    if (panicStep === 'tracking' && mapContainerRef.current && !mapRef.current && isApiReady) {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: clientLocation[0], lng: clientLocation[1] },
        zoom: 15,
        disableDefaultUI: true,
        styles: [
          { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#616773" }] },
          { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] }
        ]
      });

      // Client Marker
      new google.maps.Marker({
        position: { lat: clientLocation[0], lng: clientLocation[1] },
        map: mapRef.current,
        title: companyName,
        icon: {
           path: google.maps.SymbolPath.CIRCLE,
           scale: 8,
           fillColor: "#2563eb",
           fillOpacity: 1,
           strokeWeight: 2,
           strokeColor: "#FFFFFF"
        }
      });

      // Ambulance Marker
      ambulanceMarkerRef.current = new google.maps.Marker({
        position: { lat: ambulancePos[0], lng: ambulancePos[1] },
        map: mapRef.current,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: new google.maps.Size(40, 40)
        }
      });

      // Directions Renderer
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: "#2563eb",
          strokeWeight: 5,
          strokeOpacity: 0.7
        }
      });
    }

    return () => {
      // Google Maps clean up is usually handled by garbage collection or explicit nulling
      if (mapRef.current) {
        mapRef.current = null;
        ambulanceMarkerRef.current = null;
      }
    };
  }, [panicStep, isApiReady]);

  const handlePanicClick = () => {
    if (panicStep === 'idle') {
      setPanicStep('confirming');
      setTimeout(() => {
        setPanicStep(prev => prev === 'confirming' ? 'idle' : prev);
      }, 4000);
    } else if (panicStep === 'confirming') {
      triggerEmergencyProcess();
    }
  };

  const triggerEmergencyProcess = () => {
    setPanicStep('activating');
    setTimeout(() => {
      const id = `SOS-${Math.floor(Math.random() * 9000) + 1000}`;
      setActiveIncidentId(id);
      onTriggerEmergency();
      setPanicStep('active');

      // Quando ativar SOS, a central vai ligar para o cliente
      // Ou o cliente pode ligar para a central: ssm-central-MAIN
      webrtcService.current?.startCall(`ssm-central-MAIN`, false);

      auditLogger.log(
        { id: 'EMP-SOS', name: adminName, role: 'COLABORADOR_RH', companyId: companyId },
        'CORPORATE_SOS_TRIGGERED',
        companyId
      );
    }, 1500);
  };

  const handleEndCall = () => {
    webrtcService.current?.endCall();
    setIsCallActive(false);
    setPanicStep('waiting_dispatch');
    setTimeout(() => {
      setPanicStep('tracking');
    }, 3500);
  };

  return (
    <div className="flex-1 bg-[#F8FAFC] p-8 custom-scrollbar overflow-y-auto h-full relative text-slate-900">
      <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">

        {panicStep === 'tracking' ? (
          /* VISTA DE RASTREIO ATIVO */
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight font-corporate uppercase flex items-center gap-3">
                  Apoio em Caminho <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse"></div>
                </h2>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
                  Viatura {myActiveIncident?.ambulanceId || ''} Despachada • Monitorização GPS Activa
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[600px]">
              <div className="lg:col-span-8 bg-white rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
                <div ref={mapContainerRef} className="absolute inset-0 z-0" />
                <div className="absolute top-6 left-6 z-10 bg-white/95 backdrop-blur-sm p-5 rounded-2xl border border-slate-100 shadow-xl pointer-events-none">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Truck className="w-6 h-6" /></div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Unidade Assignada</p>
                      <p className="text-sm font-black text-slate-900 leading-none">
                        {myActiveIncident?.ambulanceId || 'Em Trânsito'} 
                        {myActiveIncident?.ambulanceState?.type ? ` (${myActiveIncident.ambulanceState.type})` : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-6 flex flex-col">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm flex-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">EQUIPA EM RESPOSTA</h4>
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-xl">
                      {myActiveIncident?.ambulanceState?.driverName?.substring(0, 2).toUpperCase() || 'M'}
                    </div>
                    <div>
                      <h5 className="text-lg font-black text-slate-900">{myActiveIncident?.ambulanceState?.driverName || 'Motorista de Plantão'}</h5>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Placa: {myActiveIncident?.ambulanceState?.plate || '---'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <button
                      onClick={() => activeIncidentId && onOpenChat(activeIncidentId)}
                      className="w-full bg-[#E0F2FE] text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 hover:bg-slate-100 border border-blue-100"
                    >
                      <MessageSquare className="w-4 h-4" /> Chat com a Coordenação
                    </button>
                    <div className="bg-[#EBFDF5] text-[#065F46] px-4 py-4 rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-3 border border-[#D1FAE5]">
                      <ShieldCheck className="w-4 h-4" /> Rede Primária de Resposta Validada
                    </div>
                  </div>
                </div>

                <div className="bg-blue-600 text-white p-8 rounded-[2rem] shadow-xl shadow-blue-600/20">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">Chegada Prevista</p>
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-6xl font-black tracking-tighter">{eta}</h4>
                    <span className="text-lg font-bold uppercase tracking-widest">Minutos</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* DASHBOARD PADRÃO - HERO CARD ALINHADO COM A FOTO */
          <>
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 md:p-12 lg:p-16 flex flex-col xl:flex-row items-center justify-between gap-12 relative overflow-hidden">
              {/* Text Content */}
              <div className="flex-1 space-y-10 relative z-10 text-left order-2 xl:order-1 w-full">
                <div className="space-y-6">
                  <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight font-corporate">
                    Bem-vindo, <span className="text-blue-600">{companyName}</span>
                  </h1>
                  <p className="text-slate-500 font-medium text-lg leading-relaxed max-w-xl">
                    Seu ambiente está protegido pelo <span className="font-bold text-slate-900">SSM Digital</span>. Em caso de qualquer intercorrência médica, acione o botão de emergência ao lado para atendimento imediato.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <div className="bg-[#E0F2FE] px-8 py-6 rounded-[1.5rem] border border-blue-100 flex-1 min-w-[240px]">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">LOCALIZAÇÃO PRINCIPAL</p>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
                      <p className="text-sm font-black text-slate-800 line-clamp-2">{companyLocationName}</p>
                    </div>
                  </div>

                  <div className="bg-[#E0F2FE] px-8 py-6 rounded-[1.5rem] border border-blue-100 flex-1 min-w-[240px]">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">COLABORADORES COBERTOS</p>
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-emerald-600 shrink-0" />
                      <p className="text-sm font-black text-slate-800">{employees.length.toLocaleString()} Ativos</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Emergency Button */}
              <div className="shrink-0 relative flex justify-center order-1 xl:order-2">
                <div className={`absolute inset-0 rounded-full blur-[70px] opacity-30 transition-all duration-700 bg-red-600 ${panicStep === 'confirming' ? 'scale-125' : 'scale-100'}`}></div>
                <button
                  onClick={handlePanicClick}
                  disabled={panicStep === 'activating' || panicStep === 'active' || panicStep === 'waiting_dispatch'}
                  className={`relative w-64 h-64 md:w-80 md:h-80 rounded-full flex flex-col items-center justify-center transition-all duration-500 shadow-2xl active:scale-95 group ${panicStep === 'confirming' ? 'bg-orange-600 scale-105' :
                    panicStep === 'active' ? 'bg-emerald-600' :
                      panicStep === 'activating' ? 'bg-slate-900' :
                        panicStep === 'waiting_dispatch' ? 'bg-blue-600' :
                          'bg-red-600 hover:bg-red-700'
                    }`}
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white/15 rounded-full flex items-center justify-center mb-4 md:mb-6">
                    <AlertCircle className="w-10 h-10 md:w-12 md:h-12 text-white" />
                  </div>
                  <span className="text-2xl md:text-3xl font-black text-white uppercase tracking-[0.1em] font-corporate">
                    {panicStep === 'confirming' ? 'CONFIRMAR' : 'EMERGÊNCIA'}
                  </span>
                  <span className="text-[10px] md:text-[11px] font-bold text-white uppercase tracking-widest mt-2 opacity-80">
                    CLIQUE PARA ATIVAR
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Activity className="w-6 h-6 text-red-500" />
                  <h3 className="text-2xl font-black text-slate-900 uppercase font-corporate tracking-tight">Atendimentos em Curso</h3>
                </div>
                <div className="space-y-4">
                  {incidents.filter(i => i.companyId === currentUser.companyId && i.status !== 'resolved').length > 0 ? (
                    incidents
                      .filter(i => i.companyId === currentUser.companyId && i.status !== 'resolved')
                      .map((inc, i) => (
                        <div key={i} className="bg-white p-6 rounded-[2rem] border border-blue-100 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-all cursor-pointer" onClick={() => setActiveIncidentId(inc.id)}>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                              <Activity className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900">{inc.type}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">{inc.timestamp} • {inc.locationName}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                      ))
                  ) : (
                    <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-16 flex flex-col items-center justify-center text-center">
                      <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-4 border border-slate-100"><Info className="w-6 h-6" /></div>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nenhuma emergência ativa.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Clock className="w-6 h-6 text-slate-400" />
                  <h3 className="text-2xl font-black text-slate-900 uppercase font-corporate tracking-tight">Últimos Registos</h3>
                </div>
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                  <div className="bg-[#F8FAFC] px-8 py-5 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">DATA</span>
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">TIPO</span>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {incidents
                      .filter(i => i.companyId === currentUser.companyId && i.status === 'resolved')
                      .slice(0, 5)
                      .map((record, i) => (
                        <div key={i} className="p-8 hover:bg-slate-50 transition-colors group cursor-pointer flex items-center justify-between">
                          <div>
                            <p className="text-base font-black text-slate-900 mb-1">{record.timestamp}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{record.id} - {record.patientName || 'Colaborador Corporativo'}</p>
                          </div>
                          <span className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                            record.priority === 'CRITICAL' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            {record.type}
                          </span>
                        </div>
                      ))}
                    {incidents.filter(i => i.companyId === currentUser.companyId && i.status === 'resolved').length === 0 && (
                       <div className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                         Sem registos históricos.
                       </div>
                    )}
                  </div>
                  <div className="p-8 text-center border-t border-slate-50">
                    <button 
                      onClick={() => alert('A gerar resumo completo de ocorrências históricas em formato PDF...')}
                      className="text-blue-600 text-[11px] font-black uppercase tracking-[0.2em] hover:underline"
                    >
                      VER RELATÓRIO COMPLETO
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {isCallActive && (
              <div className="fixed inset-0 z-[150] bg-slate-900/98 backdrop-blur-2xl flex items-center justify-center p-6 animate-in zoom-in-95 duration-500">
                <div className="w-full max-w-lg bg-white rounded-[4rem] p-12 shadow-2xl text-center relative overflow-hidden border border-white/20">
                  <div className="absolute top-0 left-0 right-0 h-2 bg-red-600 animate-pulse"></div>
                  
                  <div className="flex flex-col items-center mb-10">
                    <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 relative">
                      <div className="absolute inset-0 bg-red-600/20 rounded-full animate-ping"></div>
                      <PhoneCall className="w-8 h-8 relative z-10" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 uppercase font-corporate tracking-tighter leading-none">Linha Prioritária SSM</h3>
                    <div className={`mt-4 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border transition-all ${webrtcState.remoteStream ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100 animate-pulse'}`}>
                      <div className={`w-2 h-2 rounded-full ${webrtcState.remoteStream ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}></div>
                      {webrtcState.remoteStream ? `Chamada Estabelecida • ${formatDuration(callDuration)}` : 'Aguardando Operador...'}
                    </div>
                  </div>

                  {(webrtcState.remoteStream || webrtcState.localStream) && (
                    <div className="relative w-full aspect-video bg-slate-950 rounded-[2.5rem] overflow-hidden mb-10 border-4 border-slate-50 shadow-2xl group transition-all">
                      {webrtcState.remoteStream ? (
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center animate-spin mb-4">
                            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                          </div>
                          <p className="text-[10px] font-black text-white uppercase tracking-widest opacity-40">Encriptando Canal...</p>
                        </div>
                      )}
                      {webrtcState.localStream && (
                        <div className="absolute bottom-5 right-5 w-32 aspect-video bg-slate-900 rounded-2xl overflow-hidden border-2 border-white/20 shadow-lg group-hover:scale-110 transition-transform">
                          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mb-10">
                    <p className="text-base font-bold text-slate-500 leading-relaxed px-6">
                      O Centro de Coordenação está a validar a sua posição GPS e a triagem inicial para despacho imediato.
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    <button onClick={handleEndCall} className="w-full bg-slate-950 hover:bg-red-600 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3">
                      <Phone className="w-5 h-5" /> Encerrar Chamada
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .custom-marker { background: transparent !important; border: none !important; }
      `}</style>
    </div>
  );
};

export default CorporateClientMode;
