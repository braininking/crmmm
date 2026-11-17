import { useState } from 'react';
import {
  LayoutDashboard,
  Kanban,
  FileSpreadsheet,
  MessageSquare,
  Workflow,
  X,
} from 'lucide-react';
import type { NavSection } from '../types/crm';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  whatsappConnected: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: {
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'funil', label: 'Funil de Vendas', icon: Kanban },
  { id: 'planilhas', label: 'Planilhas e Relatórios', icon: FileSpreadsheet },
  { id: 'whatsapp', label: 'WhatsApp Web', icon: MessageSquare },
  { id: 'automacoes', label: 'Automações e API', icon: Workflow },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  whatsappConnected,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  const navContent = (
    <div className="flex h-full flex-col justify-between bg-white border-r border-slate-200 px-4 py-5">
      <div>
        <div className="flex items-center justify-between px-2 pb-6 border-b border-slate-100">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Vértice CRM
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar menu lateral"
            className="lg:hidden p-2 text-slate-500 hover:text-slate-900 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Navegação principal" className="mt-5 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-50 text-teal-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-teal-700' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {item.id === 'whatsapp' && (
                  <span
                    className={`text-[11px] font-medium ${
                      whatsappConnected ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {whatsappConnected ? 'Ativo' : 'Parear'}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 py-1.5">
          {avatarFailed ? (
            <div className="h-9 w-9 rounded-md bg-teal-700 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              CR
            </div>
          ) : (
            <img
              src="/src/assets/images/avatar_sales_director_1794878355544.jpg"
              alt="Camila Rocha — Diretora Comercial"
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="h-9 w-9 rounded-md object-cover border border-slate-200 shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 truncate">
              Camila Rocha
            </p>
            <p className="text-xs text-slate-500 truncate">
              Diretoria Comercial
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:w-[248px] lg:shrink-0 lg:sticky lg:top-0 lg:h-screen">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
