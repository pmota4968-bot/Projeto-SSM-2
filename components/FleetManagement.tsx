import React, { useState } from 'react';
import { Truck, Activity, Settings, Battery, Signal, Clock, ShieldAlert, CheckCircle2, AlertTriangle, Plus, X, Save, Smartphone, Gauge, Loader2 } from 'lucide-react';
import { dbService } from '../services/dbService';
import { AmbulanceState, Driver } from '../types';

interface FleetManagementProps {
  ambulances: AmbulanceState[];
  drivers: Driver[];
  onAddAmbulance: (amb: AmbulanceState) => void;
}

const FleetManagement: React.FC<FleetManagementProps> = ({ ambulances, drivers, onAddAmbulance }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAmbulance, setNewAmbulance] = useState({
    id: '',
    plate: '',
    type: 'Básica' as any,
    imei: '',
    capacity: 'Padrão'
  });
  const [editingAmbulance, setEditingAmbulance] = useState<AmbulanceState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleAddAmbulance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const ambulance: AmbulanceState = {
        id: newAmbulance.id,
        plate: newAmbulance.plate,
        type: newAmbulance.type,
        currentPos: [-25.9692, 32.5732], // Default Maputo
        phase: 'idle',
        status: 'available',
        imei: newAmbulance.imei,
        capacity: newAmbulance.capacity,
        eta: 0,
        distance: 0,
        performance: {
          totalIncidents: 0,
          acceptanceRate: 100,
          avgResponseTime: 0
        },
      };

      await dbService.saveAmbulance(ambulance);
      onAddAmbulance(ambulance);
      setShowAddModal(false);
      setNewAmbulance({ id: '', plate: '', type: 'Básica', imei: '', capacity: 'Padrão' });
      alert("Viatura registada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar viatura:", error);
      alert("Erro ao salvar viatura no banco de dados.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateAmbulance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAmbulance) return;
    setIsSaving(true);
    try {
      await dbService.saveAmbulance(editingAmbulance);
      alert("Viatura atualizada com sucesso!");
      setEditingAmbulance(null);
    } catch (error) {
      console.error("Erro ao atualizar viatura:", error);
      alert("Erro ao atualizar viatura.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Frota Ativa</p>
          <div className="flex items-end gap-3">
            <h4 className="text-4xl font-black text-slate-900 tracking-tight">{(ambulances || []).length}</h4>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg mb-1">100% OPERACIONAL</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Manutenção Pendente</p>
          <h4 className="text-4xl font-black text-slate-900 tracking-tight">0</h4>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Equipa de Motoristas</p>
          <div className="flex items-end gap-3">
            <h4 className="text-4xl font-black text-slate-900 tracking-tight">{(drivers || []).length}</h4>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg mb-1">REGISTADOS</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-900 font-corporate uppercase tracking-tight">Inventário de Unidades Móveis</h3>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-slate-950 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-slate-800 transition-all"
          >
            <Plus className="w-4 h-4" /> Registar Nova Viatura
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade / Placa</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Local</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Equipamento</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ambulances.map(amb => (
                <tr key={amb.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center"><Truck className="w-5 h-5" /></div>
                      <div>
                        <p className="text-sm font-black text-slate-900 leading-none">{amb.id}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1.5">{amb.plate}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">{amb.type}</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                       <div className={`w-1.5 h-1.5 rounded-full ${amb.status === 'available' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                       <span className="text-[10px] font-black text-slate-600 uppercase">{amb.status === 'available' ? 'Disponível' : amb.status}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex gap-1.5">
                      <Battery className="w-3.5 h-3.5 text-emerald-500" />
                      <Signal className="w-3.5 h-3.5 text-blue-500" />
                      <ShieldAlert className="w-3.5 h-3.5 text-slate-300" />
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => setEditingAmbulance(amb)}
                      className="p-2 text-slate-300 hover:text-blue-600 transition-all active:scale-110"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Registo */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Registar Viatura</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Vínculo IMEI e Capacidade</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddAmbulance} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID da Unidade</label>
                  <input
                    required
                    type="text"
                    placeholder="AMB-01"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-600 transition-all"
                    value={newAmbulance.id}
                    onChange={e => setNewAmbulance({ ...newAmbulance, id: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Placa / Matrícula</label>
                  <input
                    required
                    type="text"
                    placeholder="Ex: ABC-123-MP"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-600 transition-all"
                    value={newAmbulance.plate}
                    onChange={e => setNewAmbulance({ ...newAmbulance, plate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Unidade</label>
                <select
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none appearance-none cursor-pointer"
                  value={newAmbulance.type}
                  onChange={e => setNewAmbulance({ ...newAmbulance, type: e.target.value as any })}
                >
                  <option value="Básica">Suporte Básico de Vida (SBV)</option>
                  <option value="Avançada">Suporte Avançado de Vida (SAV)</option>
                  <option value="Resgate">Unidade de Resgate</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Smartphone className="w-3 h-3" /> IMEI do Dispositivo (Vínculo de Login)
                </label>
                <input
                  required
                  type="text"
                  placeholder="Introduza o IMEI de 15 dígitos"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-600 transition-all"
                  value={newAmbulance.imei}
                  onChange={e => setNewAmbulance({ ...newAmbulance, imei: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Gauge className="w-3 h-3" /> Capacidade de Resposta
                </label>
                <select
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none appearance-none cursor-pointer"
                  value={newAmbulance.capacity}
                  onChange={e => setNewAmbulance({ ...newAmbulance, capacity: e.target.value })}
                >
                  <option value="Padrão">Capacidade Padrão (1 Paciente)</option>
                  <option value="Dupla">Capacidade Dupla (2 Pacientes)</option>
                  <option value="Múltipla">Múltiplas Vítimas (Triagem em Massa)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] py-4 bg-slate-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {isSubmitting ? "Gravando..." : "Confirmar Registo"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {editingAmbulance && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-300">
            <div className="bg-blue-600 p-8 text-white flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Editar Viatura</h3>
                  <p className="text-[10px] font-bold text-blue-100 uppercase tracking-widest mt-1">Ref: {editingAmbulance.id}</p>
                </div>
              </div>
              <button onClick={() => setEditingAmbulance(null)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateAmbulance} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID da Unidade</label>
                  <input
                    disabled
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold opacity-50 cursor-not-allowed"
                    value={editingAmbulance.id}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Placa / Matrícula</label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-600 transition-all"
                    value={editingAmbulance.plate}
                    onChange={e => setEditingAmbulance({ ...editingAmbulance, plate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Unidade</label>
                <select
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none appearance-none cursor-pointer"
                  value={editingAmbulance.type}
                  onChange={e => setEditingAmbulance({ ...editingAmbulance, type: e.target.value as any })}
                >
                  <option value="Básica">Suporte Básico de Vida (SBV)</option>
                  <option value="Avançada">Suporte Avançado de Vida (SAV)</option>
                  <option value="Resgate">Unidade de Resgate</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Smartphone className="w-3 h-3" /> IMEI do Dispositivo
                </label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-600 transition-all"
                  value={editingAmbulance.imei}
                  onChange={e => setEditingAmbulance({ ...editingAmbulance, imei: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Gauge className="w-3 h-3" /> Capacidade de Resposta
                </label>
                <select
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none appearance-none cursor-pointer"
                  value={editingAmbulance.capacity}
                  onChange={e => setEditingAmbulance({ ...editingAmbulance, capacity: e.target.value })}
                >
                  <option value="Padrão">Capacidade Padrão (1 Paciente)</option>
                  <option value="Dupla">Capacidade Dupla (2 Pacientes)</option>
                  <option value="Múltipla">Múltiplas Vítimas (Triagem em Massa)</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingAmbulance(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {isSaving ? "Gravando..." : "Atualizar Viatura"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetManagement;
