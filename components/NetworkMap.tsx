
import React, { useEffect, useRef, useState } from 'react';
import {
  Layers, Hospital, Truck, AlertCircle, MapPin,
  Activity, User, Phone, Shield, Heart, FileText, X,
  Navigation, Info, AlertTriangle, CheckCircle2, Globe, Map as MapIcon,
  Maximize2, Minimize2, Crosshair
} from 'lucide-react';
import { EmergencyCase, Employee, Company, Resource } from '../types';
import { loadGoogleMaps } from '../services/googleMapsLoader';

interface NetworkMapProps {
  incidents: EmergencyCase[];
  resources?: Resource[];
  companies?: Company[];
  employees?: Employee[];
  hideSidebar?: boolean;
}

const NetworkMap: React.FC<NetworkMapProps> = ({
  incidents,
  resources = [],
  companies = [],
  employees = [],
  hideSidebar = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [activeSideTab, setActiveSideTab] = useState<'recursos' | 'ocorrencias'>('ocorrencias');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'local' | 'national'>('local');
  const [showLegend, setShowLegend] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (apiKey) {
      loadGoogleMaps(apiKey).then(() => setIsApiReady(true));
    }
  }, []);

  useEffect(() => {
    // Show legend by default on larger screens
    if (window.innerWidth >= 768) {
      setShowLegend(true);
    }
  }, []);

  const providers = resources.map(res => {
    let coords: [number, number] = [-25.9692, 32.5732]; // Default
    try {
      if (res.location) {
        const parsed = JSON.parse(res.location);
        if (Array.isArray(parsed)) coords = parsed as [number, number];
      }
    } catch (e) {}

    return {
      id: res.id,
      type: res.category,
      pos: { lat: coords[0], lng: coords[1] },
      label: res.name,
      address: res.location && !res.location.startsWith('[') ? res.location : (res.category === 'hospital' ? 'Unidade Hospitalar' : 'Unidade Móvel'),
      phone: '+258 84 000 0000',
      status: res.status,
      province: 'Maputo'
    };
  });

  const setMapToNational = () => {
    if (!mapRef.current) return;
    setViewMode('national');
    mapRef.current.setZoom(6);
    mapRef.current.panTo({ lat: -18.6657, lng: 35.5296 });
  };

  const setMapToLocal = () => {
    if (!mapRef.current) return;
    setViewMode('local');
    mapRef.current.setZoom(13);
    mapRef.current.panTo({ lat: -25.9692, lng: 32.5732 });
  };

  useEffect(() => {
    if (!isApiReady || !mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = new google.maps.Map(mapContainerRef.current, {
        center: { lat: -25.9692, lng: 32.5732 },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_BOTTOM
        },
        styles: [
          {
            "featureType": "all",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#616773" }]
          },
          {
            "featureType": "all",
            "elementType": "labels.text.stroke",
            "stylers": [{ "visibility": "on" }, { "color": "#ffffff" }, { "weight": 2 }, { "gamma": 1 }]
          },
          {
            "featureType": "administrative",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#ff0000" }, { "visibility": "off" }]
          },
          {
            "featureType": "administrative",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#c0c0c0" }, { "visibility": "on" }, { "weight": 0.8 }]
          },
          {
            "featureType": "landscape",
            "elementType": "geometry",
            "stylers": [{ "color": "#f5f5f5" }, { "visibility": "on" }]
          },
          {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{ "color": "#d7e8ff" }]
          }
        ]
      });
    }

    // Update Markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    // Incidents
    incidents.forEach(inc => {
      const company = companies.find(c => c.id === inc.companyId);
      const marker = new google.maps.Marker({
        position: { lat: inc.coords[0], lng: inc.coords[1] },
        map: mapRef.current,
        title: company?.name || 'Incidente',
        icon: {
            url: company?.logo || 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
        }
      });
      marker.addListener('click', () => setSelectedIncidentId(inc.id));
      markersRef.current.push(marker);
    });

    // Resources
    providers.forEach(p => {
      const isHospital = p.type === 'hospital';
      const marker = new google.maps.Marker({
        position: p.pos,
        map: mapRef.current,
        title: p.label,
        icon: {
          path: isHospital ? google.maps.SymbolPath.CIRCLE : "M 0,0 L 20,0 L 20,20 L 0,20 Z",
          fillColor: isHospital ? '#059669' : '#2563eb', // green-600, blue-600
          fillOpacity: 0.9,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          scale: isHospital ? 8 : 1
        }
      });
      marker.addListener('click', () => setSelectedProviderId(p.id));
      markersRef.current.push(marker);
    });

  }, [isApiReady, incidents, resources, selectedProviderId]);

  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);
  const selectedEmployee = selectedIncident ? employees.find(e => e.id === selectedIncident.employeeId) : null;
  const selectedCompany = selectedIncident ? companies.find(c => c.id === selectedIncident.companyId) : null;

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-20 text-center h-[600px]">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-6" />
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Chave de API em falta</h3>
        <p className="text-slate-500 max-w-sm mt-2 text-sm font-medium">Por favor, adicione <code className="bg-slate-100 px-2 py-1 rounded text-red-600">VITE_GOOGLE_MAPS_API_KEY</code> ao seu ficheiro .env para ativar os mapas reais.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-1 shadow-sm flex flex-col h-full min-h-[600px] relative overflow-hidden">
      <div className="p-5 flex items-center justify-between bg-white/80 backdrop-blur border-b border-slate-100 z-20">
        <div className="flex items-center gap-4">
          <div className="bg-red-600 text-white p-2.5 rounded-xl shadow-lg shadow-red-600/20">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight font-corporate uppercase">Mapa G-Maps Live</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] flex items-center gap-2">
              <Navigation className="w-3 h-3 text-red-500" /> Rede de Cuidados SSM Maputo
            </p>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button onClick={setMapToLocal} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'local' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            <MapIcon className="w-3.5 h-3.5" /> Maputo
          </button>
          <button onClick={setMapToNational} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'national' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
            <Globe className="w-3.5 h-3.5" /> Moçambique
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row relative">
        {!hideSidebar && (
          <div className="w-full md:w-80 bg-white border-r border-slate-100 flex flex-col z-10">
            <div className="flex bg-slate-50/50 p-1 m-4 rounded-xl border border-slate-200">
              <button onClick={() => { setActiveSideTab('ocorrencias'); setSelectedIncidentId(null); }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeSideTab === 'ocorrencias' && !selectedIncidentId ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Ocorrências</button>
              <button onClick={() => { setActiveSideTab('recursos'); setSelectedIncidentId(null); }} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeSideTab === 'recursos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Recursos</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar">
              {selectedIncidentId && selectedEmployee ? (
                <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Info className="w-3.5 h-3.5" /> Ficha Médica SSM</h4>
                    <button onClick={() => setSelectedIncidentId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all"><X className="w-4 h-4 text-slate-400" /></button>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-white overflow-hidden border border-slate-100 shadow-sm">
                        <img src={selectedCompany?.logo} alt="Logo" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-black text-slate-900 leading-none truncate">{selectedEmployee.name}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase mt-1 truncate">{selectedCompany?.name}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Tipo Sanguíneo</p>
                        <p className="text-sm font-black text-red-600">{selectedEmployee.bloodType}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Seguradora</p>
                        <p className="text-xs font-black text-slate-900 truncate">{selectedEmployee.insurer}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Contacto Emergência</p>
                      <p className="text-xs font-black text-slate-900">{selectedEmployee.emergencyContact.name}</p>
                      <p className="text-xs text-blue-600 font-bold">{selectedEmployee.emergencyContact.phone}</p>
                    </div>
                    <button className="w-full bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2"><FileText className="w-3.5 h-3.5" /> Ver Historial Clínico</button>
                  </div>
                </div>
              ) : activeSideTab === 'ocorrencias' ? (
                <div className="space-y-2">
                  {incidents.map(inc => {
                    const company = companies.find(c => c.id === inc.companyId);
                    return (
                      <div key={inc.id} onClick={() => { setSelectedIncidentId(inc.id); if (mapRef.current) { mapRef.current.panTo({ lat: inc.coords[0], lng: inc.coords[1] }); mapRef.current.setZoom(16); } }} className="bg-white p-3 rounded-xl border border-slate-100 hover:border-red-500 hover:shadow-md cursor-pointer transition-all flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-lg bg-slate-50 flex-shrink-0 overflow-hidden border border-slate-100 group-hover:border-red-100"><img src={company?.logo} alt="Logo" className="w-full h-full object-cover" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center"><span className="text-xs font-black text-slate-900 truncate">{company?.name}</span><span className="text-[8px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded">SOS</span></div>
                          <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{inc.type}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(new Set(providers.map(p => p.province))).map(prov => (
                    <div key={prov} className="space-y-2">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{prov}</div>
                      {providers.filter(p => p.province === prov).map(p => {
                        const isOccupied = p.status.toLowerCase().includes('ocupado');
                        const isAvailable = p.status.toLowerCase().includes('disponível') || p.status.toLowerCase().includes('vagas') || p.status.toLowerCase().includes('operacional');
                        const isSelected = selectedProviderId === p.id;
                        return (
                          <div key={p.id} onClick={() => { setSelectedProviderId(p.id); if (mapRef.current) { mapRef.current.panTo(p.pos); mapRef.current.setZoom(15); } }} className={`bg-white p-3 rounded-xl border transition-all shadow-sm flex items-center gap-3 cursor-pointer ${isSelected ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-blue-500'}`}>
                            <div className={`p-2 rounded-lg ${p.type === 'hospital' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{p.type === 'hospital' ? <Hospital className="w-4 h-4" /> : <Truck className="w-4 h-4" />}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-black text-slate-900 leading-none mb-1 truncate">{p.label}</div>
                              <div className={`text-[9px] font-bold uppercase flex items-center gap-1.5 ${isOccupied ? 'text-orange-500' : isAvailable ? 'text-emerald-500' : 'text-slate-400'}`}>{isOccupied ? <AlertTriangle className="w-2.5 h-2.5" /> : isAvailable ? <CheckCircle2 className="w-2.5 h-2.5" /> : null}{p.status}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 relative bg-slate-50">
          <div ref={mapContainerRef} className="absolute inset-0 z-0" />
          <div className="absolute top-6 left-6 z-[20] flex flex-col gap-2 pointer-events-none">
            <div className="flex flex-col items-start gap-2">
              <button
                onClick={() => setShowLegend(!showLegend)}
                className="bg-white/90 backdrop-blur p-3 rounded-2xl border border-slate-200 shadow-xl pointer-events-auto flex items-center gap-2 text-slate-700 hover:text-blue-600 transition-all font-black uppercase text-[10px]"
              >
                <Layers className="w-4 h-4" />
                <span>Legenda</span>
              </button>

              {showLegend && (
                <div className="bg-white/90 backdrop-blur px-4 py-2.5 rounded-2xl border border-slate-200 shadow-xl flex flex-col md:flex-row gap-3 md:gap-6 animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-auto">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-600 ring-4 ring-red-100"></div><span className="text-[10px] font-black uppercase text-slate-700">Emergência Ativa</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-emerald-100"></div><span className="text-[10px] font-black uppercase text-slate-700">Rede Hospitalar</span></div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-600 ring-4 ring-blue-100"></div><span className="text-[10px] font-black uppercase text-slate-700">Rede Ambulatorial</span></div>
                </div>
              )}
            </div>
            {viewMode === 'national' && <div className="bg-red-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl animate-in slide-in-from-top-4">Rede Nacional SSM: Activa em 4 Províncias</div>}
          </div>
          <div className="absolute bottom-6 left-6 z-[20] flex flex-col gap-2">
            <button onClick={viewMode === 'local' ? setMapToNational : setMapToLocal} className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200 text-slate-700 hover:text-blue-600 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
              {viewMode === 'local' ? <Globe className="w-5 h-5" /> : <MapIcon className="w-5 h-5" />}
              <span className="text-[10px] font-black uppercase pr-1">{viewMode === 'local' ? 'Nacional' : 'Local'}</span>
            </button>
            <button onClick={() => { if (mapRef.current) { const center = viewMode === 'local' ? { lat: -25.9692, lng: 32.5732 } : { lat: -18.6657, lng: 35.5296 }; const zoom = viewMode === 'local' ? 13 : 6; mapRef.current.panTo(center); mapRef.current.setZoom(zoom); } }} className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200 text-slate-700 hover:text-emerald-600 transition-all hover:scale-105 active:scale-95"><Crosshair className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default NetworkMap;
