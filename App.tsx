
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ShieldCheck, User } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import DashboardOverview from './components/DashboardOverview';
import ProtocolAssistant from './components/ProtocolAssistant';
import ResourceManagement from './components/ResourceManagement';
import FleetManagement from './components/FleetManagement';
import PatientManagement from './components/PatientManagement';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import AmbulanceMode from './components/AmbulanceMode';
import CorporateClientMode from './components/CorporateClientMode';
import CorporateClientsAdmin from './components/CorporateClientsAdmin';
import EmployeeRegistration from './components/EmployeeRegistration';
import UserProfileSettings from './components/UserProfileSettings';
import AccountManagement from './components/AccountManagement';
import Login from './components/Login';
import {
  EmergencyCase, EmergencyPriority, AdminUser, AmbulanceState, Employee, Company, Resource, CommunicationLog, OperationReport
} from './types';
import {
  Siren, PhoneCall, CheckCircle, X
} from 'lucide-react';
import EmergencyCommunication from './components/EmergencyCommunication';
import { COMPANIES as INITIAL_COMPANIES, ADMINS, AMBULANCES as INITIAL_AMBULANCES, EMPLOYEES as INITIAL_EMPLOYEES, RESOURCES as INITIAL_RESOURCES } from './constants';
import { auditLogger } from './services/auditLogger';
import { supabase } from './services/supabase';
import { dbService } from './services/dbService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ambulances, setAmbulances] = useState<AmbulanceState[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [incidents, setIncidents] = useState<EmergencyCase[]>([]);
  const [triageInitialData, setTriageInitialData] = useState<{ companyName?: string } | null>(null);
  const [activeCommIncidentId, setActiveCommIncidentId] = useState<string | null>(null);
  const [activeIncidentIdForClient, setActiveIncidentIdForClient] = useState<string | null>(null);
  const [commIsMinimized, setCommIsMinimized] = useState(false);
  const [incomingCallIncident, setIncomingCallIncident] = useState<EmergencyCase | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const prevIncidentsRef = useRef<EmergencyCase[]>(incidents);

  // Global WebRTC for Operator/Central
  const webrtcService = useRef<any>(null);
  const [webrtcState, setWebrtcState] = useState<any>({ isConnected: false, incomingCall: null, activeCall: null });

  useEffect(() => {
    if (currentUser?.role === 'ADMIN_SSM' || currentUser?.role === 'GESTOR_FROTA_AMB') {
      import('./services/webRTCService').then(({ WebRTCService }) => {
        if (!webrtcService.current) {
          webrtcService.current = new WebRTCService((stateUpdate) => {
            setWebrtcState(prev => ({ ...prev, ...stateUpdate }));
          });
          webrtcService.current.initialize('ssm-central-MAIN');
        }
      });
    }
    return () => {
      webrtcService.current?.destroy();
      webrtcService.current = null;
    };
  }, [currentUser?.role]);

  useEffect(() => {
    if (webrtcState.incomingCall && !activeCommIncidentId) {
      // Se receber uma chamada e não houver incidente aberto, tentamos associar se houver um SOS recente
      const recentSOS = incidents.find(i => i.status === 'active' && i.priority === EmergencyPriority.CRITICAL);
      if (recentSOS) {
        setIncomingCallIncident(recentSOS);
      }
    }
  }, [webrtcState.incomingCall, activeCommIncidentId, incidents]);

  // Global SOS detection to trigger "Incoming Call" alert across all tabs
  useEffect(() => {
    const newIncidents = incidents.filter(
      inc => !prevIncidentsRef.current.some(prev => prev.id === inc.id)
    );

    const sosIncident = newIncidents.find(
      inc => inc.priority === EmergencyPriority.CRITICAL && inc.id.startsWith('SOS-')
    );

    if (sosIncident) {
      setIncomingCallIncident(sosIncident);
    }

    prevIncidentsRef.current = incidents;
  }, [incidents]);

  useEffect(() => {
    // Audit log application start
    auditLogger.log({ id: 'SYSTEM', name: 'System', role: 'ADMIN_SSM' }, 'SYSTEM_START', 'INFO', 'Aplicação SSM Digital Command Center iniciada.');

    // Fetch Initial Data
    const fetchData = async () => {
      try {
        const [comps, emps, ambs, ress, incs] = await Promise.all([
          dbService.getCompanies(),
          dbService.getEmployees(),
          dbService.getAmbulances(),
          dbService.getResources(),
          dbService.getIncidents()
        ]);

        // Merge database companies with constants to ensure UI always has data during transition
        const mergedCompanies = [...INITIAL_COMPANIES];
        comps.forEach(dbComp => {
          const index = mergedCompanies.findIndex(c => c.id === dbComp.id);
          if (index !== -1) mergedCompanies[index] = dbComp;
          else mergedCompanies.push(dbComp);
        });

        setCompanies(mergedCompanies);
        setEmployees(emps);
        setAmbulances(ambs);
        setResources(ress);
        setIncidents(incs);
      } catch (err) {
        console.error("Erro ao carregar dados iniciais:", err);
      }
    };

    fetchData();

    // Set up real-time GPS tracking listener
    const gpsSubscription = dbService.subscribeToGps((payload) => {
      const { imei, coords } = payload.new;
      setAmbulances(prev => prev.map(amb =>
        amb.imei === imei ? { ...amb, currentPos: coords as [number, number] } : amb
      ));
    });

    // Set up real-time incidents listener
    const incidentsSubscription = supabase
      .channel('incidents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newInc = payload.new as any;
          setIncidents(prev => [{ ...newInc, coords: newInc.coords as [number, number] }, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const updatedInc = payload.new as any;
          setIncidents(prev => prev.map(inc =>
            inc.id === updatedInc.id ? { ...updatedInc, coords: updatedInc.coords as [number, number] } : inc
          ));
        }
      })
      .subscribe();

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          if (session?.user) {
            // Fetch profile if user is logged in
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile && !profileError) {
              setCurrentUser({
                id: profile.id,
                name: profile.full_name,
                role: profile.role,
                companyId: profile.company_id,
                email: session.user.email || ''
              } as AdminUser);
            } else {
              // Fallback to metadata
              setCurrentUser({
                id: session.user.id,
                name: session.user.user_metadata?.full_name || 'Utilizador',
                role: session.user.user_metadata?.role || 'USER',
                companyId: session.user.user_metadata?.company_id,
                email: session.user.email || ''
              } as AdminUser);
            }
          } else {
            setCurrentUser(null);
          }
        } catch (innerError) {
          console.error("Error in auth state change handler:", innerError);
          setCurrentUser(null);
        }
      });
      subscription = data.subscription;
    } catch (outerError) {
      console.error("Error setting up auth state listener:", outerError);
    }

    return () => {
      if (subscription) subscription.unsubscribe();
      gpsSubscription.unsubscribe();
      incidentsSubscription.unsubscribe();
    };
  }, []);

  const handleLogin = (user: AdminUser) => {
    setCurrentUser(user);
    const corporateRoles = ['ADMIN_CLIENTE', 'RESPONSAVEL_EMERG_CLIENTE', 'COLABORADOR_RH'];

    if (user.role === 'GESTOR_FROTA_AMB') setActiveTab('fleet');
    else if (corporateRoles.includes(user.role)) setActiveTab('corporate_sos');
    else if (user.role === 'ADMIN_CLIENTE') setActiveTab('patients');
    else setActiveTab('dashboard');

    auditLogger.log(user, 'LOGIN_SUCCESS');
  };

  const handleAddEmployee = (newEmployee: Employee) => {
    setEmployees(prev => [newEmployee, ...prev]);
    // Navegar automaticamente para a Base Médica para ver o resultado
    setTimeout(() => setActiveTab('patients'), 1500);
  };

  const handleRegisterCompany = (newCompany: Company) => {
    setCompanies(prev => [newCompany, ...prev]);
  };

  const handleUpdateUser = async (updates: Partial<AdminUser>) => {
    if (currentUser) {
      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);

      try {
        await dbService.updateProfile(currentUser.id, updates);
        console.log("Perfil atualizado no Supabase com sucesso.");
      } catch (err) {
        console.error("Erro ao persistir atualização de perfil:", err);
      }
    }
  };

  const handleDispatch = (incidentId: string, ambId: string) => {
    const selectedAmb = ambulances.find(a => a.id === ambId)!;
    setIncidents(prev => prev.map(inc => {
      if (inc.id === incidentId) {
        return {
          ...inc,
          ambulanceId: ambId,
          ambulanceState: { ...selectedAmb, phase: 'pending_accept', timestamps: { dispatched: new Date().toLocaleTimeString() } }
        };
      }
      return inc;
    }));
    if (currentUser) auditLogger.log(currentUser, 'DISPATCH_AMBULANCE', incidentId, `Viatura: ${ambId}`);
  };

  const updateAmbulanceState = (id: string, updates: Partial<AmbulanceState> | null, finalReport?: OperationReport) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id) {
        if (!updates) return { ...inc, ambulanceState: undefined };
        return {
          ...inc,
          ambulanceState: { ...inc.ambulanceState!, ...updates },
          report: finalReport ? finalReport : inc.report
        };
      }
      return inc;
    }));
  };

  const updateIncidentStatus = (id: string, status: 'active' | 'triage' | 'transit' | 'closed') => {
    setIncidents(prev => prev.map(inc => inc.id === id ? { ...inc, status } : inc));
  };

  const handleStartTriage = (companyName: string) => {
    setTriageInitialData({ companyName });
    setActiveTab('protocols');
    setCommIsMinimized(true);
  };

  // Filtragem de dados para isolamento multi-empresa
  const filteredIncidents = useMemo(() => {
    if (!currentUser) return [];
    const isCorporate = ['COLABORADOR_RH', 'ADMIN_CLIENTE', 'RESPONSAVEL_EMERG_CLIENTE'].includes(currentUser.role);
    const isAmbulance = ['GESTOR_FROTA_AMB', 'MOTORISTA_AMB'].includes(currentUser.role);

    if (isCorporate && currentUser.companyId) {
      return incidents.filter(inc => inc.companyId === currentUser.companyId);
    }

    if (isAmbulance && currentUser.companyId) {
      // Empresas de ambulância só vêem incidentes atribuídos à sua frota
      return incidents.filter(inc => inc.ambulanceState?.companyId === currentUser.companyId);
    }

    return incidents;
  }, [incidents, currentUser]);

  const filteredAmbulances = useMemo(() => {
    if (!currentUser) return [];
    const isAmbulance = ['GESTOR_FROTA_AMB', 'MOTORISTA_AMB'].includes(currentUser.role);
    if (isAmbulance && currentUser.companyId) {
      return ambulances.filter(amb => amb.companyId === currentUser.companyId);
    }
    // Administradores e Operadores vêem todas
    return ambulances;
  }, [ambulances, currentUser]);

  const filteredCompanies = useMemo(() => {
    if (!currentUser) return [];
    const isCorporate = ['COLABORADOR_RH', 'ADMIN_CLIENTE', 'RESPONSAVEL_EMERG_CLIENTE'].includes(currentUser.role);
    const isAmbulance = ['GESTOR_FROTA_AMB', 'MOTORISTA_AMB'].includes(currentUser.role);

    if (isCorporate && currentUser.companyId) {
      // Clientes só vêem a si mesmos
      return companies.filter(c => c.id === currentUser.companyId);
    }

    if (isAmbulance && currentUser.companyId) {
      // Empresas de ambulância só vêem a si mesmas (não sabem que outras existem)
      return companies.filter(c => c.id === currentUser.companyId);
    }

    return companies;
  }, [companies, currentUser]);

  const filteredResources = useMemo(() => {
    if (!currentUser) return [];
    const isAmbulance = ['GESTOR_FROTA_AMB', 'MOTORISTA_AMB'].includes(currentUser.role);
    if (isAmbulance && currentUser.companyId) {
      // Empresas de ambulância só vêem os seus recursos ou recursos públicos (hospitais)
      return resources.filter(res => !res.companyId || res.companyId === currentUser.companyId);
    }
    return resources;
  }, [resources, currentUser]);

  const filteredEmployees = useMemo(() => {
    if (!currentUser) return [];
    const isCorporate = ['COLABORADOR_RH', 'ADMIN_CLIENTE', 'RESPONSAVEL_EMERG_CLIENTE'].includes(currentUser.role);
    if (isCorporate && currentUser.companyId) {
      return employees.filter(emp => emp.companyId === currentUser.companyId);
    }
    return employees;
  }, [employees, currentUser]);

  const handleLogout = async () => {
    try {
      if (currentUser) {
        auditLogger.log(currentUser, 'LOGOUT_MANUAL', undefined, 'Utilizador terminou sessão manualmente.');
      }
      // Tentamos terminar sessão no Supabase, mas ignoramos erros se falhar 
      // para garantir que o utilizador consiga "sair" da UI localmente.
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Erro ao terminar sessão no Supabase:", err);
    } finally {
      // Garantimos que o estado local é limpo independentemente de erros no Supabase
      setCurrentUser(null);
      // Opcional: Limpar dados residuais do localStorage se houver
      localStorage.removeItem('supabase.auth.token');
    }
  };

  if (!currentUser) return <Login onLoginSuccess={handleLogin} />;

  // MODO MOTORISTA
  if (currentUser.role === 'MOTORISTA_AMB') {
    // Procura uma ambulância da empresa do motorista
    const myAmbulance = ambulances.find(amb => amb.companyId === currentUser.companyId);
    const myIncident = incidents.find(i => i.ambulanceState?.id === myAmbulance?.id && i.status !== 'closed');

    return (
      <AmbulanceMode
        adminName={currentUser.name}
        onLogout={handleLogout}
        incident={myIncident || null}
        onUpdateAmbulance={updateAmbulanceState}
        onUpdateStatus={updateIncidentStatus}
        imei={myAmbulance?.imei}
      />
    );
  }

  // MODO CORPORATIVO
  const isCorporate = ['COLABORADOR_RH', 'ADMIN_CLIENTE', 'RESPONSAVEL_EMERG_CLIENTE'].includes(currentUser.role);

  if (isCorporate) {
    return (
      <div className="flex min-h-screen bg-[#F8F9FB] text-slate-900 font-sans relative overflow-x-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsSidebarOpen(false); // Close sidebar on mobile after selection
          }}
          userRole={currentUser.role}
          onLogout={handleLogout}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col h-screen overflow-hidden w-full">
          <TopBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            onLogout={handleLogout}
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <div className="flex-1 overflow-hidden h-full">
            {activeTab === 'corporate_sos' && (
              <CorporateClientMode
                adminName={currentUser.name}
                onLogout={handleLogout}
                onTriggerEmergency={async () => {
                  const incidentId = `SOS-${Math.floor(Math.random() * 9000) + 1000}`;
                  const newInc: EmergencyCase = {
                    id: incidentId,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: 'Pânico Corporativo Ativado',
                    locationName: 'Sede da Empresa (GPS)',
                    status: 'active',
                    priority: EmergencyPriority.CRITICAL,
                    coords: [-25.9680, 32.5710],
                    companyId: currentUser.companyId
                  };
                  try {
                    await dbService.saveIncident(newInc);
                    setActiveIncidentIdForClient(incidentId);
                  } catch (err) {
                    console.error("Erro ao disparar SOS:", err);
                    setIncidents(prev => [newInc, ...prev]);
                    setActiveIncidentIdForClient(incidentId);
                  }
                }}
                onOpenChat={(id) => {
                  setActiveCommIncidentId(id);
                  setCommIsMinimized(false);
                }}
                companyId={currentUser.companyId}
                currentUser={currentUser}
                employees={filteredEmployees}
              />
            )}
            {activeTab === 'employee_registration' && (
              <div className="p-4 md:p-8 custom-scrollbar overflow-y-auto h-full">
                <EmployeeRegistration companyId={currentUser.companyId} onAddEmployee={handleAddEmployee} />
              </div>
            )}
            {activeTab === 'patients' && (
              <div className="p-4 md:p-8 custom-scrollbar overflow-y-auto h-full">
                <PatientManagement employees={filteredEmployees} currentUser={currentUser} />
              </div>
            )}
            {activeTab === 'profile' && (
              <div className="p-4 md:p-8 custom-scrollbar overflow-y-auto h-full">
                <UserProfileSettings
                  user={currentUser}
                  initialTab="perfil"
                  onClose={() => setActiveTab('corporate_sos')}
                  onUpdateUser={handleUpdateUser}
                />
              </div>
            )}
            {activeTab === 'settings' && (
              <div className="p-4 md:p-8 custom-scrollbar overflow-y-auto h-full">
                <UserProfileSettings
                  user={currentUser}
                  initialTab="definicoes"
                  onClose={() => setActiveTab('corporate_sos')}
                  onUpdateUser={handleUpdateUser}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  try {
    return (
      <div className="flex min-h-screen bg-[#F8F9FB] text-slate-900 font-sans relative overflow-x-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsSidebarOpen(false); // Close sidebar on mobile after selection
          }}
          userRole={currentUser.role}
          onLogout={handleLogout}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col h-screen overflow-hidden w-full">
          <TopBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            onLogout={handleLogout}
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            {activeTab === 'dashboard' && (
              <DashboardOverview
                incidents={filteredIncidents}
                onDispatch={handleDispatch}
                currentUser={currentUser}
                onUpdateIncident={updateIncidentStatus}
                ambulances={ambulances}
                companies={companies}
                onStartTriage={handleStartTriage}
                onOpenComm={setActiveCommIncidentId}
              />
            )}
            {activeTab === 'fleet' && (
              <FleetManagement
                ambulances={filteredAmbulances}
                onAddAmbulance={(newAmb) => setAmbulances(prev => [newAmb, ...prev])}
              />
            )}
            {activeTab === 'patients' && <PatientManagement employees={filteredEmployees} currentUser={currentUser} />}
            {activeTab === 'map' && (
              <ResourceManagement
                incidents={filteredIncidents}
                resources={filteredResources}
                companies={filteredCompanies}
                employees={filteredEmployees}
              />
            )}
            {activeTab === 'protocols' && (
              <ProtocolAssistant
                currentUser={currentUser}
                onAddIncident={(inc) => setIncidents([inc, ...incidents])}
                initialData={triageInitialData}
              />
            )}
            {activeTab === 'providers' && <AnalyticsDashboard currentUser={currentUser} companies={filteredCompanies} />}
            {activeTab === 'companies' && <CorporateClientsAdmin companies={filteredCompanies} employees={employees} onAddCompany={handleRegisterCompany} />}

            {activeTab === 'profile' && (
              <UserProfileSettings
                user={currentUser}
                initialTab="perfil"
                onClose={() => setActiveTab('dashboard')}
                onUpdateUser={handleUpdateUser}
                companies={companies}
              />
            )}
            {activeTab === 'settings' && (
              <UserProfileSettings
                user={currentUser}
                initialTab="definicoes"
                onClose={() => setActiveTab('dashboard')}
                onUpdateUser={handleUpdateUser}
              />
            )}
            {activeTab === 'accounts' && currentUser.role === 'ADMIN_SSM' && (
              <AccountManagement
                onClose={() => setActiveTab('dashboard')}
                companies={companies}
              />
            )}
          </div>
        </main>

        {/* Global SOS Incoming Call Alert */}
        {incomingCallIncident && (
          <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="w-full max-w-md bg-white rounded-[3.5rem] p-12 shadow-2xl text-center relative overflow-hidden border border-white/20">
              <div className="absolute top-0 left-0 right-0 h-2 bg-red-600 animate-pulse"></div>

              <div className="relative mb-10">
                <div className="absolute inset-0 bg-red-600/20 rounded-full animate-ping scale-150"></div>
                <div className="w-32 h-32 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto relative z-10 border-4 border-white shadow-xl">
                  <PhoneCall className="w-14 h-14 animate-bounce" />
                </div>
              </div>

              <div className="space-y-4 mb-10">
                <h3 className="text-3xl font-black text-slate-900 uppercase font-corporate tracking-tight">Chamada de Emergência</h3>
                <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">
                  <Siren className="w-3.5 h-3.5 animate-pulse" />
                  Linha Prioritária SSM
                </div>
                <p className="text-base font-bold text-slate-500 mt-4 leading-relaxed text-center">
                  <span className="text-slate-900 font-black">{filteredCompanies.find(c => c.id === incomingCallIncident.companyId)?.name || 'Cliente Corporativo'}</span> está a solicitar apoio imediato.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setActiveCommIncidentId(incomingCallIncident.id);
                    setIncomingCallIncident(null);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <CheckCircle className="w-5 h-5" /> Atender Chamada
                </button>
                <button
                  onClick={() => setIncomingCallIncident(null)}
                  className="w-full bg-white border border-slate-200 text-slate-400 py-6 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" /> Recusar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Emergency Communication Modal / Floating Window */}
        {activeCommIncidentId && (
          <div className={`fixed inset-0 z-[150] transition-all duration-500 flex ${commIsMinimized ? 'pointer-events-none items-end justify-end p-8' : 'bg-slate-900/60 backdrop-blur-sm items-center justify-center p-4'}`}>
            <div className={`bg-white shadow-2xl overflow-hidden border border-slate-200 relative transition-all duration-500 pointer-events-auto ${commIsMinimized ? 'w-full max-w-md h-24 rounded-3xl mb-4 mr-4' : 'w-full max-w-5xl h-[85vh] rounded-[3rem]'}`}>
              <EmergencyCommunication
                incidentId={activeCommIncidentId}
                company={filteredCompanies.find(c => c.id === filteredIncidents.find(i => i.id === activeCommIncidentId)?.companyId)}
                currentUser={currentUser}
                onStartTriage={handleStartTriage}
                isMinimized={commIsMinimized}
                onToggleMinimize={() => setCommIsMinimized(!commIsMinimized)}
                onClose={() => setActiveCommIncidentId(null)}
              />
            </div>
          </div>
        )}
      </div>
    );
  } catch (renderError) {
    return (
      <div style={{ padding: '40px', background: '#fff' }}>
        <h1 style={{ color: 'red' }}>Erro Crítico de Interface</h1>
        <p>A aplicação encontrou um erro ao montar os componentes.</p>
        <pre style={{ background: '#f5f5f5', padding: '20px', borderRadius: '10px' }}>
          {renderError instanceof Error ? renderError.message : String(renderError)}
        </pre>
      </div>
    );
  }
};

export default App;
