
import { Company, Employee, EmergencyPriority, Resource, AdminUser, AmbulanceState, WorkflowStep } from './types';

export const PRIORITY_COLORS: Record<EmergencyPriority, string> = {
  [EmergencyPriority.LOW]: 'bg-emerald-500 text-white',
  [EmergencyPriority.MODERATE]: 'bg-yellow-400 text-slate-900',
  [EmergencyPriority.HIGH]: 'bg-orange-500 text-white',
  [EmergencyPriority.CRITICAL]: 'bg-red-600 text-white',
};

export const ADMINS: (AdminUser & { password?: string })[] = [];

// Fixed: Added missing status and performance properties to AMBULANCES
export const AMBULANCES: AmbulanceState[] = [];

// Fixed: Added missing type, plan, contractEnd, and totalEmployees properties to COMPANIES
export const COMPANIES: Company[] = [];

export const EMPLOYEES: Employee[] = [];

export const RESOURCES: Resource[] = [];

// Added WORKFLOW_STEPS for WorkflowSection component
export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 1,
    title: 'Receção do Alerta',
    description: 'Entrada da ocorrência via botão de pânico corporativo ou chamada direta para a Central de Operações.',
    icon: 'Bell',
    details: ['Validação de Localização', 'Identificação do Solicitante', 'Abertura de Protocolo']
  },
  {
    id: 2,
    title: 'Triagem e Protocolo',
    description: 'Execução do fluxograma de triagem médica para classificação de prioridade e risco clínico.',
    icon: 'ClipboardList',
    details: ['Classificação de Risco (A-D)', 'Seleção de Protocolo Clínico', 'Determinação de Recursos']
  },
  {
    id: 3,
    title: 'Despacho de Unidade',
    description: 'Acionamento da unidade móvel (SAV/SBV) mais próxima através do algoritmo de proximidade.',
    icon: 'Truck',
    details: ['Monitorização de Trânsito', 'Envio de Coordenadas GPS', 'Acompanhamento do ETA']
  },
  {
    id: 4,
    title: 'Intervenção e Transporte',
    description: 'Estabilização do paciente no local e transporte assistido para a unidade hospitalar de referência.',
    icon: 'Activity',
    details: ['Cuidados Pré-hospitalares', 'Comunicação com Hospital', 'Gestão de Sinais Vitais']
  },
  {
    id: 5,
    title: 'Encerramento e Auditoria',
    description: 'Finalização da missão com relatório clínico detalhado e registo em log de auditoria imutável.',
    icon: 'CheckCircle2',
    details: ['Relatório de Ocorrência', 'Feedback do Cliente', 'Arquivo de Auditoria']
  }
];
