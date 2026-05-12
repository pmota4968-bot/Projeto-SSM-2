
import React, { useState } from 'react';
import { Sparkles, Loader2, FileText, CheckCircle2, Shield, Printer, ArrowRight, ArrowLeft, AlertCircle, Info, ClipboardList, Stethoscope, Building2, Send, ShieldCheck } from 'lucide-react';
import { getProtocolAdvice } from '../services/geminiService';
import { ProtocolSuggestion, EmergencyPriority, EmergencyCase, AdminUser, Company } from '../types';
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
        // Fallback for all no
        handleNextFlow(); 
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
        <h2 className="text-3xl font-black text-slate-900 tracking-tight font-corporate uppercase">Protocolo de <span className="text-blue-600">Triagem SSM</span></h2>
        
        {mode === 'AI_ANALYSIS' ? (
           <div className="space-y-4">
            <textarea className="w-full h-48 p-6 border border-slate-200 rounded-3xl" placeholder="Descrição da ocorrência..." value={scenario} onChange={(e) => setScenario(e.target.value)} />
            <button onClick={handleAnalyze} className="w-full bg-slate-950 text-white py-4 rounded-2xl">{loading ? 'Processando...' : 'Gerar Parecer'}</button>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto w-full">
            {currentStep < 5 ? (
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
              /* RESULT VIEW FOR STRUCTURED FLOW */
              <div className="max-w-3xl mx-auto bg-slate-50 border border-slate-200 rounded-[3rem] p-12 shadow-xl animate-in zoom-in-95">
                <div className="text-center mb-10">
                  <div className={`w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center shadow-2xl mb-6 ${PRIORITY_COLORS[suggestion!.classification]}`}>
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
                    <div className="col-span-2 pt-4 border-t border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Localização de Evacuação</p>
                      <p className="text-sm font-black text-slate-900">{triageData.location || 'Não Informada'}</p>
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

                  <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
                    <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest leading-relaxed">
                      "Nunca baixar prioridade após subida". Manter observação contínua até chegada do meio.
                    </p>
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
