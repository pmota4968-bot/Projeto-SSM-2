
import React, { useState } from 'react';
import { Sparkles, Loader2, FileText, CheckCircle2, Shield, Printer, ArrowRight, ArrowLeft, AlertCircle, Info, ClipboardList, Stethoscope, Building2, Send, ShieldCheck, Users2, Plus, Siren } from 'lucide-react';
import { getProtocolAdvice } from '../services/geminiService';
import { ProtocolSuggestion, EmergencyPriority, EmergencyCase, AdminUser, Company, Employee } from '../types';
import { PRIORITY_COLORS, COMPANIES } from '../constants';

type TriageMode = 'AI_ANALYSIS' | 'STRUCTURED_FLOW';

interface PatientIdentity {
  name: string;
  id?: string;
  age?: string;
  classification?: string;
  results?: Record<string, boolean>;
}

interface TriageData {
  company: string;
  patientCount: number;
  patients: PatientIdentity[];
  location: string;
  contact: string;
}

interface ProtocolAssistantProps {
  currentUser: AdminUser;
  onAddIncident?: (incident: EmergencyCase) => void;
  initialData?: { companyName?: string; companyId?: string } | null;
  onNavigate?: (tab: string) => void;
  companies?: Company[];
  employees?: Employee[];
}

const ProtocolAssistant: React.FC<ProtocolAssistantProps> = ({ 
  currentUser, 
  onAddIncident, 
  initialData, 
  onNavigate, 
  companies = [],
  employees = [] 
}) => {
  const [mode, setMode] = useState<TriageMode>('STRUCTURED_FLOW');
  const [scenario, setScenario] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<ProtocolSuggestion | null>(null);

  // Structured Flow State - "company" pré-preenchido simulando alerta de entrada
  const [currentStep, setCurrentStep] = useState(0);
  const userCompany = COMPANIES.find(c => c.id === currentUser.companyId);

  const [triageData, setTriageData] = useState<TriageData>(() => ({
    company: initialData?.companyName || (userCompany ? userCompany.name : ''),
    patientCount: 1,
    patients: [{ name: '', age: '' }],
    location: '',
    contact: ''
  }));

  const [activePatientIdx, setActivePatientIdx] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [showEmployeeSearch, setShowEmployeeSearch] = useState<number | null>(null);

  const isCompanyLocked = !!initialData?.companyName || !!userCompany;

  React.useEffect(() => {
    if (initialData?.companyName) {
      setTriageData(prev => ({ ...prev, company: initialData.companyName! }));
    }
  }, [initialData]);

  const handleAnalyze = async () => {
    if (!scenario.trim()) return;
    setLoading(true);
    try {
      const result = await getProtocolAdvice(scenario);
      setSuggestion(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 0, title: 'Validação Mínima (Etapa 0)', description: 'Identificação da origem corporativa e dados do paciente.', questions: [] },
    { id: 1, title: 'Discriminadores Críticos (Etapa 1)', description: 'Identificação de perigo imediato de vida.', priority: EmergencyPriority.CRITICAL, questions: [{ id: 'q1_1', text: 'A pessoa está inconsciente?' }, { id: 'q1_2', text: 'Dispneia grave?' }, { id: 'q1_3', text: 'Dor no peito?' }] },
    { id: 2, title: 'Discriminadores de Alto Risco (Etapa 2)', description: 'Sinais de gravidade elevada.', priority: EmergencyPriority.HIGH, questions: [{ id: 'q2_1', text: 'Está consciente, mas sonolento?' }, { id: 'q2_2', text: 'Dispneia moderada?' }] },
    { id: 3, title: 'Urgência Estável (Etapa 3)', description: 'Condições estáveis.', priority: EmergencyPriority.MODERATE, questions: [{ id: 'q3_1', text: 'Cefaleia intensa?' }, { id: 'q3_2', text: 'Fractura sem exposição?' }] },
    { id: 4, title: 'Baixa Prioridade (Etapa 4)', description: 'Queixas ligeiras.', priority: EmergencyPriority.LOW, questions: [{ id: 'q4_1', text: 'Ferimentos superficiais?' }] }
  ];

  const handleNextFlow = () => {
    if (currentStep === 0) {
      if (triageData.patients.some(p => !p.name)) {
        alert("Por favor, identifique todos os pacientes.");
        return;
      }
      setCurrentStep(1);
    } else {
      const hasYes = steps[currentStep].questions.some(q => results[q.id]);
      const currentPriority = hasYes ? steps[currentStep].priority : (currentStep < 4 ? undefined : EmergencyPriority.LOW);
      
      if (currentPriority) {
        const updatedPatients = [...triageData.patients];
        updatedPatients[activePatientIdx] = {
          ...updatedPatients[activePatientIdx],
          classification: currentPriority,
          results: { ...results }
        };

        if (activePatientIdx < triageData.patientCount - 1) {
          setTriageData({ ...triageData, patients: updatedPatients });
          setActivePatientIdx(activePatientIdx + 1);
          setResults({});
          setCurrentStep(1);
        } else {
          setTriageData({ ...triageData, patients: updatedPatients });
          setSuggestion({
            classification: currentPriority,
            actionRequired: 'TRIAGEM CONCLUÍDA',
            reasoning: 'Triagem realizada com sucesso para todos os pacientes.',
            suggestedResources: ['Acionamento Equipa Médica']
          });
          setCurrentStep(5);
        }
      } else if (currentStep < 4) {
        setCurrentStep(currentStep + 1);
      } else {
        // Se chegou ao fim sem nenhum "Sim", classifica como AZUL (Não Urgente)
        const finalPriority = EmergencyPriority.LOW;
        const updatedPatients = [...triageData.patients];
        updatedPatients[activePatientIdx] = {
          ...updatedPatients[activePatientIdx],
          classification: finalPriority,
          results: { ...results }
        };

        if (activePatientIdx < triageData.patientCount - 1) {
          setTriageData({ ...triageData, patients: updatedPatients });
          setActivePatientIdx(activePatientIdx + 1);
          setResults({});
          setCurrentStep(1);
        } else {
          setTriageData({ ...triageData, patients: updatedPatients });
          setSuggestion({
            classification: finalPriority,
            actionRequired: 'TRIAGEM CONCLUÍDA (NÃO URGENTE)',
            reasoning: 'Nenhum discriminador de urgência detetado.',
            suggestedResources: ['Acompanhamento Telefónico']
          });
          setCurrentStep(5);
        }
      }
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setResults({});
    setSuggestion(null);
    setTriageData({
      company: initialData?.companyName || userCompany?.name || 'SSM Global Dispatch',
      patientCount: 1,
      patients: [{ name: '', age: '' }],
      location: '',
      contact: ''
    });
    setActivePatientIdx(0);
  };

  const handleSubmitToOperations = () => {
    if (!suggestion || !onAddIncident) return;

    const newCase: EmergencyCase = {
      id: `INC-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: triageData.patients.map(p => `${p.name}: ${p.classification}`).join(' | '),
      status: 'active',
      priority: suggestion.classification as any,
      coords: [-25.9692 + (Math.random() - 0.5) * 0.01, 32.5732 + (Math.random() - 0.5) * 0.01],
      patientName: triageData.patients[0]?.name || 'Múltiplos Pacientes',
      patientCount: triageData.patientCount,
      companyId: initialData?.companyId || companies.find(c => c.name === triageData.company)?.id || currentUser.companyId || 'SSM',
      employeeId: triageData.patients[0]?.id || 'EXTERNAL'
    };

    onAddIncident(newCase);
    alert('Caso submetido com sucesso.');
    if (onNavigate) onNavigate('dashboard');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-sm overflow-hidden relative">
      <div className="relative z-10 flex flex-col gap-8">
        <div className="flex justify-between items-center">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight font-corporate uppercase">Protocolo de <span className="text-blue-600">Triagem SSM</span></h2>
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => { setMode('STRUCTURED_FLOW'); handleReset(); }}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'STRUCTURED_FLOW' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Stethoscope className="w-4 h-4" /> Questionário
            </button>
            <button
              onClick={() => { setMode('AI_ANALYSIS'); handleReset(); }}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${mode === 'AI_ANALYSIS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Sparkles className="w-4 h-4" /> Análise IA
            </button>
          </div>
        </div>
        
        {mode === 'AI_ANALYSIS' ? (
           <div className="space-y-4">
            <textarea className="w-full h-48 p-6 border border-slate-200 rounded-3xl" placeholder="Descrição da ocorrência..." value={scenario} onChange={(e) => setScenario(e.target.value)} />
            <button onClick={handleAnalyze} className="w-full bg-slate-950 text-white py-4 rounded-2xl">{loading ? 'Processando...' : 'Gerar Parecer'}</button>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto w-full">
            {currentStep < 5 ? (
              <div className="bg-slate-50 rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-inner flex flex-col md:flex-row min-h-[500px]">
                <div className="w-full md:w-72 bg-white border-r border-slate-100 p-8 shrink-0">
                  <div className="space-y-6">
                    {steps.map((step, idx) => (
                      <div key={idx} className={`flex items-center gap-4 transition-all ${currentStep === idx ? 'opacity-100 scale-105' : 'opacity-40 grayscale'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-sm ${currentStep === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {idx}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">Passo</p>
                          <p className={`text-[10px] font-black uppercase tracking-tighter truncate ${currentStep === idx ? 'text-blue-600' : 'text-slate-700'}`}>
                            {step.title.split(' (')[0]}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1 p-10 flex flex-col animate-in slide-in-from-right-4">
                  <div className="mb-10">
                    <h3 className="text-2xl font-black text-slate-900 font-corporate uppercase tracking-tight">{steps[currentStep].title}</h3>
                    <p className="text-sm font-medium text-slate-500 mt-2">{steps[currentStep].description}</p>
                  </div>

                  <div className="flex-1 space-y-6">
                    {currentStep === 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-top-4 duration-500">
                        <div className="space-y-6 md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                            Identificação dos Pacientes
                            <span className="text-blue-600">Qtd: {triageData.patientCount}</span>
                          </label>
                          <div className="space-y-4">
                            {Array.from({ length: triageData.patientCount }).map((_, idx) => (
                              <div key={idx} className="relative group">
                                <div className="flex gap-3">
                                  <div className="flex-1 relative">
                                    <input
                                      required
                                      className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-black focus:border-blue-600 outline-none pr-12"
                                      placeholder={`Nome do Paciente ${idx + 1}`}
                                      value={triageData.patients[idx]?.name || ''}
                                      onChange={e => {
                                        const newP = [...triageData.patients];
                                        newP[idx] = { ...newP[idx], name: e.target.value };
                                        setTriageData({ ...triageData, patients: newP });
                                      }}
                                    />
                                    <button 
                                      type="button"
                                      onClick={() => setShowEmployeeSearch(showEmployeeSearch === idx ? null : idx)}
                                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                      <Users2 className="w-5 h-5" />
                                    </button>
                                  </div>
                                  <input
                                    className="w-24 bg-white border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold text-black text-center focus:border-blue-600 outline-none"
                                    placeholder="Idade"
                                    value={triageData.patients[idx]?.age || ''}
                                    onChange={e => {
                                      const newP = [...triageData.patients];
                                      newP[idx] = { ...newP[idx], age: e.target.value };
                                      setTriageData({ ...triageData, patients: newP });
                                    }}
                                  />
                                </div>

                                {showEmployeeSearch === idx && (
                                  <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 max-h-60 overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">Colaboradores da Empresa</p>
                                    <div className="space-y-1">
                                      {employees.filter(emp => !triageData.company || emp.companyName === triageData.company).map(emp => (
                                        <button
                                          key={emp.id}
                                          type="button"
                                          onClick={() => {
                                            const newP = [...triageData.patients];
                                            newP[idx] = { ...newP[idx], name: emp.name, id: emp.id, age: '30' }; 
                                            setTriageData({ ...triageData, patients: newP });
                                            setShowEmployeeSearch(null);
                                          }}
                                          className="w-full text-left p-3 hover:bg-blue-50 rounded-xl transition-all flex items-center justify-between group"
                                        >
                                          <div>
                                            <p className="text-sm font-bold text-slate-700">{emp.name}</p>
                                            <p className="text-[10px] text-slate-400 uppercase">{emp.position}</p>
                                          </div>
                                          <Plus className="w-4 h-4 text-slate-200 group-hover:text-blue-600" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Total de Pacientes</label>
                          <div className="flex items-center gap-3">
                            <button 
                              type="button"
                              onClick={() => {
                                const count = Math.max(1, triageData.patientCount - 1);
                                setTriageData({ 
                                  ...triageData, 
                                  patientCount: count,
                                  patients: triageData.patients.slice(0, count)
                                });
                              }}
                              className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-xl font-black hover:bg-slate-200"
                            > - </button>
                            <div className="flex-1 bg-white border border-slate-200 rounded-2xl px-6 py-3.5 text-center text-sm font-black text-blue-600">
                              {triageData.patientCount}
                            </div>
                            <button 
                              type="button"
                              onClick={() => {
                                const count = triageData.patientCount + 1;
                                setTriageData({ 
                                  ...triageData, 
                                  patientCount: count,
                                  patients: [...triageData.patients, { name: '', age: '' }]
                                });
                              }}
                              className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center text-xl font-black hover:bg-slate-800"
                            > + </button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contacto de Reporte</label>
                          <input
                            type="text"
                            className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-black focus:border-blue-600 outline-none"
                            placeholder="Telemóvel ou Rádio"
                            value={triageData.contact}
                            onChange={e => setTriageData({ ...triageData, contact: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Local Exacto do Evento</label>
                          <input
                            type="text"
                            className="w-full bg-white border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-black focus:border-blue-600 outline-none"
                            placeholder="Andar, Sala, Referência..."
                            value={triageData.location}
                            onChange={e => setTriageData({ ...triageData, location: e.target.value })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        <div className="mb-6 flex items-center justify-between bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black">
                              {activePatientIdx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 leading-none">{triageData.patients[activePatientIdx]?.name}</p>
                              <p className="text-[10px] font-bold text-blue-600 uppercase mt-1 tracking-widest">Triagem Individual do Paciente</p>
                            </div>
                          </div>
                          <div className="px-4 py-2 bg-white rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-100">
                            {activePatientIdx + 1} / {triageData.patientCount}
                          </div>
                        </div>

                        {steps[currentStep].questions.map(q => (
                          <div key={q.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-200 transition-all">
                            <span className="text-sm font-bold text-slate-700">{q.text}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setResults({ ...results, [q.id]: true })}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${results[q.id] === true ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                              >
                                Sim
                              </button>
                              <button
                                onClick={() => setResults({ ...results, [q.id]: false })}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${results[q.id] === false ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                              >
                                Não
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-12 flex justify-between items-center pt-8 border-t border-slate-200">
                    <button
                      onClick={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
                      disabled={currentStep === 0}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 disabled:opacity-0 transition-all"
                    >
                      <ArrowLeft className="w-4 h-4" /> Anterior
                    </button>
                    <button
                      onClick={handleNextFlow}
                      className="bg-blue-600 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-3"
                    >
                      {currentStep === 0 ? 'Iniciar Protocolo Global' : (activePatientIdx < triageData.patientCount - 1 ? 'Próximo Paciente' : 'Finalizar Triagem')} <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto bg-slate-50 border border-slate-200 rounded-[3rem] p-12 shadow-xl animate-in zoom-in-95">
                <div className="text-center mb-10">
                  <div className={`w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 ${PRIORITY_COLORS[suggestion!.classification as any]}`}>
                    <span className="text-5xl font-black font-corporate">{suggestion!.classification}</span>
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 font-corporate uppercase tracking-tight">{suggestion!.actionRequired}</h3>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">Classificação Final de Triagem</p>
                </div>

                <div className="bg-white rounded-3xl p-8 border border-slate-100 space-y-8 mb-10">
                  <div className="grid grid-cols-2 gap-8 pb-8 border-b border-slate-100">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Empresa</p>
                      <p className="text-sm font-black text-blue-600">{triageData.company}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pacientes e Classificações</p>
                      <div className="space-y-3">
                        {triageData.patients.map((p, i) => (
                          <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                              <p className="text-sm font-black text-slate-900">{p.name}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Idade: {p.age || '--'}</p>
                            </div>
                            <span className={`px-4 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-white ${PRIORITY_COLORS[p.classification as any]}`}>
                              {p.classification}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Info className="w-4 h-4" /> Orientações Imediatas</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {suggestion?.suggestedResources.map((res, i) => (
                        <div key={i} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{res}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={handleReset} className="flex-1 py-5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">Nova Triagem</button>
                  <button
                    onClick={handleSubmitToOperations}
                    className="flex-1 py-5 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    <Send className="w-4 h-4" /> Submeter para Operações
                  </button>
                  <button 
                    onClick={() => alert('A imprimir guia de marcha e protocolo de triagem...')}
                    className="flex-1 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    <Printer className="w-4 h-4" /> Imprimir Guia
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProtocolAssistant;
