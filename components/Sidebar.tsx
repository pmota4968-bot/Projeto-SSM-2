
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
    { id: 'fleet', icon: Truck, label: 'GESTÃO DE FROTA', roles: ['ADMIN_SSM', 'GESTOR_FROTA_AMB'] },
    { id: 'companies', icon: Building2, label: 'CLIENTES', roles: ['ADMIN_SSM', 'GESTOR_RISCO'] },
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
        fixed lg:sticky top-0 left-0 z-[70] h-screen bg-slate-950 text-slate-400 flex flex-col border-r border-slate-800 shrink-0 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full lg:translate-x-0 w-64'}
      `}>
        <div className="p-8 pb-4 relative">
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 text-slate-400 hover:text-white lg:hidden"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4 mb-6">
            <SSMLogo className="w-12 h-12 shrink-0" />
            <span className="text-4xl font-black text-white tracking-tighter">SSM</span>
          </div>

          <div className="flex gap-4">
            <div className="w-1 bg-blue-600 self-stretch rounded-full opacity-60" />
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-black text-slate-400 tracking-[0.2em] leading-tight">
                SAFETY & SECURITY
              </span>
              <span className="text-lg font-black text-blue-400 tracking-wider leading-none mt-1">
                MEDICAL
              </span>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'hover:bg-slate-900 hover:text-white'}`}
            >
              <item.icon className="w-5 h-5" /> {item.label}
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
