
import React, { useState, useMemo } from 'react';
import {
    Building2, MapPin, Phone, Users, ChevronRight, ArrowLeft,
    Search, Shield, Lock, Heart, ClipboardList, CheckCircle2,
    AlertTriangle, User, FileText, X
} from 'lucide-react';
import { COMPANIES } from '../constants';
import { Employee, Company } from '../types';

interface CorporateClientsAdminProps {
    employees: Employee[];
    companies: Company[];
    onAddCompany?: (company: Company) => void;
}

const CorporateClientsAdmin: React.FC<CorporateClientsAdminProps> = ({ employees, companies, onAddCompany }) => {
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newCompany, setNewCompany] = useState<Partial<Company>>({
        name: '',
        type: 'Empresa',
        plan: 'Basic',
        address: '',
        phone: '',
        color: '#2563eb'
    });

    const selectedCompany = companies.find(c => c.id === selectedCompanyId);

    const companyEmployees = useMemo(() => {
        if (!selectedCompanyId) return [];
        return employees.filter(e => e.companyId === selectedCompanyId);
    }, [employees, selectedCompanyId]);

    const filteredCompanyEmployees = useMemo(() => {
        return companyEmployees.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            p.bi.toLowerCase().includes(search.toLowerCase())
        );
    }, [companyEmployees, search]);

    // Compute employee counts per company
    const employeeCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        employees.forEach(e => {
            counts[e.companyId] = (counts[e.companyId] || 0) + 1;
        });
        return counts;
    }, [employees]);

    const handleCreateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCompany.name) return;

        setIsSubmitting(true);
        try {
            const { dbService } = await import('../services/dbService');
            const companyToSave: Company = {
                id: '', // Will be generated in dbService
                name: newCompany.name || '',
                logo: `https://ui-avatars.com/api/?name=${encodeURIComponent(newCompany.name || '')}&background=${(newCompany.color || '#2563eb').replace('#', '')}&color=fff`,
                color: newCompany.color || '#2563eb',
                type: newCompany.type as any,
                plan: newCompany.plan as any,
                contractEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                totalEmployees: 0,
                address: newCompany.address,
                phone: newCompany.phone
            };

            const savedCompany = await dbService.saveCompany(companyToSave);
            if (onAddCompany) onAddCompany(companyToSave);
            setShowCreateModal(false);
            setNewCompany({
                name: '',
                type: 'Empresa',
                plan: 'Basic',
                address: '',
                phone: '',
                color: '#2563eb'
            });
        } catch (err) {
            console.error("Erro ao criar empresa:", err);
            alert("Erro ao criar empresa. Verifique a consola.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- DETAIL VIEW: Selected Company ---
    if (selectedCompany) {
        const registeredCount = companyEmployees.length;

        return (
            <div className="space-y-10 animate-in fade-in duration-500">
                {/* Back button + Header */}
                <div className="flex flex-col gap-6">
                    <button
                        onClick={() => { setSelectedCompanyId(null); setSearch(''); }}
                        className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-bold text-sm uppercase tracking-widest transition-colors w-fit group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Voltar à Lista de Clientes
                    </button>

                    {/* Company Info Card */}
                    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-[0.03] pointer-events-none rotate-12">
                            <Building2 className="w-40 h-40" />
                        </div>
                        <div className="flex flex-col md:flex-row items-start gap-8">
                            <div
                                className="w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-2xl shrink-0"
                                style={{ backgroundColor: selectedCompany.color }}
                            >
                                {selectedCompany.name.charAt(0)}
                            </div>
                            <div className="flex-1 space-y-4">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight font-corporate uppercase">
                                        {selectedCompany.name}
                                    </h2>
                                    <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mt-1">
                                        {selectedCompany.type} • Plano {selectedCompany.plan}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-4 pt-2">
                                    <div className="bg-[#E0F2FE] px-6 py-4 rounded-2xl border border-blue-100 flex items-center gap-3">
                                        <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                                        <div>
                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Endereço</p>
                                            <p className="text-sm font-bold text-slate-800">{selectedCompany.address || 'Não definido'}</p>
                                        </div>
                                    </div>
                                    <div className="bg-[#E0F2FE] px-6 py-4 rounded-2xl border border-blue-100 flex items-center gap-3">
                                        <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                                        <div>
                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Contacto</p>
                                            <p className="text-sm font-bold text-slate-800">{selectedCompany.phone || 'Não definido'}</p>
                                        </div>
                                    </div>
                                    <div className="bg-[#EBFDF5] px-6 py-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                                        <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <div>
                                            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Colaboradores Cadastrados</p>
                                            <p className="text-sm font-bold text-slate-800">{registeredCount} Registos na Base Médica</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Employee list header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight font-corporate uppercase">
                            Base de Dados Médica
                        </h3>
                        <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mt-1 flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5" /> {filteredCompanyEmployees.length} Registos Encontrados • AES-256 Bit
                        </p>
                    </div>
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                            type="text"
                            placeholder="Pesquisar por BI ou Nome..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[1.5rem] shadow-sm text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                    </div>
                </div>

                {/* Employee Cards (same style as PatientManagement) */}
                {filteredCompanyEmployees.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-[3rem] p-20 flex flex-col items-center text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6 border border-slate-100">
                            <Users className="w-10 h-10" />
                        </div>
                        <h3 className="text-lg font-black text-slate-900 uppercase">Nenhum registo disponível</h3>
                        <p className="text-slate-400 text-sm max-w-xs mt-2">Esta empresa ainda não possui colaboradores cadastrados na base de dados médica.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {filteredCompanyEmployees.map(p => (
                            <div key={p.id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:shadow-xl transition-all group overflow-hidden relative animate-in slide-in-from-left-4">
                                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none rotate-12"><Heart className="w-32 h-32" /></div>

                                <div className="flex flex-col lg:flex-row gap-10">
                                    {/* Left: Basic Info */}
                                    <div className="flex items-start gap-6 lg:w-1/3">
                                        <div className="w-20 h-20 bg-slate-900 text-white rounded-3xl flex items-center justify-center text-3xl font-black shadow-2xl shrink-0">
                                            {p.name[0]}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 leading-tight mb-2">{p.name}</h3>
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BI: {p.bi}</p>
                                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{selectedCompany.name}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Center: Critical Medical Data */}
                                    <div className="lg:w-2/3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 shadow-inner">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Cobertura Seguradora</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm"><Shield className="w-5 h-5" /></div>
                                                <div><p className="text-xs font-black text-slate-900">{p.insurer}</p><p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Apólice: {p.policyNumber}</p></div>
                                            </div>
                                        </div>

                                        <div className="bg-red-50 p-5 rounded-3xl border border-red-100">
                                            <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mb-3">Informação Crítica</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-red-600 shadow-sm"><Heart className="w-5 h-5" /></div>
                                                <div><p className="text-xs font-black text-red-900">Grupo: {p.bloodType}</p><p className="text-[9px] font-bold text-red-600/60 uppercase mt-0.5">{p.allergies?.join(', ') || 'Sem alergias'}</p></div>
                                            </div>
                                        </div>

                                        <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100">
                                            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-3">Contacto Emergência</p>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm"><Phone className="w-5 h-5" /></div>
                                                <div><p className="text-xs font-black text-blue-900">{p.emergencyContact.name}</p><p className="text-[9px] font-bold text-blue-600/60 uppercase mt-0.5">{p.emergencyContact.phone}</p></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-between flex-wrap gap-4">
                                    <div className="flex gap-4">
                                        <button className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Ver Histórico Clínico</button>
                                        <button className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Editar Ficha</button>
                                    </div>
                                    <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-emerald-100">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Última Validação: {new Date().toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // --- LIST VIEW: All Companies ---
    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight font-corporate uppercase">Clientes Corporativos</h2>
                    <p className="text-slate-400 font-bold text-[11px] uppercase tracking-widest mt-1 flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5" /> {companies.length} Empresas Registadas
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-3"
                >
                    <Users className="w-4 h-4" /> Registar Novo Cliente
                </button>
            </div>

            {/* Create Company Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-white/20 animate-in zoom-in-95 duration-300">
                        <div className="bg-slate-950 p-8 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                                    <Building2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Novo Cliente Corporativo</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Configuração de Acesso SSM</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCreateModal(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateCompany} className="p-10 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Organização</label>
                                    <input
                                        required
                                        type="text"
                                        value={newCompany.name}
                                        onChange={e => setNewCompany({ ...newCompany, name: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                                        placeholder="Ex: Banco de Moçambique"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Entidade</label>
                                    <select
                                        value={newCompany.type}
                                        onChange={e => setNewCompany({ ...newCompany, type: e.target.value as any })}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none shadow-inner"
                                    >
                                        <option value="Banco">Setor Bancário</option>
                                        <option value="Escola">Instituição de Ensino</option>
                                        <option value="Empresa">Empresa Geral</option>
                                        <option value="Outro">Outro</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Plano de Serviço</label>
                                    <select
                                        value={newCompany.plan}
                                        onChange={e => setNewCompany({ ...newCompany, plan: e.target.value as any })}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none shadow-inner"
                                    >
                                        <option value="Basic">SSM Basic</option>
                                        <option value="Premium">SSM Premium</option>
                                        <option value="Enterprise">SSM Enterprise (Full)</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor Identitária</label>
                                    <input
                                        type="color"
                                        value={newCompany.color}
                                        onChange={e => setNewCompany({ ...newCompany, color: e.target.value })}
                                        className="w-full h-[54px] p-1 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer shadow-inner"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sede / Endereço</label>
                                    <input
                                        type="text"
                                        value={newCompany.address}
                                        onChange={e => setNewCompany({ ...newCompany, address: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                                        placeholder="Ex: Av. 25 de Setembro, Maputo"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contacto Oficial</label>
                                    <input
                                        type="tel"
                                        value={newCompany.phone}
                                        onChange={e => setNewCompany({ ...newCompany, phone: e.target.value })}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all shadow-inner"
                                        placeholder="Ex: +258 84 000 0000"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isSubmitting ? <FileText className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                    Finalizar Registo e Ativar Acesso
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {companies.map(company => {
                    const regCount = employeeCounts[company.id] || 0;
                    return (
                        <button
                            key={company.id}
                            onClick={() => setSelectedCompanyId(company.id)}
                            className="bg-white border border-slate-200 rounded-[2rem] p-8 hover:shadow-xl hover:border-blue-200 transition-all text-left group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none rotate-12">
                                <Building2 className="w-24 h-24" />
                            </div>

                            <div className="flex items-start gap-5 mb-6">
                                <div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg shrink-0"
                                    style={{ backgroundColor: company.color }}
                                >
                                    {company.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-black text-slate-900 leading-tight truncate">{company.name}</h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{company.type} • {company.plan}</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <MapPin className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                    <span className="truncate font-medium">{company.address || 'Endereço não definido'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Phone className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                    <span className="truncate font-medium">{company.phone || 'Contacto não definido'}</span>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-emerald-500" />
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                        {regCount} Colaborador{regCount !== 1 ? 'es' : ''} Cadastrado{regCount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <div className={`w-2.5 h-2.5 rounded-full ${regCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CorporateClientsAdmin;
