
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
import AmbulanceProvidersAdmin from './components/AmbulanceProvidersAdmin';
import ProviderFleetDashboard from './components/ProviderFleetDashboard';
import Login from './components/Login';
import {
  EmergencyCase, EmergencyPriority, AdminUser, AmbulanceState, Driver, Employee, Company, Resource, CommunicationLog, OperationReport
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
  const [currentDriver, setCurrentDriver] = useState<Driver | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [ambulances, setAmbulances] = useState<AmbulanceState[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [incidents, setIncidents] = useState<EmergencyCase[]>([]);
  const [triageInitialData, setTriageInitialData] = useState<{ companyName?: string } | null>(null);
  const [activeCommIncidentId, setActiveCommIncidentId] = useState<string | null>(null);
  const [activeCommIncident, setActiveCommIncident] = useState<EmergencyCase | null>(null);
  const [activeIncidentIdForClient, setActiveIncidentIdForClient] = useState<string | null>(null);
  const [commIsMinimized, setCommIsMinimized] = useState(false);
  const [incomingCallIncident, setIncomingCallIncident] = useState<EmergencyCase | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const prevIncidentsRef = useRef<EmergencyCase[]>(incidents);

  // Global WebRTC for Operator/Central
  const webrtcService = useRef<any>(null);
  const [webrtcState, setWebrtcState] = useState<any>({ isConnected: false, incomingCall: null, activeCall: null });

  useEffect(() => {
    if (currentUser?.role === 'ADMIN_SSM' || currentUser?.role === 'OPERADOR_COORD' || currentUser?.role === 'GESTOR_FROTA_AMB') {
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
    if (webrtcState.incomingCall && !activeCommIncidentId && !incomingCallIncident) {
      // Se receber uma chamada, tentamos associar a um SOS recente
      let recentSOS = incidents.find(i => i.status === 'active' && i.priority === EmergencyPriority.CRITICAL);
      
      if (!recentSOS) {
        const peerId = webrtcState.incomingCall.peer;
        const extractedCompanyId = peerId?.startsWith('ssm-client-') ? peerId.replace('ssm-client-', '') : '';

        recentSOS = {
          id: `CALL-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: 'Chamada de Triagem WebRTC',
          locationName: 'Localização Desconhecida',
          status: 'active',
          priority: EmergencyPriority.CRITICAL,
          coords: [0,0],
          companyId: extractedCompanyId
        };
      }
      setIncomingCallIncident(recentSOS);
    }
  }, [webrtcState.incomingCall, activeCommIncidentId, incidents, incomingCallIncident]);

  useEffect(() => {
    const fetchDriverData = async () => {
      if (currentUser?.role === 'MOTORISTA_AMB') {
        try {
          const drv = await dbService.getDriverByAuthId(currentUser.id);
          setCurrentDriver(drv);
        } catch (err) {
          console.error("Erro ao carregar dados do motorista:", err);
        }
      } else {
        setCurrentDriver(null);
      }
    };
    fetchDriverData();
  }, [currentUser]);

  // Global SOS detection to trigger "Incoming Call" alert across all tabs
  useEffect(() => {
    const newIncidents = incidents.filter(
      inc => !prevIncidentsRef.current.some(prev => prev.id === inc.id)
    );

    const sosIncident = newIncidents.find(
      inc => inc.status === 'active' && inc.priority === EmergencyPriority.CRITICAL && inc.id.startsWith('SOS-')
    );

    if (sosIncident) {
      setIncomingCallIncident(sosIncident);
    }

    prevIncidentsRef.current = incidents;
  }, [incidents]);

  // Fetch Initial Data
  const fetchData = useCallback(async () => {
    try {
      console.log("Sincronizando dados com o servidor...");
      const [comps, emps, ambs, ress, incs, drvs] = await Promise.all([
        dbService.getCompanies(),
        dbService.getEmployees(),
        dbService.getAmbulances(),
        dbService.getResources(),
        dbService.getIncidents(),
        dbService.getDrivers()
      ]);

      setCompanies(comps);
      setEmployees(emps);
      setAmbulances(ambs);
      setDrivers(drvs);
      setResources(ress);
      setIncidents(incs);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    }
  }, []);

  useEffect(() => {
    // Only fetch if session exists, or on mount
    fetchData();
  }, [fetchData, currentUser?.id]);

  useEffect(() => {
    // Audit log application start
    auditLogger.log({ id: 'SYSTEM', name: 'System', role: 'ADMIN_SSM' }, 'SYSTEM_START', 'INFO', 'Aplicação SSM Digital Command Center iniciada.');

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
          const ambState = newInc.ambulance_state ? (typeof newInc.ambulance_state === 'string' ? JSON.parse(newInc.ambulance_state) : newInc.ambulance_state) : undefined;
          
          setIncidents(prev => [{
            ...newInc,
            companyId: newInc.company_id,
            locationName: newInc.location_name,
            patientName: newInc.patient_name,
            ambulanceState: ambState,
            coords: newInc.coords as [number, number]
          }, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const updatedInc = payload.new as any;
          const ambState = updatedInc.ambulance_state ? (typeof updatedInc.ambulance_state === 'string' ? JSON.parse(updatedInc.ambulance_state) : updatedInc.ambulance_state) : undefined;

          setIncidents(prev => prev.map(inc =>
            inc.id === updatedInc.id ? {
              ...updatedInc,
              companyId: updatedInc.company_id,
              locationName: updatedInc.location_name,
              patientName: updatedInc.patient_name,
              ambulanceState: ambState,
              coords: updatedInc.coords as [number, number]
            } : inc
          ));
        } else if (payload.eventType === 'DELETE') {
          setIncidents(prev => prev.filter(inc => inc.id !== payload.old.id));
        }
      })
      .subscribe();

    // Set up real-time drivers listener
    const driversSubscription = supabase
      .channel('drivers_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newDrv = payload.new as any;
          setDrivers(prev => [...prev, {
            id: newDrv.id,
            companyId: newDrv.company_id,
            name: newDrv.name,
            licenseNumber: newDrv.license_number,
            phone: newDrv.phone,
            status: newDrv.status,
            authUserId: newDrv.auth_user_id,
            imei: newDrv.imei,
            imsi: newDrv.imsi,
            createdAt: newDrv.created_at
          }]);
        } else if (payload.eventType === 'UPDATE') {
          const updatedDrv = payload.new as any;
          setDrivers(prev => prev.map(d =>
            d.id === updatedDrv.id ? {
                ...d,
                companyId: updatedDrv.company_id,
                name: updatedDrv.name,
                licenseNumber: updatedDrv.license_number,
                phone: updatedDrv.phone,
                status: updatedDrv.status,
                authUserId: updatedDrv.auth_user_id,
                imei: updatedDrv.imei,
                imsi: updatedDrv.imsi
            } : d
          ));
        } else if (payload.eventType === 'DELETE') {
          setDrivers(prev => prev.filter(d => d.id !== payload.old.id));
        }
      })
      .subscribe();

    // Set up real-time ambulances listener
    const ambulancesSubscription = supabase
      .channel('ambulances_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulances' }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newAmb = payload.new as any;
          setAmbulances(prev => [...prev, {
            ...newAmb,
            companyId: newAmb.company_id,
            currentPos: newAmb.current_pos as [number, number],
            imei: newAmb.imei,
            capacity: newAmb.capacity
          }]);
        } else if (payload.eventType === 'UPDATE') {
          const updatedAmb = payload.new as any;
          setAmbulances(prev => prev.map(amb =>
            amb.id === updatedAmb.id ? {
              ...updatedAmb,
              companyId: updatedAmb.company_id,
              currentPos: updatedAmb.current_pos as [number, number],
              imei: updatedAmb.imei,
              capacity: updatedAmb.capacity
            } : amb
          ));
        } else if (payload.eventType === 'DELETE') {
          setAmbulances(prev => prev.filter(amb => amb.id !== payload.old.id));
        }
      })
      .subscribe();

    // Listen for auth changes
    let subscription: { unsubscribe: () => void } | null = null;

    try {
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log(`Auth event: ${event}`, session?.user?.id);
        
        if (session?.user) {
          // 1. IMEDIATO: Usar metadados para feedback instantâneo e desbloquear a UI
          const basicUser: AdminUser = {
            id: session.user.id,
            name: session.user.user_metadata?.full_name || 'Utilizador',
            role: session.user.user_metadata?.role || 'USER',
            companyId: session.user.user_metadata?.company_id,
            email: session.user.email || '',
            avatar: session.user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(session.user.user_metadata?.full_name || 'U')}&background=0f172a&color=fff`
          };
          
          setCurrentUser(basicUser);

          // 2. EM SEGUNDO PLANO: Enriquecer com dados do perfil se necessário
          try {
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profileError) {
              console.warn("Erro ao buscar perfil em segundo plano:", profileError);
            }

            if (profileData) {
              console.log("Enriquecendo utilizador com dados do perfil:", profileData);
              setCurrentUser(prev => ({
                ...prev,
                name: profileData.full_name || prev?.name,
                role: profileData.role || prev?.role,
                companyId: profileData.company_id || prev?.companyId,
                avatar: profileData.avatar_url || prev?.avatar,
                // Novos campos para persistência total
                username: profileData.username || prev?.username,
                phone: profileData.phone || prev?.phone,
                idDocument: profileData.id_document || prev?.idDocument,
                dob: profileData.dob || prev?.dob,
                gender: profileData.gender || prev?.gender,
                address: profileData.address || prev?.address,
                preferences: profileData.preferences || prev?.preferences
              }) as AdminUser);
            }
          } catch (e) {
            console.warn("Erro ao buscar perfil em segundo plano:", e);
          }
        } else {
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
      driversSubscription.unsubscribe();
      ambulancesSubscription.unsubscribe();
    };
  }, []);

  const handleLogin = (user: AdminUser) => {
    setCurrentUser(user);
    const corporateRoles = ['ADMIN_CLIENTE', 'RESPONSAVEL_EMERG_CLIENTE', 'COLABORADOR_RH'];

    if (user.role === 'GESTOR_FROTA_AMB') setActiveTab('my_fleet');
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
      console.log(`Iniciando atualização de perfil para ${currentUser.id}:`, updates);
      const updatedUser = { ...currentUser, ...updates };
      setCurrentUser(updatedUser);

      try {
        // 1. Persistir no Perfil (DB) - Usando UPSERT agora para garantir criação de linha
        await dbService.updateProfile(currentUser.id, updates);
        console.log("1/3: Perfil persistido no banco de dados.");
        
        // 2. Sincronizar com Metadados da Auth (para resiliência total no login)
        const metadataUpdates: any = {};
        if (updates.name) metadataUpdates.full_name = updates.name;
        if (updates.avatar) metadataUpdates.avatar_url = updates.avatar;
        if (updates.role) metadataUpdates.role = updates.role;
        if (updates.companyId) metadataUpdates.company_id = updates.companyId;

        if (Object.keys(metadataUpdates).length > 0) {
          const { error: authError } = await supabase.auth.updateUser({
            data: metadataUpdates
          });
          if (authError) console.warn("Aviso na atualização de metadados Auth:", authError);
          else console.log("2/3: Metadados da Auth sincronizados.");
        }
        
        // 3. Sincronização Adicional (Motoristas)
        if (currentUser.role === 'MOTORISTA_AMB') {
          console.log("Sincronizando record operacional de motorista...");
          await dbService.updateDriverByAuthId(currentUser.id, {
            name: updates.name,
            phone: updates.phone,
            avatar_url: updates.avatar
          });
          console.log("3/3: Ficha de motorista atualizada.");
        }
        
        console.log("Persistência concluída com sucesso.");
      } catch (err: any) {
        console.error("ERRO CRÍTICO NA PERSISTÊNCIA:", err);
      }
    }
  };

  const handleDispatch = async (incidentId: string, ambId: string) => {
    const selectedAmb = ambulances.find(a => a.id === ambId)!;
    
    // 1. Tenta encontrar o motorista associado a esta ambulância (Prioriza o vínculo direto na base)
    let assignedDriver = drivers.find(d => 
      (d.currentAmbulanceId && d.currentAmbulanceId === selectedAmb.id) ||
      (d.imei && d.imei === selectedAmb.imei)
    );

    // 2. NOVO FALLBACK: Se não houver match direto, tenta o primeiro motorista disponível da mesma empresa
    if (!assignedDriver) {
      assignedDriver = drivers.find(d => 
        d.companyId === selectedAmb.companyId && 
        d.status === 'available'
      );
    }

    const newState = { 
      ...selectedAmb, 
      driverId: assignedDriver?.authUserId,
      driverName: assignedDriver?.name,
      companyId: selectedAmb.companyId, // Ensure Provider Company ID is preserved for broadcast matches
      phase: 'pending_accept', 
      timestamps: { dispatched: new Date().toLocaleTimeString() } 
    };
    
    // Update Optimistic Local State
    setIncidents(prev => prev.map(inc => {
      if (inc.id === incidentId) {
        return {
          ...inc,
          ambulanceId: ambId,
          ambulanceState: newState as any
        };
      }
      return inc;
    }));
    
    if (currentUser) auditLogger.log(currentUser, 'DISPATCH_AMBULANCE', incidentId, `Viatura: ${ambId}`);

    // Persist to Supabase
    try {
       await dbService.dispatchAmbulance(incidentId, newState);
    } catch (err) {
       console.error("Erro ao gravar despacho na base de dados:", err);
    }
  };

  const updateAmbulanceState = async (id: string, updates: Partial<AmbulanceState> | null, finalReport?: OperationReport) => {
    let newAmbulanceState: any = null;
    
    setIncidents(prev => prev.map(inc => {
      if (inc.id === id) {
        if (!updates) {
           newAmbulanceState = null;
           return { ...inc, ambulanceState: undefined };
        }
        newAmbulanceState = { ...inc.ambulanceState!, ...updates };

        // Se for um motorista a atualizar, garanta que o ID dele fica gravado como quem "pegou" a ficha
        if (currentUser.role === 'MOTORISTA_AMB' && !newAmbulanceState.driverId) {
          newAmbulanceState.driverId = currentUser.id;
          newAmbulanceState.driverName = currentUser.name;
        }

        return {
          ...inc,
          ambulanceState: newAmbulanceState,
          report: finalReport ? finalReport : inc.report
        };
      }
      return inc;
    }));

     // Sincronizar com a base de dados para que outros vejam em tempo-real (incluindo o motorista no outro lado)
    try {
       if (newAmbulanceState) {
          await dbService.dispatchAmbulance(id, newAmbulanceState);
       }
    } catch(err) {
       console.error("Erro ao atualizar estado da ambulância na base de dados", err);
    }
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
    } catch (err) {
      console.error("Erro ao fazer log de auditoria:", err);
    } finally {
      // Garantimos que o estado local é limpo imediatamente para o utilizador
      setCurrentUser(null);
      // Opcional: Limpar dados residuais do localStorage se houver
      localStorage.removeItem('supabase.auth.token');
    }

    // Tentamos terminar sessão no Supabase de forma assíncrona, não bloqueando a UI localmente.
    supabase.auth.signOut().catch(err => {
      console.error("Erro ao terminar sessão no Supabase:", err);
    });
  };

  if (!currentUser) return <Login onLoginSuccess={handleLogin} />;

  // MODO MOTORISTA
  if (currentUser.role === 'MOTORISTA_AMB') {
    const currentDriver = drivers.find(d => d.authUserId === currentUser.id);
    
    // Procura o incidente onde esta ambulância ou este motorista foi despachado
    const myIncident = incidents.find(i => {
      const ambState = i.ambulanceState as any;
      if (!ambState || i.status === 'closed') return false;

      const userCompanyId = (currentUser.companyId || '').toLowerCase().trim();
      const driverAuthId = (currentUser.id || '').toLowerCase().trim();
      const driverName = (currentUser.name || '').toLowerCase().trim();

      const ambCompanyId = (ambState.companyId || '').toLowerCase().trim();
      const ambDriverId = (ambState.driverId || '').toLowerCase().trim();
      const ambDriverName = (ambState.driverName || '').toLowerCase().trim();
      const ambPhase = ambState.phase;

      // Log de diagnóstico para depuração (visível na consola do navegador)
      if (ambPhase === 'pending_accept' && ambCompanyId === userCompanyId) {
        console.log(`[DriverFilter] Incidente ${i.id} detetado para a empresa ${userCompanyId}.`);
      }

      // 1. Match direto pelo ID de Auth (MAIOR PRIORIDADE)
      if (ambDriverId && ambDriverId === driverAuthId) return true;

      // 2. Match por IMEI (DEVICE SYNC)
      if (ambState.imei && currentDriver?.imei && ambState.imei === currentDriver.imei) return true;

      // 3. Match por NOME (FALLBACK para identidades desvinculadas na base)
      if (ambDriverName && ambDriverName === driverName) return true;

      // 4. BROADCAST para a empresa (Garantir que todos os motoristas ativos vejam o despacho inicial)
      // Se estiver em 'pending_accept', permitimos que qualquer motorista da mesma empresa veja o pedido
      const isProviderMatch = ambCompanyId === userCompanyId;
      const isPending = ambPhase === 'pending_accept';
      
      if (isProviderMatch && isPending) {
        console.log(`[DriverFilter] ALERTA: Incidente ${i.id} BROADCAST aceite para ${currentUser.name}`);
        return true;
      }

      return false;
    });

    // Se não houver incidente, tentamos encontrar a ambulância padrão da empresa para inicializar o PeerJS
    const myAmbulance = ambulances.find(amb => amb.companyId === currentUser.companyId);

    return (
      <AmbulanceMode
        user={currentUser}
        onLogout={handleLogout}
        incident={myIncident || null}
        onUpdateAmbulance={updateAmbulanceState}
        onUpdateStatus={updateIncidentStatus}
        imei={currentDriver?.imei || myAmbulance?.imei}
        companies={companies}
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
            {activeTab === 'providers' && (
              <ProviderFleetDashboard
                currentUser={currentUser}
                ambulances={filteredAmbulances}
                drivers={drivers}
                onUpdateDrivers={setDrivers}
                onLogout={handleLogout}
              />
            )}
            {activeTab === 'corporate_sos' && (
              <CorporateClientMode
                adminName={currentUser.name}
                onLogout={handleLogout}
                incidents={incidents}
                onOpenChat={(id) => {
                  setActiveCommIncidentId(id);
                  setCommIsMinimized(false);
                }}
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
                  
                  // Optimistic UI update so the client sees it immediately
                  setIncidents(prev => [newInc, ...prev]);
                  setActiveIncidentIdForClient(incidentId);

                  try {
                    await dbService.saveIncident(newInc);
                  } catch (err) {
                    console.error("Erro CRÍTICO ao gravar SOS na base de dados (RLS ou formato de id inválido):", err);
                    alert("Atenção: A chamada SOS local ativou, mas não foi possível enviar aos servidores de coordenação. Por favor, ligue para a linha telefónica de emergência.");
                  }
                }}
                companyId={currentUser.companyId}
                currentUser={currentUser}
                employees={filteredEmployees}
                companies={companies}
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
                resources={resources}
              />
            )}
            {activeTab === 'fleet' && (
              <FleetManagement
                ambulances={filteredAmbulances}
                drivers={drivers}
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
                onNavigate={setActiveTab}
              />
            )}
            {activeTab === 'providers' && <AnalyticsDashboard currentUser={currentUser} companies={filteredCompanies} />}
            {activeTab === 'ambulance_providers' && (
            <AmbulanceProvidersAdmin
              companies={companies}
              ambulances={ambulances}
              drivers={drivers}
              onUpdateDrivers={(updated) => setDrivers(updated)}
            />
          )}
            {activeTab === 'my_fleet' && (
              <ProviderFleetDashboard 
                currentUser={currentUser} 
                ambulances={filteredAmbulances} 
                drivers={drivers}
                onUpdateDrivers={setDrivers}
                onLogout={handleLogout}
              />
            )}
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
                  <span className="text-slate-900 font-black">{companies.find(c => c.id === incomingCallIncident.companyId)?.name || 'Cliente Corporativo'}</span> está a solicitar apoio imediato.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    const inc = incomingCallIncident;
                    if (inc) {
                      if (inc.id.startsWith('CALL-')) {
                        setIncidents(prev => [inc, ...prev]);
                      }
                      setActiveCommIncident(inc);
                      setActiveCommIncidentId(inc.id);
                    }
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
        {activeCommIncident && (
          <div className={`fixed inset-0 z-[150] transition-all duration-500 flex ${commIsMinimized ? 'pointer-events-none items-end justify-end p-8' : 'bg-slate-900/60 backdrop-blur-sm items-center justify-center p-4'}`}>
            <div className={`bg-white shadow-2xl overflow-hidden border border-slate-200 relative transition-all duration-500 pointer-events-auto ${commIsMinimized ? 'w-full max-w-md h-24 rounded-3xl mb-4 mr-4' : 'w-full max-w-5xl h-[85vh] rounded-[3rem]'}`}>
              <EmergencyCommunication
                incidentId={activeCommIncident.id}
                company={companies.find(c => c.id === activeCommIncident.companyId)}
                currentUser={currentUser}
                incident={activeCommIncident}
                onStartTriage={handleStartTriage}
                isMinimized={commIsMinimized}
                onToggleMinimize={() => setCommIsMinimized(!commIsMinimized)}
                onClose={() => {
                  setActiveCommIncidentId(null);
                  setActiveCommIncident(null);
                }}
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
