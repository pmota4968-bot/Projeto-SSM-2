import React, { useState, useEffect, useRef } from 'react';
import {
   Truck, CheckCircle, MapPin, Activity, LogOut,
   Bell, MessageSquare, Phone, Video, Send, X, PhoneOff,
   Navigation, FileText, CheckCircle2, Hospital, Flag, Camera, Loader2
} from 'lucide-react';
import { EmergencyCase, AmbulanceState, OperationReport, Driver, CommunicationLog, AdminUser, Company } from '../types';
import L from 'leaflet';
import { auditLogger } from '../services/auditLogger';
import { dbService } from '../services/dbService';
import { WebRTCService, WebRTCState } from '../services/webRTCService';

interface AmbulanceModeProps {
   onLogout: () => void;
   user: AdminUser;
   incident: EmergencyCase | null;
   onUpdateAmbulance: (id: string, updates: Partial<AmbulanceState> | null, finalReport?: OperationReport) => void;
   onUpdateStatus: (id: string, status: 'active' | 'triage' | 'transit' | 'closed') => void;
   imei?: string; // Passed from App.tsx
   companies?: Company[];
}

const AmbulanceMode: React.FC<AmbulanceModeProps> = ({
   onLogout,
   user,
   incident,
   onUpdateAmbulance,
   onUpdateStatus,
   imei,
   companies = []
}) => {
   const adminName = user.name;
   const [timeLeft, setTimeLeft] = useState(30);
   const [showConclusionModal, setShowConclusionModal] = useState(false);
   const [clinicalReport, setClinicalReport] = useState<Partial<OperationReport>>({
      consciousnessState: 'Consciente',
      procedures: [],
      vitalSigns: { bp: '', hr: '', spo2: '' },
      observations: ''
   });
   const [showProfile, setShowProfile] = useState(false);
   const [showChat, setShowChat] = useState(false);
   const [chatMessages, setChatMessages] = useState<CommunicationLog[]>([]);
   const [newMessage, setNewMessage] = useState('');
   const [routePolyline, setRoutePolyline] = useState<L.Polyline | null>(null);
   const [driverDetails, setDriverDetails] = useState<Driver | null>(null);
   const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

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

   const mapContainerRef = useRef<HTMLDivElement>(null);
   const mapRef = useRef<L.Map | null>(null);
   const markerRef = useRef<L.Marker | null>(null);
   const incidentMarkerRef = useRef<L.Marker | null>(null);

   useEffect(() => {
      const fetchDriverDetails = async () => {
         try {
            console.log("Procurando ficha de motorista para ID:", user.id);
            const current = await dbService.getDriverByAuthId(user.id);
            if (current) {
               console.log("Ficha de motorista encontrada:", current);
               setDriverDetails(current);
            } else {
               // Fallback: tentar por nome se não encontrar por ID de auth
               console.warn("Ficha não encontrada por ID, tentando por nome:", adminName);
               const drivers = await dbService.getDrivers();
               const byName = drivers.find(d => d.name === adminName);
               if (byName) setDriverDetails(byName);
            }
         } catch (err) {
            console.error("Erro ao carregar detalhes do motorista:", err);
         }
      };
      fetchDriverDetails();
   }, [user.id, adminName]);

   useEffect(() => {
      if (!webrtcService.current) {
         webrtcService.current = new WebRTCService((stateUpdate) => {
            setWebrtcState(prev => ({ ...prev, ...stateUpdate }));
         });
         // Utilizar ID da ambulância ou um fallback baseado no IMEI ou nome do motorista para WebRTC
         const pId = incident?.ambulanceState?.id 
            ? `ssm-amb-${incident.ambulanceState.id}` 
            : imei ? `ssm-amb-${imei}` : `ssm-amb-local-${adminName.replace(/\s+/g, '-')}`;
         
         webrtcService.current.initialize(pId);
      }

      return () => {
         webrtcService.current?.destroy();
         webrtcService.current = null;
      };
   }, [incident?.ambulanceState?.id]);

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

   // Real-time GPS Tracking
   useEffect(() => {
      if (!imei || !navigator.geolocation) return;

      const watchId = navigator.geolocation.watchPosition(
         async (position) => {
            const { latitude, longitude, speed, heading } = position.coords;
            const coords: [number, number] = [latitude, longitude];

            try {
               // Log to database for real-time tracking on dashboard
               await dbService.logGpsTrack(imei, coords, speed || 0, heading || 0);

               // Update local map
               if (mapRef.current) {
                  if (!markerRef.current) {
                     const ambIcon = L.divIcon({
                        className: 'custom-marker',
                        html: `<div class="bg-blue-600 p-2 rounded-full border-2 border-white shadow-xl text-white"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg></div>`,
                        iconSize: [32, 32],
                        iconAnchor: [16, 16]
                     });
                     markerRef.current = L.marker(coords, { icon: ambIcon }).addTo(mapRef.current);
                  } else {
                     markerRef.current.setLatLng(coords);
                  }
                  mapRef.current.panTo(coords);
               }
            } catch (err) {
               console.error("Erro ao enviar GPS:", err);
            }
         },
         (error) => console.error("Erro de Geolocalização:", error),
         { enableHighAccuracy: true }
      );

      return () => navigator.geolocation.clearWatch(watchId);
   }, [imei]);

   useEffect(() => {
      let timer: number;
      if (incident?.ambulanceState?.phase === 'pending_accept') {
         // Alerta sonoro de emergência
         const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'); 
         audio.loop = true;
         audio.play().catch(e => console.log("Audio auto-play blocked"));

         setTimeLeft(30); 
         timer = window.setInterval(() => setTimeLeft(prev => prev - 1), 1000);
         
         return () => {
            clearInterval(timer);
            audio.pause();
         };
      } else if (timeLeft === 0 && incident?.ambulanceState?.phase === 'pending_accept') {
         onUpdateAmbulance(incident.id, null);
         alert("Timeout de Aceitação: O despacho foi removido e reatribuído.");
      }
      return () => clearInterval(timer);
   }, [incident?.id, incident?.ambulanceState?.phase]);

   // Update Route on Map
   useEffect(() => {
      const updateRoute = async () => {
         if (mapRef.current && incident && markerRef.current) {
            // Clear previous markers/lines
            if (incidentMarkerRef.current) mapRef.current.removeLayer(incidentMarkerRef.current);
            if (routePolyline) mapRef.current.removeLayer(routePolyline);

            let destination: [number, number] | null = null;
            let destName = "";

            if (incident.ambulanceState?.phase === 'en_route_to_patient') {
               destination = incident.coords;
               destName = incident.locationName;
            } else if (incident.ambulanceState?.phase === 'evacuating') {
               // Try to find hospital coords
               try {
                  const resources = await dbService.getResources();
                  const hospital = resources.find(r => r.category === 'hospital' && r.name === clinicalReport.hospitalName) 
                                 || resources.find(r => r.category === 'hospital'); // Fallback to first hospital
                  if (hospital && hospital.location) {
                     // Tentar extrair coordenadas da string de localização ou usar campo específico se existir
                     try {
                        const parsed = JSON.parse(hospital.location);
                        if (Array.isArray(parsed)) destination = parsed as [number, number];
                     } catch {
                        // Fallback se não for JSON, pode ser uma string descritiva
                        console.warn("Localização do hospital não está em formato de coordenadas geográficas.");
                     }
                     destName = hospital.name;
                  }
               } catch (err) {
                  console.error("Erro ao buscar hospital:", err);
               }
            }

            if (destination) {
               const origin = markerRef.current.getLatLng();

               // Add destination marker
               const destIcon = L.divIcon({
                  className: 'dest-marker',
                  html: `<div class="bg-red-600 p-2 rounded-lg border-2 border-white shadow-xl text-white"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
                  iconSize: [32, 32],
                  iconAnchor: [16, 32]
               });
               incidentMarkerRef.current = L.marker(destination, { icon: destIcon }).addTo(mapRef.current);
               incidentMarkerRef.current.bindPopup(`<b>Destino:</b> ${destName}`).openPopup();

               // Draw simple route
               const line = L.polyline([origin, destination], {
                  color: '#3b82f6',
                  weight: 6,
                  opacity: 0.8,
                  dashArray: '10, 10',
                  lineJoin: 'round'
               }).addTo(mapRef.current);

               setRoutePolyline(line);

               // Fit bounds to show both
               const bounds = L.latLngBounds([origin, destination]);
               mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            }
         } else if (!incident || incident.ambulanceState?.phase === 'idle') {
            if (incidentMarkerRef.current && mapRef.current) mapRef.current.removeLayer(incidentMarkerRef.current);
            if (routePolyline && mapRef.current) mapRef.current.removeLayer(routePolyline);
            setRoutePolyline(null);
         }
      };

      updateRoute();
   }, [incident, incident?.coords, incident?.ambulanceState?.phase]);

   // Chat Management
   useEffect(() => {
      if (incident && showChat) {
         const fetchMessages = async () => {
            const logs = await dbService.getCommunicationLogs(incident.id);
            setChatMessages(logs);
         };
         fetchMessages();

         const sub = dbService.subscribeToChat(incident.id, (payload) => {
            const newLog = payload.new;
            setChatMessages(prev => [...prev, {
               id: newLog.id,
               incidentId: newLog.incident_id,
               senderId: newLog.sender_id,
               senderName: newLog.sender_name,
               senderRole: newLog.sender_role,
               recipient: newLog.recipient,
               message: newLog.message,
               type: newLog.type,
               isCritical: newLog.is_critical,
               timestamp: newLog.timestamp
            }]);
         });

         return () => sub.unsubscribe();
      }
   }, [incident?.id, showChat]);

   useEffect(() => {
      if (mapContainerRef.current && !mapRef.current) {
         mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView([-25.9692, 32.5732], 15);
         L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      }

      return () => {
         if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
         }
      };
   }, []);

   const handleAccept = () => {
      if (incident) {
         onUpdateAmbulance(incident.id, { phase: 'en_route_to_patient' });
         auditLogger.log({ id: driverDetails?.id || 'UNKNOWN_DRV', name: adminName, role: 'MOTORISTA_AMB' }, 'MISSION_ACCEPTED_FIELD', incident.id);
      }
   };

   const handleReject = () => {
      if (incident) {
         onUpdateAmbulance(incident.id, null);
         auditLogger.log({ id: driverDetails?.id || 'UNKNOWN_DRV', name: adminName, role: 'MOTORISTA_AMB' }, 'MISSION_REJECTED_FIELD', incident.id);
      }
   };

   const handleArrivalAtPatient = () => {
      onUpdateAmbulance(incident!.id, { phase: 'at_patient' });
      onUpdateStatus(incident!.id, 'triage');
   };

   const handleStartEvacuation = () => {
      onUpdateAmbulance(incident!.id, { phase: 'evacuating' });
      onUpdateStatus(incident!.id, 'transit');
   };

   const handleHospitalArrival = () => {
      onUpdateAmbulance(incident!.id, { phase: 'at_hospital' });
      setShowConclusionModal(true);
   };

   const finalizeMission = () => {
      const fullReport: OperationReport = {
         ...(clinicalReport as OperationReport),
         incidentId: incident!.id,
         paramedicName: adminName,
         timestamps: {
            dispatched: incident!.ambulanceState?.timestamps?.dispatched || '',
            arrivedAtPatient: new Date().toLocaleTimeString(),
            leftForHospital: new Date().toLocaleTimeString(),
            arrivedAtHospital: new Date().toLocaleTimeString()
         }
      };

      onUpdateAmbulance(incident!.id, { phase: 'idle' }, fullReport);
      onUpdateStatus(incident!.id, 'closed');
      setShowConclusionModal(false);
      auditLogger.log({ id: driverDetails?.id || 'UNKNOWN_DRV', name: adminName, role: 'MOTORISTA_AMB' }, 'MISSION_FINALIZED_WITH_REPORT', incident!.id);
      alert("Operação Concluída. Relatório enviado para o Centro de Comando.");
   };

   const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
         alert("A imagem deve ter menos de 2MB.");
         return;
      }

      setIsUpdatingAvatar(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
         const base64String = reader.result as string;
         try {
            // 1. Atualizar na ficha de motorista (drivers)
            if (driverDetails) {
               const updated = { ...driverDetails, avatar: base64String };
               await dbService.saveDriver(updated);
               setDriverDetails(updated);
            }
            
            // 2. Atualizar no perfil global (profiles) e Auth Metadata
            await dbService.updateProfile(user.id, { avatar: base64String });
            
            // O App.tsx via handleUpdateUser normalmente faria o auth.updateUser, 
            // mas como estamos aqui, vamos forçar uma atualização local se necessário 
            // ou confiar que o re-fetch no login resolverá. 
            // Para feedback imediato, já atualizamos o estado local.
            
            console.log("Avatar atualizado em todos os níveis.");
         } catch (err) {
            console.error("Erro ao atualizar avatar:", err);
            alert("Erro ao atualizar avatar.");
         } finally {
            setIsUpdatingAvatar(false);
         }
      };
      reader.readAsDataURL(file);
   };

   const updateDriverStatus = async (newStatus: Driver['status']) => {
      if (driverDetails) {
         try {
            const updated = { ...driverDetails, status: newStatus };
            // Atualizar na tabela drivers
            await dbService.saveDriver(updated);
            setDriverDetails(updated);
            
            // Sincronizar com o campo status da tabela profiles (se existir) ou apenas persistir no drivers
            await dbService.updateDriverByAuthId(user.id, { status: newStatus });
            
            console.log(`Estado de serviço alterado para: ${newStatus}`);
         } catch (err) {
            console.error("Erro ao atualizar status:", err);
            alert("Erro ao mudar estado de serviço.");
         }
      }
   };

   const handleAnswerCall = (video: boolean) => {
      if (webrtcState.incomingCall) {
         webrtcService.current?.answerCall(webrtcState.incomingCall, video);
      }
   };

   const handleEndCall = () => {
      webrtcService.current?.endCall();
   };

   const handleSendMessage = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !incident) return;

      const log = {
         incidentId: incident.id,
         senderId: driverDetails?.id || 'UNKNOWN_DRV',
         senderName: adminName,
         senderRole: 'MOTORISTA_AMB',
         recipient: 'Central de Coordenação',
         message: newMessage,
         type: 'SYSTEM',
         isCritical: false
      };

      try {
         await dbService.saveCommunicationLog(log);
         setNewMessage('');
      } catch (err) {
         console.error("Erro ao enviar mensagem:", err);
      }
   };

   return (
      <div className="h-screen w-screen flex flex-col bg-slate-900 overflow-hidden font-sans text-white">
         <header className="h-16 bg-slate-950 border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-50">
            <div className="flex items-center gap-3">
               <div className="bg-red-600 p-2 rounded-lg text-white shadow-lg"><Truck className="w-5 h-5" /></div>
               <button 
                  onClick={() => setShowProfile(true)}
                  className="text-left group"
               >
                  <h1 className="text-sm font-black uppercase tracking-widest font-corporate leading-none flex items-center gap-2 group-hover:text-blue-400 transition-colors">
                     Terminal Operativo SSM
                  </h1>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase group-hover:text-slate-200">{adminName} • UNIDADE MÓVEL</p>
               </button>
            </div>
            <button onClick={onLogout} className="p-2 text-slate-500 hover:text-white"><LogOut className="w-5 h-5" /></button>
         </header>

         <div className="flex-1 relative">
            <div ref={mapContainerRef} className="absolute inset-0 z-0 grayscale" />

            {incident?.ambulanceState?.phase === 'pending_accept' && (
               <div className="absolute inset-0 flex items-center justify-center p-6 z-40 bg-slate-900/80 backdrop-blur-xl">
                  <div className="w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl flex flex-col items-center text-center text-slate-900 border-t-[12px] border-red-600">
                     <div className="w-20 h-20 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6 relative">
                        <Bell className="w-10 h-10 animate-swing" />
                        <div className="absolute -top-2 -right-2 bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center text-xs font-black">{timeLeft}s</div>
                     </div>
                     <h2 className="text-2xl font-black font-corporate uppercase tracking-tight">Solicitação de Despacho</h2>
                     <div className="bg-slate-50 w-full p-6 rounded-2xl border border-slate-100 my-8 text-left">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Empresa Solicitante</p>
                        <p className="text-sm font-black text-blue-600 mb-3">{companies.find(c => c.id === incident.companyId)?.name || 'Cliente Corporativo'}</p>
                        
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Destino do Alerta</p>
                        <p className="text-base font-black text-slate-900">{incident.locationName}</p>
                     </div>
                     <div className="flex gap-4 w-full">
                        <button onClick={handleReject} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-500 py-5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">Rejeitar</button>
                        <button onClick={handleAccept} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Aceitar Missão</button>
                     </div>
                  </div>
               </div>
            )}

            {incident?.ambulanceState && incident.ambulanceState.phase !== 'idle' && incident.ambulanceState.phase !== 'pending_accept' && (
               <div className="absolute bottom-6 left-6 right-6 z-10 animate-in slide-in-from-bottom-4">
                  <div className="bg-slate-950/95 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 shadow-2xl flex flex-col gap-6">
                     {webrtcState.activeCall && (
                        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10">
                           <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                           <div className="absolute bottom-2 right-2 w-24 aspect-video bg-slate-800 rounded-lg overflow-hidden border border-white/10">
                              <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                           </div>
                           <button onClick={handleEndCall} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-600 p-4 rounded-full text-white shadow-xl">
                              <PhoneOff className="w-6 h-6" />
                           </button>
                        </div>
                     )}

                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Navigation className="w-6 h-6" /></div>
                           <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                 {incident.ambulanceState.phase === 'en_route_to_patient' ? 'A Caminho do Paciente' :
                                    incident.ambulanceState.phase === 'at_patient' ? 'Intervenção no Local' :
                                       'Evacuação para Unidade Hospitalar'}
                              </p>
                              <p className="text-lg font-black">{incident.locationName}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <button 
                              onClick={() => setShowChat(true)}
                              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white transition-all active:scale-95 relative"
                           >
                              <MessageSquare className="w-6 h-6" />
                              <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-slate-900"></div>
                           </button>
                           <button 
                              onClick={webrtcState.activeCall ? handleEndCall : () => alert('A iniciar ligação para a central...')}
                              className={`p-3 rounded-2xl text-white transition-all active:scale-95 ${webrtcState.activeCall ? 'bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                           >
                              {webrtcState.activeCall ? <PhoneOff className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                           </button>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {incident.ambulanceState.phase === 'en_route_to_patient' && (
                           <button onClick={handleArrivalAtPatient} className="w-full bg-white text-slate-900 py-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                              <CheckCircle className="w-4 h-4" /> Chegada ao Local
                           </button>
                        )}
                        {incident.ambulanceState.phase === 'at_patient' && (
                           <button onClick={handleStartEvacuation} className="w-full bg-blue-600 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                              <Hospital className="w-4 h-4" /> Iniciar Transporte
                           </button>
                        )}
                        {incident.ambulanceState.phase === 'evacuating' && (
                           <button onClick={handleHospitalArrival} className="w-full bg-emerald-600 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                              <Flag className="w-4 h-4" /> Entrega Hospitalar
                           </button>
                        )}
                     </div>
                  </div>
               </div>
            )}

            {/* Modal de Chamada Recebida */}
            {webrtcState.incomingCall && (
               <div className="absolute inset-0 z-[150] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6">
                  <div className="w-full max-w-sm bg-white rounded-[3rem] p-10 shadow-2xl flex flex-col items-center text-center text-slate-900 border-t-[12px] border-blue-600 animate-in zoom-in-95">
                     <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6 relative">
                        <Phone className="w-10 h-10 animate-bounce" />
                        <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
                     </div>
                     <h2 className="text-2xl font-black font-corporate uppercase tracking-tight">Chamada da Central</h2>
                     <p className="text-slate-500 font-medium mt-2">A Central de Comando está a tentar contactar esta unidade.</p>

                     <div className="grid grid-cols-2 gap-4 w-full mt-10">
                        <button onClick={() => handleAnswerCall(false)} className="bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2">
                           <Phone className="w-4 h-4" /> Voz
                        </button>
                        <button onClick={() => handleAnswerCall(true)} className="bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2">
                           <Video className="w-4 h-4" /> Vídeo
                        </button>
                        <button onClick={() => webrtcService.current?.endCall()} className="col-span-2 bg-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">
                           Recusar
                        </button>
                     </div>
                  </div>
               </div>
            )}
         </div>

         {showConclusionModal && (
            <div className="fixed inset-0 z-[200] bg-slate-950 flex flex-col p-6 animate-in slide-in-from-bottom-8 overflow-y-auto">
               <div className="max-w-2xl mx-auto w-full space-y-10 py-10">
                  <div className="flex items-center justify-between border-b border-white/10 pb-6">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center"><FileText className="w-6 h-6" /></div>
                        <div>
                           <h3 className="text-xl font-black uppercase font-corporate">Relatório de Conclusão Clínica</h3>
                           <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Obrigatório para Finalização (Módulo 3)</p>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Sinais Vitais na Entrega</h4>
                        <div className="space-y-4">
                           <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1.5">Estado de Consciência</label>
                              <select
                                 value={clinicalReport.consciousnessState}
                                 onChange={e => setClinicalReport({ ...clinicalReport, consciousnessState: e.target.value as any })}
                                 className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                              >
                                 <option value="Consciente">Consciente (GCS 15)</option>
                                 <option value="Confuso">Confuso / Desorientado</option>
                                 <option value="Inconsciente">Inconsciente / Responsivo a Dor</option>
                                 <option value="Comatoso">Comatoso (GCS &lt; 8)</option>
                              </select>
                           </div>
                           <div className="grid grid-cols-3 gap-3">
                              <div>
                                 <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1.5">T.A (mmHg)</label>
                                 <input 
                                    type="text" 
                                    placeholder="120/80" 
                                    value={clinicalReport.vitalSigns?.bp}
                                    onChange={e => setClinicalReport({ ...clinicalReport, vitalSigns: { ...clinicalReport.vitalSigns, bp: e.target.value } as any })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all font-bold" 
                                 />
                              </div>
                              <div>
                                 <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1.5">F.C (bpm)</label>
                                 <input 
                                    type="text" 
                                    placeholder="72" 
                                    value={clinicalReport.vitalSigns?.hr}
                                    onChange={e => setClinicalReport({ ...clinicalReport, vitalSigns: { ...clinicalReport.vitalSigns, hr: e.target.value } as any })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all font-bold" 
                                 />
                              </div>
                              <div>
                                 <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1.5">SpO2 (%)</label>
                                 <input 
                                    type="text" 
                                    placeholder="98" 
                                    value={clinicalReport.vitalSigns?.spo2}
                                    onChange={e => setClinicalReport({ ...clinicalReport, vitalSigns: { ...clinicalReport.vitalSigns, spo2: e.target.value } as any })}
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 transition-all font-bold" 
                                 />
                              </div>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Procedimentos de Campo</h4>
                         <div className="grid grid-cols-1 gap-2">
                            {['Oxigenoterapia', 'Acesso Venoso', 'Imobilização', 'Medicação IV', 'Monitorização ECG'].map(proc => (
                               <label key={proc} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all">
                                  <input 
                                    type="checkbox" 
                                    className="rounded bg-slate-700 w-4 h-4 text-blue-600" 
                                    checked={clinicalReport.procedures?.includes(proc)}
                                    onChange={e => {
                                       const updated = e.target.checked 
                                          ? [...(clinicalReport.procedures || []), proc]
                                          : (clinicalReport.procedures || []).filter(p => p !== proc);
                                       setClinicalReport({ ...clinicalReport, procedures: updated });
                                    }}
                                  />
                                  <span className="text-xs font-bold">{proc}</span>
                               </label>
                            ))}
                         </div>
                     </div>
                  </div>

                   <div className="space-y-4">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Observações e Histórico de Intervenção</label>
                      <textarea 
                         value={clinicalReport.observations}
                         onChange={e => setClinicalReport({ ...clinicalReport, observations: e.target.value })}
                         className="w-full h-32 bg-slate-800 border border-white/10 rounded-2xl p-4 text-sm outline-none focus:border-blue-500 resize-none font-medium" 
                         placeholder="Descreva o estado do paciente na entrega..."
                      ></textarea>
                   </div>

                  <div className="flex gap-4 pt-6 border-t border-white/10">
                     <button onClick={() => setShowConclusionModal(false)} className="flex-1 py-5 bg-white/5 hover:bg-white/10 rounded-2xl font-black uppercase text-[10px] tracking-widest">Voltar</button>
                     <button onClick={finalizeMission} className="flex-[2] py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3">
                        <CheckCircle2 className="w-5 h-5" /> Submeter Relatório e Finalizar
                     </button>
                  </div>
               </div>
            </div>
         )}

         {/* Painel de Comunicação (Chat) */}
         {showChat && (
            <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-lg h-[600px] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95">
                  <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center"><MessageSquare className="w-5 h-5" /></div>
                        <div>
                           <h3 className="text-sm font-black uppercase tracking-tight">Coordenação</h3>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chat em Tempo Real</p>
                        </div>
                     </div>
                     <button onClick={() => setShowChat(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-slate-50">
                     {chatMessages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                           <MessageSquare className="w-12 h-12 opacity-20" />
                           <p className="text-[10px] font-black uppercase tracking-widest">Sem mensagens ainda</p>
                        </div>
                     ) : (
                        chatMessages.map((msg, i) => (
                           <div key={i} className={`flex flex-col ${msg.senderRole === 'MOTORISTA_AMB' ? 'items-end' : 'items-start'}`}>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{msg.senderName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                              <div className={`max-w-[80%] p-4 rounded-2xl text-xs font-bold leading-relaxed ${
                                 msg.senderRole === 'MOTORISTA_AMB' 
                                    ? 'bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-600/20' 
                                    : 'bg-white text-slate-900 rounded-tl-none shadow-sm border border-slate-100'
                              }`}>
                                 {msg.message}
                              </div>
                           </div>
                        ))
                     )}
                  </div>

                  <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100 flex gap-2">
                     <input 
                        type="text" 
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Escrever para coordenação..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-blue-600 transition-all text-slate-900"
                     />
                     <button type="submit" className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
                        <Send className="w-5 h-5" />
                     </button>
                  </form>
               </div>
            </div>
         )}

         {/* Modal de Perfil do Motorista */}
         {showProfile && (
            <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95">
                  <div className="bg-slate-900 p-8 text-white text-center relative overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-b from-blue-600/20 to-transparent"></div>
                     <button onClick={() => setShowProfile(false)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-all z-10"><X className="w-6 h-6" /></button>
                     
                     <div className="relative w-32 h-32 mx-auto mb-4 group">
                        <div className="w-full h-full bg-blue-600 rounded-[2.5rem] flex items-center justify-center text-4xl font-black shadow-2xl border-4 border-white overflow-hidden relative">
                           {isUpdatingAvatar ? (
                              <Loader2 className="w-10 h-10 animate-spin text-white/50" />
                           ) : (driverDetails?.avatar || user.avatar) ? (
                              <img src={driverDetails?.avatar || user.avatar} className="w-full h-full object-cover" alt="Profile" />
                           ) : (
                              adminName[0]
                           )}
                        </div>
                        <label className="absolute bottom-0 right-0 p-2 bg-blue-500 text-white rounded-xl shadow-lg border-2 border-white cursor-pointer hover:bg-emerald-500 transition-all z-20 hover:scale-110 active:scale-90 shadow-blue-500/40">
                           <Camera className="w-4 h-4" />
                           <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={isUpdatingAvatar} />
                        </label>
                     </div>

                     <h3 className="text-xl font-black uppercase tracking-tight relative z-10">{adminName}</h3>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 relative z-10">Motorista de Emergência</p>
                  </div>

                  <div className="p-8 space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Licença</p>
                           <p className="text-sm font-black text-slate-900">{driverDetails?.licenseNumber || '---'}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Contacto</p>
                           <p className="text-sm font-black text-slate-900">{driverDetails?.phone || '---'}</p>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="flex items-center justify-between ml-1">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Estado de Serviço</p>
                           {driverDetails?.status && (
                              <div className={`w-2 h-2 rounded-full animate-pulse ${
                                 driverDetails.status === 'available' ? 'bg-emerald-500' : 
                                 driverDetails.status === 'break' ? 'bg-amber-500' : 'bg-red-500'
                              }`}></div>
                           )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           {[
                              { id: 'available', label: 'Disponível' },
                              { id: 'break', label: 'Em Pausa' },
                              { id: 'off_duty', label: 'Fora de Serviço' }
                           ].map(status => (
                              <button 
                                 key={status.id}
                                 onClick={() => updateDriverStatus(status.id as any)}
                                 className={`p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                                    driverDetails?.status === status.id 
                                       ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20 scale-[1.02]' 
                                       : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200 hover:text-slate-600'
                                 }`}
                              >
                                 {status.label}
                              </button>
                           ))}
                        </div>
                     </div>

                     <button 
                        onClick={onLogout}
                        className="w-full py-5 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 group shadow-sm active:scale-95"
                     >
                        <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Terminar Sessão
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default AmbulanceMode;
