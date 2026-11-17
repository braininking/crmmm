import { Menu, Plus } from 'lucide-react';
import type { NavSection } from '../types/crm';

interface HeaderProps {
  activeSection: NavSection;
  onOpenMobileMenu: () => void;
  onOpenNewLead: () => void;
  totalLeads: number;
}

const SECTION_BREADCRUMBS: Record<NavSection, string> = {
  dashboard: 'Visão Geral / Dashboard em Tempo Real',
  funil: 'Comercial / Funil de Vendas e Contatos',
  planilhas: 'Operações / Planilhas e Relatórios Automáticos',
  whatsapp: 'Canais / Conexão WhatsApp Web e Disparos',
  automacoes: 'Engenharia / Automações Multicanal, API e E-mail',
};

export function Header({
  activeSection,
  onOpenMobileMenu,
  onOpenNewLead,
  totalLeads,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu de navegação"
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-md"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">
            {SECTION_BREADCRUMBS[activeSection]}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <span className="hidden sm:inline text-xs text-slate-500 tabular-nums whitespace-nowrap">
          {totalLeads} contatos ativos
        </span>
        <button
          type="button"
          onClick={onOpenNewLead}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Novo Contato</span>
        </button>
      </div>
    </header>
  );
}
