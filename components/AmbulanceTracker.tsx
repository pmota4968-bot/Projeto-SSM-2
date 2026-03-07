import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import {
    X, Truck, MapPin, Hospital, Clock,
    Navigation, Shield, Activity, Phone,
    ChevronRight, AlertCircle, CheckCircle2
} from 'lucide-react';
import { EmergencyCase, Company, AmbulanceState } from '../types';

interface AmbulanceTrackerProps {
    incident: EmergencyCase;
    company?: Company;
    onClose: () => void;
}

const AmbulanceTracker: React.FC<AmbulanceTrackerProps> = ({ incident, company, onClose }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const [eta, setEta] = useState(incident.ambulanceState?.eta || 8);
    const [phase, setPhase] = useState(incident.ambulanceState?.phase || 'en_route_to_patient');

    // Posicionamento mockado para simulação
    const patientPos: [number, number] = incident.coords;
    const hospitalPos: [number, number] = [-25.952, 32.598]; // Lenmed Maputo
    const [currentAmbPos, setCurrentAmbPos] = useState<[number, number]>(
        incident.ambulanceState?.currentPos || [-25.965, 32.575]
    );

    const markerRef = useRef<L.Marker | null>(null);
    const routeRef = useRef<L.Polyline | null>(null);

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        mapRef.current = L.map(mapContainerRef.current, {
            zoomControl: false,
            attributionControl: false
        }).setView(currentAmbPos, 14);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);

        // Marker do Paciente/Empresa
        const patientIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="bg-blue-600 p-2 rounded-full border-4 border-white shadow-xl text-white">
               ${company ? `<img src="${company.logo}" class="w-6 h-6 rounded-full" />` : '<Activity width="20" height="20" />'}
             </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        L.marker(patientPos, { icon: patientIcon }).addTo(mapRef.current);

        // Marker do Hospital
        const hospitalIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="bg-emerald-600 p-2 rounded-xl border-2 border-white shadow-xl text-white">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 21V15"/><path d="M8 21v-4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4"/><path d="M10 9h4"/><path d="M12 7v4"/></svg>
             </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });
        L.marker(hospitalPos, { icon: hospitalIcon }).addTo(mapRef.current);

        // Marker da Ambulância
        const ambIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div class="bg-red-600 p-2 rounded-xl border-2 border-white shadow-2xl text-white animate-pulse">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><circle cx="7.5" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/></svg>
             </div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        });
        markerRef.current = L.marker(currentAmbPos, { icon: ambIcon }).addTo(mapRef.current);

        // Rota
        routeRef.current = L.polyline([currentAmbPos, patientPos], {
            color: '#ef4444',
            weight: 4,
            dashArray: '10, 10',
            opacity: 0.6
        }).addTo(mapRef.current);

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Simulação de movimento
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentAmbPos(prev => {
                const target = phase === 'evacuating' ? hospitalPos : patientPos;
                const distLat = target[0] - prev[0];
                const distLng = target[1] - prev[1];

                // Se estiver muito perto, mudar de fase ou parar
                if (Math.abs(distLat) < 0.0005 && Math.abs(distLng) < 0.0005) {
                    if (phase === 'en_route_to_patient') {
                        setPhase('at_patient');
                        setTimeout(() => setPhase('evacuating'), 5000); // 5s no local
                    } else if (phase === 'evacuating') {
                        setPhase('at_hospital');
                        clearInterval(interval);
                    }
                    return prev;
                }

                const nextLat = prev[0] + distLat * 0.1;
                const nextLng = prev[1] + distLng * 0.1;

                if (markerRef.current) markerRef.current.setLatLng([nextLat, nextLng]);
                if (routeRef.current) routeRef.current.setLatLngs([[nextLat, nextLng], target]);

                setEta(prevEta => Math.max(1, prevEta - (Math.random() > 0.9 ? 1 : 0)));
                return [nextLat, nextLng];
            });
        }, 2000);

        return () => clearInterval(interval);
    }, [phase]);

    return (
        <div className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-6xl h-[85vh] rounded-[3rem] shadow-2xl overflow-hidden border border-slate-200 flex flex-col md:flex-row relative">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 z-[400] w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-100 text-slate-400 hover:text-red-600 transition-all active:scale-95"
                >
                    <X className="w-6 h-6" />
                </button>

                {/* Esquerda: Mapa */}
                <div className="flex-1 relative bg-slate-50 min-h-[400px]">
                    <div ref={mapContainerRef} className="absolute inset-0 z-0" />

                    <div className="absolute top-6 left-6 z-10 space-y-3">
                        <div className="bg-white/95 backdrop-blur-sm p-5 rounded-2xl border border-slate-100 shadow-xl w-64">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg animate-pulse">
                                    <Truck className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Unidade Assignada</p>
                                    <p className="text-sm font-black text-slate-900 leading-none">{incident.ambulanceId || 'ALPHA-1'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-6 left-6 z-10 flex gap-4">
                        <div className="bg-blue-600 text-white px-8 py-5 rounded-2xl shadow-xl shadow-blue-600/20">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Chegada Prevista</p>
                            <div className="flex items-baseline gap-2">
                                <h4 className="text-4xl font-black tracking-tighter">{eta}</h4>
                                <span className="text-xs font-bold uppercase tracking-widest">Minutos</span>
                            </div>
                        </div>

                        <div className="bg-white px-8 py-5 rounded-2xl border border-slate-100 shadow-xl">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fase da Missão</p>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${phase === 'at_hospital' ? 'bg-emerald-500' : 'bg-orange-500 animate-pulse'}`}></div>
                                <h4 className="text-sm font-black text-slate-900 uppercase">
                                    {phase === 'en_route_to_patient' ? 'A Caminho do Doente' :
                                        phase === 'at_patient' ? 'No Local (Atendimento)' :
                                            phase === 'evacuating' ? 'Em Evacuação para Hospital' :
                                                'Missão Concluída'}
                                </h4>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Direita: Detalhes da Operação */}
                <div className="w-full md:w-96 bg-white p-10 flex flex-col border-l border-slate-100 custom-scrollbar overflow-y-auto">
                    <div className="mb-10">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight font-corporate uppercase mb-2">Painel de Controlo</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Monitorização em Tempo Real</p>
                    </div>

                    <div className="space-y-8 flex-1">
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Informação do Doente</h4>
                            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-400 border border-slate-100">
                                    <Activity className="w-7 h-7" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900">{incident.patientName || 'Aguardando Triagem'}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{incident.timestamp} • {company?.name}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Equipa na Viatura</h4>
                            <div className="space-y-3">
                                <div className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100">
                                    <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center text-xs font-black">JC</div>
                                    <div>
                                        <p className="text-xs font-black text-slate-900">João Condestável</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Paramédico Sénior</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100">
                                    <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center text-xs font-black">AM</div>
                                    <div>
                                        <p className="text-xs font-black text-slate-900">António Mucavele</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Motorista D1</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100">
                            <div className="flex items-center gap-3 text-blue-700 mb-3">
                                <Shield className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Estado de Segurança</span>
                            </div>
                            <p className="text-xs font-medium text-blue-900 leading-relaxed">
                                Sistema de geofencing ativo. A coordenação será notificada de qualquer desvio na rota planeada.
                            </p>
                        </div>
                    </div>

                    <div className="mt-10 pt-8 border-t border-slate-100 space-y-3">
                        <button className="w-full bg-[#E0F2FE] text-blue-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-100 transition-all">
                            <Phone className="w-4 h-4" /> Ligar para Viatura
                        </button>
                        <button className="w-full bg-[#E0F2FE] text-blue-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-100 transition-all">
                            <Activity className="w-4 h-4" /> Abrir Telemetria Médica
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
        .custom-marker { background: transparent !important; border: none !important; }
        .leaflet-container { background: #f8fafc; border-radius: 0; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
        </div>
    );
};

export default AmbulanceTracker;
