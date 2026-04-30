
import React, { useState, useEffect, useMemo } from 'react';
import { 
    Truck, Users, Plus, X, Save, Smartphone, Gauge, 
    ShieldAlert, Search, Edit2, Trash2, Phone, BadgeCheck,
    Navigation, Activity, LayoutDashboard, Settings,
    Shield, CheckCircle2
} from 'lucide-react';
import { dbService } from '../services/dbService';
import { AmbulanceState, Driver, AdminUser, EmergencyCase, Company } from '../types';
import { supabase } from '../services/supabase';
import AmbulanceTracker from './AmbulanceTracker';
import { MessageSquare, Clock, MapPin } from 'lucide-react';

interface ProviderFleetDashboardProps {
    currentUser: AdminUser;
    ambulances: AmbulanceState[];
    drivers: Driver[];
    incidents: EmergencyCase[];
    companies: Company[];
    onUpdateDrivers: (drivers: Driver[]) => void;
    onLogout: () => void;
    onOpenComm: (incidentId: string) => void;
}

const ProviderFleetDashboard: React.FC<ProviderFleetDashboardProps> = ({ 
    currentUser, 
    ambulances, 
    drivers, 
    incidents = [],
    companies = [],
    onUpdateDrivers,
    onLogout,
    onOpenComm
}) => {
    const [activeTab, setActiveTab] = useState<'fleet' | 'drivers' | 'operations'>('fleet');
    const [trackingIncident, setTrackingIncident] = useState<EmergencyCase | null>(null);
    const [showAddAmbulance, setShowAddAmbulance] = useState(false);
    const [showAddDriver, setShowAddDriver] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [editingAmbulance, setEditingAmbulance] = useState<AmbulanceState | null>(null);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    // Form States
    const [newAmbulance, setNewAmbulance] = useState({
        id: '',
        plate: '',
        type: 'Básica' as any,
        imei: '',
        capacity: 'Padrão'
    });

    const [newDriver, setNewDriver] = useState({
        name: '',
        licenseNumber: '',
        phone: '',
        email: '',
        password: '',
        imei: '',
        status: 'available' as any,
        currentAmbulanceId: ''
    });

    const companyDrivers = useMemo(() => {
        return (drivers || []).filter(d => d.companyId === currentUser.companyId);
    }, [drivers, currentUser.companyId]);

    useEffect(() => {
        if (!currentUser.companyId) return;
        setIsLoading(false);
    }, [currentUser.companyId]);

    const handleAddAmbulance = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const ambulance: AmbulanceState = {
                id: newAmbulance.id,
                plate: newAmbulance.plate,
                type: newAmbulance.type,
                currentPos: [-25.9692, 32.5732],
                phase: 'idle',
                status: 'available',
                companyId: currentUser.companyId,
                imei: newAmbulance.imei,
                capacity: newAmbulance.capacity,
                eta: 0,
                distance: 0,
                performance: {
                    totalIncidents: 0,
                    acceptanceRate: 100,
                    avgResponseTime: 0
                }
            };

            await dbService.saveAmbulance(ambulance);
            setFeedback({ type: 'success', msg: "Viatura registada com sucesso!" });
            setShowAddAmbulance(false);
            setNewAmbulance({
                id: '',
                plate: '',
                type: 'Básica' as any,
                imei: '',
                capacity: 'Padrão'
            });
            setTimeout(() => setFeedback(null), 4000);
        } catch (error: any) {
            console.error("Erro ao salvar viatura:", error);
            setFeedback({ type: 'error', msg: `Erro ao salvar viatura: ${error.message}` });
            setTimeout(() => setFeedback(null), 4000);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Basic validation before starting
        if (!newDriver.email || !newDriver.password || !newDriver.name || !newDriver.currentAmbulanceId) {
            setFeedback({ 
                type: 'error', 
                msg: !newDriver.currentAmbulanceId ? "Deve selecionar uma viatura antes de registar o motorista." : "Por favor, preencha todos os campos obrigatórios." 
            });
            return;
        }

        setIsSubmitting(true);
        setFeedback({ type: 'success', msg: "A iniciar registo..." });

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("O servidor do Supabase está a demorar demasiado a responder. Por favor, verifique se a ligação à internet está estável ou se a conta foi criada no SQL Editor.")), 60000)
        );

        try {
            console.log("Iniciando processo de registo full-flow...");
            await Promise.race([
                dbService.registerDriverFullFlow(
                    newDriver, 
                    currentUser.companyId, 
                    (msg) => {
                        console.log(`[Registo]: ${msg}`);
                        setFeedback({ type: 'success', msg });
                    }
                ),
                timeoutPromise
            ]);

            setFeedback({ type: 'success', msg: "Motorista registado com sucesso!" });
            setShowAddDriver(false);
            setNewDriver({ 
                name: '', 
                licenseNumber: '', 
                phone: '', 
                email: '', 
                password: '', 
                imei: '', 
                status: 'available',
                currentAmbulanceId: ''
            });
            
            // Refresh list com delay para garantir consistência visual
            setTimeout(async () => {
                const updatedDrivers = await dbService.getDrivers(currentUser.companyId);
                onUpdateDrivers(updatedDrivers);
            }, 1000);
            
            setTimeout(() => setFeedback(null), 4000);
        } catch (error: any) {
            console.error("ERRO CRÍTICO NO REGISTO:", error);
            setFeedback({ 
                type: 'error', 
                msg: error.message || "Erro desconhecido durante o registo." 
            });
            setTimeout(() => setFeedback(null), 10000);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAmbulance = async (id: string) => {
        if (!confirm("Tem a certeza que deseja remover esta viatura?")) return;
        try {
            const { error } = await supabase.from('ambulances').delete().eq('id', id);
            if (error) throw error;
            // O realtime e listener no App.tsx cuidará da remoção na UI
            setFeedback({ type: 'success', msg: "Viatura removida com sucesso!" });
            setTimeout(() => setFeedback(null), 4000);
        } catch (error) {
            console.error("Erro ao eliminar viatura:", error);
            setFeedback({ type: 'error', msg: "Erro ao eliminar viatura." });
            setTimeout(() => setFeedback(null), 4000);
        }
    };

    const handleDeleteDriver = async (id: string) => {
        if (!confirm("Tem a certeza que deseja remover este motorista? Esta ação apagará definitivamente o login deste utilizador.")) return;
        try {
            await dbService.deleteDriver(id);
            const updatedDrivers = await dbService.getDrivers();
            onUpdateDrivers(updatedDrivers);
            setFeedback({ type: 'success', msg: "Motorista eliminado com sucesso!" });
            setTimeout(() => setFeedback(null), 4000);
        } catch (error) {
            console.error("Delete Error:", error);
            setFeedback({ type: 'error', msg: "Erro ao remover motorista." });
            setTimeout(() => setFeedback(null), 4000);
        }
    };

    const handleUpdateAmbulance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAmbulance) return;
        setIsSubmitting(true);
        try {
            await dbService.saveAmbulance(editingAmbulance);
            setFeedback({ type: 'success', msg: "Viatura atualizada com sucesso!" });
            setTimeout(() => setFeedback(null), 4000);
            setEditingAmbulance(null);
            // Realtime fará o resto
        } catch (error) {
            console.error("Erro ao atualizar viatura:", error);
            setFeedback({ type: 'error', msg: "Erro ao atualizar viatura." });
            setTimeout(() => setFeedback(null), 4000);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDriver) return;
        setIsSubmitting(true);
        try {
            await dbService.saveDriver(editingDriver);
            setFeedback({ type: 'success', msg: "Motorista atualizado com sucesso!" });
            setTimeout(() => setFeedback(null), 4000);
            setEditingDriver(null);
            
            const updatedDrivers = await dbService.getDrivers(currentUser.companyId);
            onUpdateDrivers(updatedDrivers);
        } catch (error) {
            console.error("Erro ao atualizar motorista:", error);
            setFeedback({ type: 'error', msg: "Erro ao atualizar motorista." });
            setTimeout(() => setFeedback(null), 4000);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Unidades Ativas</p>
                    <div className="flex items-end gap-3">
                        <h4 className="text-4xl font-black text-slate-900 tracking-tight">{ambulances.length}</h4>
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl mb-1 border border-emerald-100 uppercase">Online</span>
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Motoristas</p>
                    <h4 className="text-4xl font-black text-slate-900 tracking-tight">{drivers.length}</h4>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Disponibilidade</p>
                    <div className="flex items-end gap-3">
                        <h4 className="text-4xl font-black text-slate-900 tracking-tight">85%</h4>
                        <Activity className="w-6 h-6 text-blue-500 mb-2" />
                    </div>
                </div>
                <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl text-white">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Status da Frota</p>
                    <div className="flex items-center gap-3 text-emerald-400">
                        <BadgeCheck className="w-5 h-5" />
                        <span className="text-sm font-black uppercase tracking-widest">Excelência</span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-200 pb-2">
                <div className="flex gap-4">
                    <button 
                        onClick={() => setActiveTab('fleet')}
                        className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'fleet' ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-slate-400 hover:text-slate-900 bg-white border border-slate-100 uppercase'}`}
                    >
                        Frota de Viaturas
                    </button>
                    <button 
                        onClick={() => setActiveTab('drivers')}
                        className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'drivers' ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-slate-400 hover:text-slate-900 bg-white border border-slate-100 uppercase'}`}
                    >
                        Equipa Médica
                    </button>
                    <button 
                        onClick={() => setActiveTab('operations')}
                        className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'operations' ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'text-slate-400 hover:text-slate-900 bg-white border border-slate-100 uppercase'}`}
                    >
                        Monitorização Live
                    </button>
                </div>

                {feedback && (
                    <div className={`p-4 rounded-2xl border mb-6 animate-in slide-in-from-top-2 duration-300 flex items-center gap-3 ${
                        feedback.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
                    }`}>
                        {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                        <p className="text-xs font-black uppercase tracking-widest">{feedback.msg}</p>
                    </div>
                )}

                <div className="pb-4">
                    {activeTab === 'fleet' ? (
                        <button 
                            onClick={() => setShowAddAmbulance(true)}
                            className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            <Plus className="w-4 h-4" /> Adicionar Viatura
                        </button>
                    ) : (
                        <button 
                            onClick={() => setShowAddDriver(true)}
                            className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 shadow-lg shadow-slate-900/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            <Plus className="w-4 h-4" /> Novo Motorista
                        </button>
                    )}
                </div>
            </div>

            {/* Content Areas */}
            <div className="grid grid-cols-1 gap-8">
                {activeTab === 'fleet' && (
                    <div className="bg-white border border-slate-200 rounded-[3rem] overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade / IMEI</th>
                                        <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo & Placa</th>
                                        <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Atual</th>
                                        <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acções</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {ambulances.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-10 py-20 text-center">
                                                <div className="flex flex-col items-center">
                                                    <Truck className="w-12 h-12 text-slate-200 mb-4" />
                                                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Nenhuma viatura registada na frota.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        ambulances.map(amb => (
                                            <tr key={amb.id} className="hover:bg-slate-50/50 transition-all group">
                                                <td className="px-10 py-7">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                                            <Truck className="w-6 h-6" />
                                                        </div>
                                                        <div>
                                                            <p className="text-base font-black text-slate-900 leading-none">{amb.id}</p>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2 flex items-center gap-1">
                                                                <Smartphone className="w-3 h-3" /> IMEI: {amb.imei}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-7">
                                                    <div className="space-y-1.5">
                                                        <span className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-red-100">{amb.type}</span>
                                                        <p className="text-xs font-black text-slate-600 ml-1">{amb.plate}</p>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-7">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${amb.status === 'available' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-slate-300'}`}></div>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${amb.status === 'available' ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                            {amb.status === 'available' ? 'Operacional' : 'Manutenção'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-7 text-right">
                                                    <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => setEditingAmbulance(amb)}
                                                            className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-red-600 hover:border-red-100 rounded-xl transition-all shadow-sm"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteAmbulance(amb.id)}
                                                            className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-red-600 hover:border-red-100 rounded-xl transition-all shadow-sm"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'drivers' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {companyDrivers.length === 0 ? (
                                <div className="col-span-full py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                        <Users className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">Sem Motoristas Registados</h3>
                                    <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed px-6">
                                        Clique no botão superior para registar o seu primeiro profissional de saúde.
                                    </p>
                                </div>
                            ) : (
                                companyDrivers.map(driver => (
                                <div key={driver.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:shadow-2xl hover:border-red-200 transition-all relative group overflow-hidden">
                                     <div className="flex items-center gap-5 mb-8">
                                        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-xl border border-slate-200 group-hover:bg-red-600 group-hover:text-white group-hover:border-red-500 transition-all overflow-hidden">
                                            {driver.avatar ? (
                                                <img src={driver.avatar} alt={driver.name} className="w-full h-full object-cover" />
                                            ) : (
                                                driver.name.charAt(0)
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-black text-slate-900 leading-tight">{driver.name}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">ID: {driver.id.slice(0,8)}</p>
                                        </div>
                                     </div>

                                     <div className="space-y-4 mb-8">
                                        <div className="flex items-center gap-3 text-sm text-slate-600">
                                            <ShieldAlert className="w-4 h-4 text-slate-300" />
                                            <span className="font-bold">Licença: {driver.licenseNumber}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600">
                                            <Phone className="w-4 h-4 text-slate-300" />
                                            <span className="font-bold">{driver.phone}</span>
                                        </div>
                                     </div>

                                         <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${
                                                    driver.status === 'available' ? 'bg-emerald-500' : 
                                                    driver.status === 'break' ? 'bg-orange-500' : 
                                                    driver.status === 'on_duty' ? 'bg-blue-500' : 'bg-slate-400'
                                                }`}></div>
                                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                                                    {driver.status === 'available' ? 'Disponível' : 
                                                     driver.status === 'break' ? 'Em Pausa' : 
                                                     driver.status === 'on_duty' ? 'Em Serviço' : 'Fora de Serviço'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingDriver(driver)} className="p-2 text-slate-300 hover:text-red-600 transition-all"><Edit2 className="w-4 h-4" /></button>
                                                <button onClick={() => handleDeleteDriver(driver.id)} className="p-2 text-slate-300 hover:text-red-600 transition-all"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                         </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'operations' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-8 rounded-[3rem] border border-slate-200">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Monitorização de Emergências</h3>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Acompanhe as suas unidades em missão real</p>
                        </div>

                        {incidents.filter(inc => inc.ambulanceState?.companyId === currentUser.companyId).length === 0 ? (
                            <div className="py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                                <Activity className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                                <h4 className="text-lg font-bold text-slate-900 uppercase">Nenhuma Missão Activa</h4>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">As missões da sua frota aparecerão aqui em tempo real</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {incidents.filter(inc => inc.ambulanceState?.companyId === currentUser.companyId).map(inc => (
                                    <div key={inc.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:shadow-2xl transition-all border-l-8 border-l-blue-600">
                                        <div className="flex items-center justify-between mb-8">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                                                    <Truck className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-black text-slate-900 leading-none">{inc.ambulanceId}</h4>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{inc.ambulanceState?.driverName || 'Motorista em Turno'}</p>
                                                </div>
                                            </div>
                                            <div className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest animate-pulse">
                                                Em Missão
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-8">
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Paciente</p>
                                                <p className="text-xs font-black text-slate-900 uppercase truncate">{inc.patientName || 'Não Identificado'}</p>
                                            </div>
                                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Clock className="w-3 h-3" /> ETA Central</p>
                                                <p className="text-xs font-black text-slate-900 uppercase">{inc.ambulanceState?.eta || '--'} Minutos</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <button 
                                                onClick={() => setTrackingIncident(inc)}
                                                className="flex-1 bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
                                            >
                                                <Navigation className="w-4 h-4" /> Rastrear GPS
                                            </button>
                                            <button 
                                                onClick={() => onOpenComm(inc.id)}
                                                className="flex-1 bg-[#E0F2FE] text-blue-600 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
                                            >
                                                <MessageSquare className="w-4 h-4" /> Ver Chat OC
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {trackingIncident && (
                    <AmbulanceTracker 
                        incident={trackingIncident} 
                        company={companies.find(c => c.id === trackingIncident.companyId)}
                        onClose={() => setTrackingIncident(null)}
                    />
                )}
            </div>

            {/* Modals */}
            {showAddAmbulance && (
                <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-10 flex items-center justify-between border-b border-slate-100">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-600/20">
                                    <Truck className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Registar Viatura</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Vínculo IMEI e Capacidade</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAddAmbulance(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleAddAmbulance} className="p-10 space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID da Unidade</label>
                                    <input 
                                        required 
                                        placeholder="Ex: AMB-01" 
                                        value={newAmbulance.id} 
                                        onChange={e => setNewAmbulance({...newAmbulance, id: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Placa / Matrícula</label>
                                    <input 
                                        required 
                                        placeholder="Ex: ABC-123-MP" 
                                        value={newAmbulance.plate} 
                                        onChange={e => setNewAmbulance({...newAmbulance, plate: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Unidade</label>
                                <select 
                                    value={newAmbulance.type} 
                                    onChange={e => setNewAmbulance({...newAmbulance, type: e.target.value as any})} 
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="Básica">Suporte Básico de Vida (SBV)</option>
                                    <option value="Avançada">Suporte Avançado de Vida (SAV)</option>
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                    <Shield className="w-3 h-3" /> IMEI do Dispositivo (Vínculo de Login)
                                </label>
                                <input 
                                    required 
                                    placeholder="Introduza o IMEI de 15 dígitos" 
                                    value={newAmbulance.imei} 
                                    onChange={e => setNewAmbulance({...newAmbulance, imei: e.target.value})} 
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Capacidade de Resposta</label>
                                <select 
                                    value={newAmbulance.capacity} 
                                    onChange={e => setNewAmbulance({...newAmbulance, capacity: e.target.value})} 
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer"
                                >
                                    <option value="Padrão">Capacidade Padrão (1 Paciente)</option>
                                    <option value="Dupla">Capacidade Dupla (2 Pacientes)</option>
                                </select>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button 
                                    type="button" 
                                    onClick={() => setShowAddAmbulance(false)} 
                                    className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <Truck className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5" />
                                    )}
                                    Confirmar Registo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAddDriver && (
                <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-10 flex items-center justify-between border-b border-slate-100">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-600/20">
                                    <Users className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Novo Motorista</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Autorização de Resposta SSM</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAddDriver(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleAddDriver} className="p-10 space-y-7">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                                <input 
                                    required 
                                    placeholder="Nome do Motorista" 
                                    value={newDriver.name} 
                                    onChange={e => setNewDriver({...newDriver, name: e.target.value})} 
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nº Carteira de Condução</label>
                                    <input 
                                        required 
                                        placeholder="Ex: 12345678" 
                                        value={newDriver.licenseNumber} 
                                        onChange={e => setNewDriver({...newDriver, licenseNumber: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contacto Telefónico</label>
                                    <input 
                                        required 
                                        placeholder="Ex: 84XXXXXXX" 
                                        value={newDriver.phone} 
                                        onChange={e => setNewDriver({...newDriver, phone: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail de Login</label>
                                    <input 
                                        required 
                                        type="email"
                                        placeholder="Ex: motorista@exemplo.mz" 
                                        value={newDriver.email} 
                                        onChange={e => setNewDriver({...newDriver, email: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Palavra-passe</label>
                                    <input 
                                        required 
                                        type="password"
                                        placeholder="••••••••" 
                                        value={newDriver.password} 
                                        onChange={e => setNewDriver({...newDriver, password: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Shield className="w-3 h-3" /> IMEI do Telemóvel (Para Rastreio)
                                    </label>
                                    <input 
                                        required 
                                        placeholder="IMEI de 15 dígitos" 
                                        value={newDriver.imei} 
                                        onChange={e => setNewDriver({...newDriver, imei: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Truck className="w-3 h-3" /> Viatura Atribuída
                                    </label>
                                    <select 
                                        required 
                                        value={newDriver.currentAmbulanceId} 
                                        onChange={e => setNewDriver({...newDriver, currentAmbulanceId: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Selecionar Viatura...</option>
                                        {ambulances.map(amb => (
                                            <option key={amb.id} value={amb.id}>{amb.id} - {amb.plate}</option>
                                        ))}
                                    </select>
                                    {ambulances.length === 0 && (
                                        <p className="text-[9px] font-black text-red-500 uppercase mt-2 animate-pulse">
                                            Aviso: Deve registar pelo menos uma viatura antes de adicionar motoristas.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="pt-4 flex gap-4">
                                <button 
                                    type="button" 
                                    onClick={() => setShowAddDriver(false)} 
                                    className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <Activity className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-5 h-5" />
                                    )}
                                    Confirmar Registo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modals */}
            {editingAmbulance && (
                <div className="fixed inset-0 z-[300] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="p-10 flex items-center justify-between border-b border-slate-100">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-600/20">
                                    <Truck className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Editar Viatura</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{editingAmbulance.id}</p>
                                </div>
                            </div>
                            <button onClick={() => setEditingAmbulance(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateAmbulance} className="p-10 space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Placa / Matrícula</label>
                                    <input 
                                        required 
                                        placeholder="Ex: ABC-123-MP" 
                                        value={editingAmbulance.plate} 
                                        onChange={e => setEditingAmbulance({...editingAmbulance, plate: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IMEI do Dispositivo</label>
                                    <input 
                                        required 
                                        placeholder="IMEI de 15 dígitos" 
                                        value={editingAmbulance.imei} 
                                        onChange={e => setEditingAmbulance({...editingAmbulance, imei: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Unidade</label>
                                    <select 
                                        value={editingAmbulance.type} 
                                        onChange={e => setEditingAmbulance({...editingAmbulance, type: e.target.value as any})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="Básica">Básica</option>
                                        <option value="Avançada">Avançada</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label>
                                    <select 
                                        value={editingAmbulance.status} 
                                        onChange={e => setEditingAmbulance({...editingAmbulance, status: e.target.value as any})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="available">Operacional</option>
                                        <option value="maintenance">Manutenção</option>
                                    </select>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Activity className="w-5 h-5 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="w-5 h-5" />
                                )}
                                Atualizar Viatura
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {editingDriver && (
                <div className="fixed inset-0 z-[300] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-10 flex items-center justify-between border-b border-slate-100">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-600/20">
                                    <Users className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Editar Motorista</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{editingDriver.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setEditingDriver(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateDriver} className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                                <input 
                                    required 
                                    placeholder="Nome do Motorista" 
                                    value={editingDriver.name} 
                                    onChange={e => setEditingDriver({...editingDriver, name: e.target.value})} 
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nº Carteira</label>
                                    <input 
                                        required 
                                        placeholder="Ex: 12345678" 
                                        value={editingDriver.licenseNumber} 
                                        onChange={e => setEditingDriver({...editingDriver, licenseNumber: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                                    <input 
                                        required 
                                        placeholder="Ex: 84XXXXXXX" 
                                        value={editingDriver.phone} 
                                        onChange={e => setEditingDriver({...editingDriver, phone: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Viatura Atribuída</label>
                                    <select 
                                        value={editingDriver.currentAmbulanceId} 
                                        onChange={e => setEditingDriver({...editingDriver, currentAmbulanceId: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="">Nenhuma Viatura</option>
                                        {ambulances.map(amb => (
                                            <option key={amb.id} value={amb.id}>{amb.id} - {amb.plate}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado Operacional</label>
                                    <select 
                                        value={editingDriver.status} 
                                        onChange={e => setEditingDriver({...editingDriver, status: e.target.value as any})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="available">Disponível</option>
                                        <option value="on_duty">Em Serviço</option>
                                        <option value="break">Pausa</option>
                                        <option value="offline">Fora de Serviço</option>
                                    </select>
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30 flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-95 transition-all"
                            >
                                <CheckCircle2 className="w-5 h-5" /> Atualizar Motorista
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProviderFleetDashboard;
