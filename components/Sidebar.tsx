
import React from 'react';
import { LayoutDashboard, ClipboardList, Siren, Users, Settings, LogOut, Truck, Building2, UserCircle, ShieldAlert, UserPlus, X } from 'lucide-react';
import SSMLogo from './SSMLogo';
import { UserRole } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userRole, onLogout, isOpen, onClose }) => {
  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'COMANDO DIGITAL', roles: ['ADMIN_SSM', 'OPERADOR_COORD', 'GESTOR_RISCO'] },
    { id: 'protocols', icon: ClipboardList, label: 'TRIAGEM SSM', roles: ['ADMIN_SSM', 'OPERADOR_COORD'] },
    // Item específico para clientes corporativos
    { id: 'corporate_sos', icon: ShieldAlert, label: 'EMERGÊNCIA', roles: ['ADMIN_CLIENTE', 'RESPONSAVEL_EMERG_CLIENTE', 'COLABORADOR_RH'] },
    { id: 'employee_registration', icon: UserPlus, label: 'CADASTRO', roles: ['ADMIN_CLIENTE', 'COLABORADOR_RH'] },
    { id: 'patients', icon: UserCircle, label: 'BASE MÉDICA', roles: ['ADMIN_CLIENTE'] },
    { id: 'companies', icon: Building2, label: 'CLIENTES', roles: ['ADMIN_SSM', 'GESTOR_RISCO'] },
    { id: 'ambulance_providers', icon: Truck, label: 'PROVEDORES AMB', roles: ['ADMIN_SSM'] },
    { id: 'my_fleet', icon: LayoutDashboard, label: 'A MINHA FROTA', roles: ['GESTOR_FROTA_AMB'] },
    { id: 'map', icon: Siren, label: 'EMERGÊNCIA', roles: ['ADMIN_SSM', 'OPERADOR_COORD'] },
    { id: 'providers', icon: Users, label: 'GESTÃO SSM', roles: ['ADMIN_SSM', 'GESTOR_RISCO'] },
  ].filter(item => item.roles.includes(userRole));

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 z-[70] h-screen bg-[#080a0f] text-slate-400 flex flex-col border-r border-slate-800/50 shrink-0 transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 w-80' : '-translate-x-full lg:translate-x-0 w-72'}
      `}>
        <div className="p-10 pb-8 relative">
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white lg:hidden transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3 mb-10 group cursor-default px-1">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"></div>
              <SSMLogo className="w-8 h-8 shrink-0 relative z-10 transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black text-white tracking-[0.25em] font-display leading-none">SSM</span>
              <span className="text-[7px] font-bold text-blue-500 tracking-[0.4em] uppercase mt-1.5 opacity-80 font-display">Command Center</span>
            </div>
          </div>

          <div className="flex gap-4 items-center px-1 py-4 border-y border-white/5 bg-white/[0.02] rounded-2xl">
            <div className="w-0.5 h-8 bg-gradient-to-b from-blue-500 to-transparent self-stretch rounded-full" />
            <div className="flex flex-col justify-center">
              <span className="text-[8px] font-medium text-slate-500 tracking-[0.3em] leading-tight uppercase font-display">
                Safety & Security
              </span>
              <span className="text-sm font-extrabold text-white tracking-widest leading-none mt-1 font-display">
                MEDICAL
              </span>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold text-[13px] tracking-wide transition-all duration-200 group ${activeTab === item.id ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              <item.icon className={`w-5 h-5 transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`} /> 
              <span className="font-display uppercase tracking-widest">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm text-red-400 hover:bg-red-50/10 transition-all"><LogOut className="w-5 h-5" /> Sair da Rede</button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
