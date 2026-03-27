
import React, { useState, useMemo, useEffect } from 'react';
import {
    Truck, Building2, MapPin, Phone, Users, ChevronRight, ArrowLeft,
    Search, Shield, Lock, Activity, UserPlus, CheckCircle2,
    AlertTriangle, User, FileText, X, Edit2, Trash2, Mail, Plus, Gauge
} from 'lucide-react';
import { Company, AdminUser, Driver, AmbulanceState } from '../types';
import { dbService } from '../services/dbService';
import { supabase } from '../services/supabase';

interface AmbulanceProvidersAdminProps {
    companies: Company[];
    ambulances: AmbulanceState[];
    drivers: Driver[];
    onUpdateDrivers: (drivers: Driver[]) => void;
}

const AmbulanceProvidersAdmin: React.FC<AmbulanceProvidersAdminProps> = ({ companies, ambulances, drivers, onUpdateDrivers }) => {
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [companyManager, setCompanyManager] = useState<AdminUser | null>(null);
    const [showAddAmbulance, setShowAddAmbulance] = useState(false);
    const [showAddDriver, setShowAddDriver] = useState(false);
    const [editingAmbulance, setEditingAmbulance] = useState<AmbulanceState | null>(null);
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
    const [editingManager, setEditingManager] = useState<AdminUser | null>(null);
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'fleet' | 'drivers'>('overview');

    // Child form states
    const [newDriver, setNewDriver] = useState({ 
        name: '', 
        licenseNumber: '', 
        phone: '', 
        email: '', 
        password: '', 
        imei: '',
        status: 'available' as any 
    });
    const [newAmbulance, setNewAmbulance] = useState({ id: '', plate: '', type: 'Básica' as any, imei: '', capacity: 'Padrão' });

    useEffect(() => {
        if (selectedCompanyId) {
            dbService.getCompanyManager(selectedCompanyId).then(setCompanyManager);
        }
    }, [selectedCompanyId]);

    const filteredAmbulances = useMemo(() => {
        return ambulances.filter(a => a.companyId === selectedCompanyId);
    }, [ambulances, selectedCompanyId]);

    const companyDrivers = useMemo(() => {
        return (drivers || []).filter(d => d.companyId === selectedCompanyId);
    }, [drivers, selectedCompanyId]);
    
    // New Company Form State
    const [newCompany, setNewCompany] = useState({
        name: '',
        address: '',
        phone: '',
        color: '#ef4444',
        managerName: '',
        managerEmail: '',
        managerPhone: '',
        managerPassword: ''
    });

    const ambulanceCompanies = useMemo(() => {
        return companies.filter(c => c.type === 'Ambulância');
    }, [companies]);

    const filteredCompanies = useMemo(() => {
        return ambulanceCompanies.filter(c => 
            c.name.toLowerCase().includes(search.toLowerCase())
        );
    }, [ambulanceCompanies, search]);

    const selectedCompany = companies.find(c => c.id === selectedCompanyId);

    const handleCreateProvider = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const companyId = `AMB-${Math.floor(Math.random() * 9000) + 1000}`;
            const companyToSave: Company = {
                id: companyId,
                name: newCompany.name,
                logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(newCompany.name)}&background=${newCompany.color.replace('#', '')}&color=fff`,
                color: newCompany.color,
                type: 'Ambulância',
                plan: 'Enterprise',
                contractEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                totalEmployees: 0,
                address: newCompany.address,
                phone: newCompany.phone
            };

            await dbService.saveCompany(companyToSave);

            const { error: authError } = await supabase.auth.signUp({
                email: newCompany.managerEmail,
                password: newCompany.managerPassword,
                options: {
                    data: {
                        full_name: newCompany.managerName,
                        role: 'GESTOR_FROTA_AMB',
                        phone: newCompany.managerPhone,
                        company_id: companyId,
                    }
                }
            });

            if (authError) throw authError;

            alert('Provedor e Gestor registados com sucesso!');
            setShowCreateModal(false);
            window.location.reload(); 
        } catch (err: any) {
            console.error("Erro ao criar provedor:", err);
            alert(`Erro: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddAmbulance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompanyId) return;
        setIsSubmitting(true);
        try {
            const ambulance: AmbulanceState = {
                id: newAmbulance.id,
                plate: newAmbulance.plate,
                type: newAmbulance.type,
                currentPos: [-25.9692, 32.5732],
                phase: 'idle',
                status: 'available',
                companyId: selectedCompanyId,
                imei: newAmbulance.imei,
                capacity: newAmbulance.capacity,
                eta: 0,
                distance: 0,
                performance: { totalIncidents: 0, acceptanceRate: 100, avgResponseTime: 0 }
            };
            await dbService.saveAmbulance(ambulance);
            alert("Viatura registada com sucesso!");
            setShowAddAmbulance(false);
            setNewAmbulance({ id: '', plate: '', type: 'Básica', imei: '', capacity: 'Padrão' });
        } catch (error) {
            console.error("Erro ao salvar viatura:", error);
            alert("Erro ao salvar viatura.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompanyId) return;
        setIsSubmitting(true);
        try {
            // 1. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: newDriver.email,
                password: newDriver.password,
                options: {
                    data: {
                        full_name: newDriver.name,
                        role: 'MOTORISTA_AMB',
                        phone: newDriver.phone,
                        company_id: selectedCompanyId,
                    }
                }
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error("Erro ao criar utilizador de autenticação.");

            // 2. Save Driver Record linked to Auth User
            const driver: Partial<Driver> = {
                companyId: selectedCompanyId,
                name: newDriver.name,
                licenseNumber: newDriver.licenseNumber,
                phone: newDriver.phone,
                email: newDriver.email,
                imei: newDriver.imei,
                authUserId: authData.user.id,
                status: newDriver.status
            };
            await dbService.saveDriver(driver);

            alert("Motorista registado com sucesso!");
            setShowAddDriver(false);
            setNewDriver({ 
                name: '', 
                licenseNumber: '', 
                phone: '', 
                email: '', 
                password: '', 
                imei: '', 
                status: 'available' 
            });
            const updated = await dbService.getDrivers();
            onUpdateDrivers(updated);
        } catch (error: any) {
            console.error("Erro ao salvar motorista:", error);
            alert(`Erro ao salvar motorista: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAmbulance = async (id: string) => {
        if (!confirm("Tem a certeza que deseja remover esta viatura?")) return;
        try {
            const { error } = await supabase.from('ambulances').delete().eq('id', id);
            if (error) throw error;
            // Real-time listener in App.tsx will update the state
            alert("Viatura eliminada com sucesso!");
        } catch (error) {
            console.error("Erro ao eliminar viatura:", error);
            alert("Erro ao eliminar viatura.");
        }
    };

    const handleDeleteDriver = async (id: string) => {
        if (!confirm("Tem a certeza que deseja remover este motorista?")) return;
        try {
            const { error } = await supabase.from('drivers').delete().eq('id', id);
            if (error) throw error;
            const updated = await dbService.getDrivers();
            onUpdateDrivers(updated);
        } catch (error) {
            alert("Erro ao eliminar motorista.");
        }
    };

    const handleUpdateAmbulance = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAmbulance) return;
        setIsSubmitting(true);
        try {
            await dbService.saveAmbulance(editingAmbulance);
            alert("Viatura atualizada com sucesso!");
            setEditingAmbulance(null);
            // Real-time listener in App.tsx will update the state
        } catch (error) {
            console.error("Erro ao atualizar viatura:", error);
            alert("Erro ao atualizar viatura.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateDriver = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDriver) return;
        try {
            await dbService.saveDriver(editingDriver);
            alert("Motorista atualizado com sucesso!");
            setEditingDriver(null);
            const updated = await dbService.getDrivers();
            onUpdateDrivers(updated);
        } catch (error) {
            alert("Erro ao atualizar motorista.");
        }
    };

    if (selectedCompany) {
        return (
            <div className="space-y-10 animate-in fade-in duration-500">
                <div className="flex flex-col gap-6">
                    <button
                        onClick={() => { setSelectedCompanyId(null); setActiveTab('overview'); }}
                        className="flex items-center gap-2 text-red-600 hover:text-red-800 font-bold text-sm uppercase tracking-widest transition-colors w-fit group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Voltar à Lista de Provedores
                    </button>

                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none rotate-12">
                            <Truck className="w-40 h-40" />
                        </div>
                        <div className="flex flex-col md:flex-row items-start gap-8">
                            <div
                                className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-2xl shrink-0"
                                style={{ backgroundColor: selectedCompany.color }}
                            >
                                {selectedCompany.name.charAt(0)}
                            </div>
                            <div className="flex-1 space-y-4 w-full">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-900 tracking-tight font-corporate uppercase">
                                            {selectedCompany.name}
                                        </h2>
                                        <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mt-1">
                                            Provedor de Ambulâncias • Unidade de Resposta Emergencial
                                        </p>
                                    </div>
                                    <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl">
                                        <button 
                                            onClick={() => setActiveTab('overview')}
                                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Geral
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('fleet')}
                                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'fleet' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Frota
                                        </button>
                                        <button 
                                            onClick={() => setActiveTab('drivers')}
                                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'drivers' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Motoristas
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-4 pt-2">
                                    <div className="bg-red-50 px-6 py-4 rounded-2xl border border-red-100 flex items-center gap-3">
                                        <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                                        <div>
                                            <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Base de Operações</p>
                                            <p className="text-sm font-bold text-slate-800">{selectedCompany.address || 'Não definido'}</p>
                                        </div>
                                    </div>
                                    <div className="bg-red-50 px-6 py-4 rounded-2xl border border-red-100 flex items-center gap-3">
                                        <Phone className="w-4 h-4 text-red-600 shrink-0" />
                                        <div>
                                            <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Contacto Central</p>
                                            <p className="text-sm font-bold text-slate-800">{selectedCompany.phone || 'Não definido'}</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 px-6 py-4 rounded-2xl border border-slate-800 flex items-center gap-3">
                                        <Truck className="w-4 h-4 text-white shrink-0" />
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Frota Ativa</p>
                                            <p className="text-sm font-bold text-white">{filteredAmbulances.length} Unidades</p>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 px-6 py-4 rounded-2xl border border-slate-800 flex items-center gap-3">
                                        <Users className="w-4 h-4 text-white shrink-0" />
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Motoristas</p>
                                            <p className="text-sm font-bold text-white">{companyDrivers.length} Registados</p>
                                        </div>
                                    </div>
                                    <div className="bg-emerald-50 px-6 py-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                                        <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <div>
                                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Status Operacional</p>
                                            <p className="text-sm font-bold text-slate-800">Ativo e Monitorizado</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm col-span-1">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8 flex items-center gap-3">
                                <Users className="w-6 h-6 text-red-600" /> Equipa de Gestão
                            </h3>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black">
                                            {companyManager?.initials || 'GM'}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-slate-900">{companyManager?.name || 'Gestor de Frota'}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsável Primário</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setEditingManager(companyManager || {
                                            id: 'NEW_MANAGER',
                                            name: 'Novo Gestor de Frota',
                                            role: 'GESTOR_FROTA_AMB',
                                            avatar: '',
                                            initials: 'GM',
                                            username: '',
                                            email: '',
                                            phone: '',
                                            address: '',
                                            dob: '',
                                            gender: 'M',
                                            idDocument: '',
                                            companyId: selectedCompanyId || undefined
                                        })}
                                        className="p-3 hover:bg-white rounded-[1.2rem] shadow-sm transition-all text-slate-400 hover:text-red-600"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-6 bg-blue-50/50 border border-blue-100/50 rounded-3xl">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Suporte SSM</p>
                                    <p className="text-xs font-bold text-slate-600 leading-relaxed">
                                        Como Administrador SSM, você tem autoridade total para gerir esta unidade. Use as abas acima para prestar suporte na configuração da frota e motoristas caso o provedor tenha dificuldades.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm col-span-2">
                             <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-8 flex items-center gap-3">
                                <Activity className="w-6 h-6 text-red-600" /> Estatísticas e Recursos
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                                        <Truck className="w-6 h-6 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frota Registada</p>
                                        <p className="text-2xl font-black text-slate-900">{filteredAmbulances.length}</p>
                                    </div>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                                        <Users className="w-6 h-6 text-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Corpo de Motoristas</p>
                                        <p className="text-2xl font-black text-slate-900">{companyDrivers.length}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Incidências</p>
                                    <h4 className="text-2xl font-black text-slate-900">142</h4>
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Taxa de Aceitação</p>
                                    <h4 className="text-2xl font-black text-emerald-600">98%</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'fleet' && (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
                            <div className="flex justify-between items-center mb-10">
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                                    <Truck className="w-6 h-6 text-red-600" /> Gestão de Frota - Suporte Admin
                                </h3>
                                <button 
                                    onClick={() => setShowAddAmbulance(true)}
                                    className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Registar Viatura
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade/IMEI</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo/Placa</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredAmbulances.length === 0 ? (
                                            <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-bold uppercase text-[10px]">Nenhuma viatura</td></tr>
                                        ) : (
                                            filteredAmbulances.map(amb => (
                                                <tr key={amb.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-5">
                                                        <p className="text-sm font-black text-slate-900">{amb.id}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">{amb.imei}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className="text-[10px] font-black text-red-600 uppercase">{amb.type}</span>
                                                        <p className="text-[10px] text-slate-900 font-bold">{amb.plate}</p>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${amb.status === 'available' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                                            <span className="text-[10px] font-black uppercase">{amb.status}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button 
                                                                onClick={() => setEditingAmbulance(amb)}
                                                                className="text-slate-300 hover:text-red-600 transition-colors"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteAmbulance(amb.id)}
                                                                className="text-slate-300 hover:text-red-600 transition-colors"
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
                    </div>
                )}

                {activeTab === 'drivers' && (
                    <div className="animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm">
                            <div className="flex justify-between items-center mb-10">
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                                    <Users className="w-6 h-6 text-red-600" /> Cadastro de Motoristas
                                </h3>
                                <button 
                                    onClick={() => setShowAddDriver(true)}
                                    className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" /> Novo Motorista
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {companyDrivers.length === 0 ? (
                                    <div className="col-span-full p-20 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center text-center">
                                        <User className="w-12 h-12 text-slate-100 mb-4" />
                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Sem Motoristas</p>
                                    </div>
                                ) : (
                                    companyDrivers.map(driver => (
                                        <div key={driver.id} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 group hover:border-red-200 transition-all">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-slate-900 border border-slate-200">{driver.name.charAt(0)}</div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-900">{driver.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{driver.licenseNumber}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-4 border-t border-slate-200/50">
                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{driver.status}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setEditingDriver(driver)} className="text-slate-300 hover:text-red-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                                    <button onClick={() => handleDeleteDriver(driver.id)} className="text-slate-300 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modals for selected company support */}
                {showAddAmbulance && (
                    <div className="fixed inset-0 z-[300] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-white rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                            {/* Modal Header */}
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
                                            placeholder="Ex: ALPHA-4" 
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
                                            <FileText className="w-5 h-5 animate-spin" />
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
                    <div className="fixed inset-0 z-[300] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-white rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                            {/* Modal Header */}
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

                            <form onSubmit={handleAddDriver} className="p-10 space-y-8">
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
                                            placeholder="Ex: joao@ssm.co.mz" 
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

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                        <Shield className="w-3 h-3" /> IMEI do Telemóvel (Para Rastreio)
                                    </label>
                                    <input 
                                        required 
                                        placeholder="Introduza o IMEI de 15 dígitos" 
                                        value={newDriver.imei} 
                                        onChange={e => setNewDriver({...newDriver, imei: e.target.value})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" 
                                    />
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
                                            <FileText className="w-5 h-5 animate-spin" />
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

                {/* Edit Ambulance Modal */}
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
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Atualização de Frota</p>
                                    </div>
                                </div>
                                <button onClick={() => setEditingAmbulance(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                                    <X className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>
                            <form 
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    await handleUpdateAmbulance(e);
                                }} 
                                className="p-10 space-y-8"
                            >
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Placa / Matrícula</label>
                                        <input required placeholder="Placa" value={editingAmbulance.plate} onChange={e => setEditingAmbulance({...editingAmbulance, plate: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">IMEI do Dispositivo</label>
                                        <input required placeholder="IMEI" value={editingAmbulance.imei} onChange={e => setEditingAmbulance({...editingAmbulance, imei: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo</label>
                                        <select value={editingAmbulance.type} onChange={e => setEditingAmbulance({...editingAmbulance, type: e.target.value as any})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none"><option value="Básica">Básica</option><option value="Avançada">Avançada</option></select>
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                                        <select value={editingAmbulance.status} onChange={e => setEditingAmbulance({...editingAmbulance, status: e.target.value as any})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none"><option value="available">Operacional</option><option value="maintenance">Manutenção</option></select>
                                    </div>
                                </div>
                                <div className="pt-4 flex gap-4">
                                    <button type="button" onClick={() => setEditingAmbulance(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Cancelar</button>
                                    <button type="submit" className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30">Confirmar Atualização</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Driver Modal */}
                {editingDriver && (
                    <div className="fixed inset-0 z-[300] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-white rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="p-10 flex items-center justify-between border-b border-slate-100">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-600/20">
                                        <Users className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Editar Motorista</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Dados Cadastrais</p>
                                    </div>
                                </div>
                                <button onClick={() => setEditingDriver(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                                    <X className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>
                            <form 
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    await handleUpdateDriver(e);
                                }} 
                                className="p-10 space-y-8"
                            >
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                                    <input required placeholder="Nome" value={editingDriver.name} onChange={e => setEditingDriver({...editingDriver, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Licença</label>
                                        <input required placeholder="Licença" value={editingDriver.licenseNumber} onChange={e => setEditingDriver({...editingDriver, licenseNumber: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                                        <input required placeholder="Telefone" value={editingDriver.phone} onChange={e => setEditingDriver({...editingDriver, phone: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                                    <select 
                                        value={editingDriver.status} 
                                        onChange={e => setEditingDriver({...editingDriver, status: e.target.value as any})} 
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none"
                                    >
                                        <option value="available">Disponível</option>
                                        <option value="on_duty">Em Serviço</option>
                                        <option value="off_duty">Fora de Serviço</option>
                                        <option value="break">Em Pausa</option>
                                    </select>
                                </div>
                                <div className="pt-4 flex gap-4">
                                    <button type="button" onClick={() => setEditingDriver(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Cancelar</button>
                                    <button type="submit" className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30">Confirmar Atualização</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Edit Manager Modal */}
                {editingManager && (
                    <div className="fixed inset-0 z-[300] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
                        <div className="bg-white rounded-[3rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="p-10 flex items-center justify-between border-b border-slate-100">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-600/20">
                                        <User className="w-8 h-8 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Editar Gestor</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Responsável de Frota</p>
                                    </div>
                                </div>
                                <button onClick={() => setEditingManager(null)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                                    <X className="w-6 h-6 text-slate-400" />
                                </button>
                            </div>
                            <form 
                                onSubmit={async (e) => {
                                    e.preventDefault();
                                    if (editingManager) {
                                        if (editingManager.id === 'NEW_MANAGER') {
                                            alert('A criação de novos gestores deve ser feita através do processo de registo de provedor. Esta modal permite apenas a edição de perfis existentes no Supabase.');
                                        } else {
                                            await dbService.updateProfile(editingManager.id, {
                                                name: editingManager.name,
                                                phone: editingManager.phone,
                                                email: editingManager.email
                                            });
                                            setCompanyManager({...editingManager});
                                            alert('Gestor atualizado com sucesso!');
                                        }
                                        setEditingManager(null);
                                    }
                                }} 
                                className="p-10 space-y-8"
                            >
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                                    <input required placeholder="Nome" value={editingManager.name} onChange={e => setEditingManager({...editingManager, name: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email de Acesso</label>
                                    <input required type="email" placeholder="Email" value={editingManager.email} onChange={e => setEditingManager({...editingManager, email: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone de Contacto</label>
                                    <input required placeholder="Telefone" value={editingManager.phone} onChange={e => setEditingManager({...editingManager, phone: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 outline-none transition-all" />
                                </div>
                                <div className="pt-4 flex gap-4">
                                    <button type="button" onClick={() => setEditingManager(null)} className="flex-1 py-5 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200">Cancelar</button>
                                    <button type="submit" className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/30">Confirmar Atualização</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight font-corporate uppercase">Provedores de Ambulâncias</h2>
                    <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mt-1 flex items-center gap-2">
                        <Truck className="w-3.5 h-3.5" /> {ambulanceCompanies.length} Redes de Resposta Registadas
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-600/20 active:scale-95 transition-all flex items-center gap-3"
                >
                    <Plus className="w-4 h-4" /> Registar Novo Provedor
                </button>
            </div>

            <div className="relative w-full">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                    type="text"
                    placeholder="Pesquisar por nome do provedor ou rede..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-16 pr-8 py-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm text-lg font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {filteredCompanies.map(company => (
                    <button
                        key={company.id}
                        onClick={() => setSelectedCompanyId(company.id)}
                        className="bg-white border border-slate-200 rounded-[3rem] p-8 hover:shadow-2xl hover:border-red-200 transition-all text-left group relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none rotate-12">
                            <Truck className="w-32 h-32" />
                        </div>

                        <div className="flex items-start gap-6 mb-8">
                            <div
                                className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl font-black text-white shadow-xl shrink-0"
                                style={{ backgroundColor: company.color }}
                            >
                                {company.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-xl font-black text-slate-900 leading-tight truncate">{company.name}</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Rede de Resposta Emergencial</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Frota</p>
                                <div className="flex items-center gap-2 text-slate-900">
                                    <Truck className="w-3.5 h-3.5 text-red-600" />
                                    <span className="text-sm font-black leading-none">{ambulances.filter(a => a.companyId === company.id).length}</span>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">Equipa</p>
                                <div className="flex items-center gap-2 text-slate-900">
                                    <Users className="w-3.5 h-3.5 text-red-600" />
                                    <span className="text-sm font-black leading-none">{drivers.filter(d => d.companyId === company.id).length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 mb-8">
                            <div className="flex items-center gap-3 text-sm text-slate-600">
                                <MapPin className="w-4 h-4 text-slate-300 shrink-0" />
                                <span className="truncate font-bold">{company.address || 'Endereço não definido'}</span>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                                    Operacional
                                </span>
                            </div>
                            <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest group-hover:bg-red-600 group-hover:text-white transition-all">
                                Gerir Provedor
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3.5rem] w-full max-w-3xl overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                        <div className="bg-slate-950 p-10 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-red-600/20">
                                    <Truck className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Registar Novo Provedor</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configuração de Frota e Gestão Autorizada</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white transition-colors bg-white/5 p-3 rounded-2xl">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateProvider} className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
                            <div className="space-y-6">
                                <h4 className="text-[11px] font-black text-red-600 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <Building2 className="w-4 h-4" /> Dados da Empresa Provedora
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Organização</label>
                                        <input
                                            required
                                            type="text"
                                            value={newCompany.name}
                                            onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all shadow-inner"
                                            placeholder="Ex: Medivac Emergências"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor da Identidade</label>
                                        <div className="flex gap-3">
                                            <input
                                                type="color"
                                                value={newCompany.color}
                                                onChange={e => setNewCompany({ ...newCompany, color: e.target.value })}
                                                className="w-16 h-[54px] p-1 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-red-500/10 transition-all cursor-pointer shadow-inner"
                                            />
                                            <input
                                                type="text"
                                                value={newCompany.color}
                                                readOnly
                                                className="flex-1 px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-400 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sede / Endereço</label>
                                        <input
                                            type="text"
                                            value={newCompany.address}
                                            onChange={e => setNewCompany({ ...newCompany, address: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all shadow-inner"
                                            placeholder="Ex: Av. Eduardo Mondlane, Maputo"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contacto Oficial</label>
                                        <input
                                            type="tel"
                                            value={newCompany.phone}
                                            onChange={e => setNewCompany({ ...newCompany, phone: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all shadow-inner"
                                            placeholder="Ex: +258 84 000 0000"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <UserPlus className="w-4 h-4" /> Credenciais do Gestor de Frota
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Gestor</label>
                                        <input
                                            required
                                            type="text"
                                            value={newCompany.managerName}
                                            onChange={e => setNewCompany({ ...newCompany, managerName: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all shadow-inner"
                                            placeholder="Nome completo do responsável"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail de Acesso</label>
                                        <input
                                            required
                                            type="email"
                                            value={newCompany.managerEmail}
                                            onChange={e => setNewCompany({ ...newCompany, managerEmail: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all shadow-inner"
                                            placeholder="jose@provedor.com"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contacto Móvel</label>
                                        <input
                                            type="tel"
                                            value={newCompany.managerPhone}
                                            onChange={e => setNewCompany({ ...newCompany, managerPhone: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all shadow-inner"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Palavra-passe Inicial</label>
                                        <input
                                            required
                                            type="password"
                                            value={newCompany.managerPassword}
                                            onChange={e => setNewCompany({ ...newCompany, managerPassword: e.target.value })}
                                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-red-500/10 transition-all shadow-inner"
                                            placeholder="Mínimo 6 caracteres"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-white/5 flex items-start gap-6">
                                <Shield className="w-8 h-8 text-blue-500 shrink-0" />
                                <div>
                                    <p className="text-[11px] font-black text-white uppercase tracking-widest leading-relaxed">Automatização de Acessos</p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-2 leading-relaxed">
                                        Ao finalizar o registo, o sistema irá criar automaticamente o perfil no Supabase Auth e associar este gestor à empresa. 
                                        O gestor terá autonomia para cadastrar a sua própria frota e equipa de motoristas.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-6 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-6 bg-slate-50 text-slate-500 rounded-[2rem] text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-all font-corporate"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-[2] py-6 bg-red-600 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-red-600/30 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isSubmitting ? <FileText className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                    Finalizar Registo e Ativar Redes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AmbulanceProvidersAdmin;
