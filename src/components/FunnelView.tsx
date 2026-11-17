import { useState, type FormEvent } from 'react';
import {
  Search,
  Tag,
  MessageSquare,
  Kanban,
  Table as TableIcon,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  FUNNEL_STAGES,
  filterLeads,
  formatCurrencyBRL,
  formatPhoneDisplay,
  getStageLabel,
} from '../utils/crmLogic';
import { TagBadge } from './TagBadge';
import type { FunnelStageId, Lead, LeadTag } from '../types/crm';

interface FunnelViewProps {
  leads: Lead[];
  tags: LeadTag[];
  onSelectLead: (lead: Lead) => void;
  onMoveStage: (leadId: string, stage: FunnelStageId) => Promise<void>;
  onCreateTag: (name: string, color: LeadTag['color']) => Promise<void>;
  onDeleteTag: (tagId: string) => Promise<void>;
}

const TAG_COLOR_OPTIONS: { value: LeadTag['color']; label: string }[] = [
  { value: 'teal', label: 'Verde Petróleo' },
  { value: 'emerald', label: 'Esmeralda' },
  { value: 'indigo', label: 'Azul Cobalto' },
  { value: 'amber', label: 'Âmbar' },
  { value: 'rose', label: 'Carmesim' },
];

export function FunnelView({
  leads,
  tags,
  onSelectLead,
  onMoveStage,
  onCreateTag,
  onDeleteTag,
}: FunnelViewProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'tabela'>('kanban');
  const [query, setQuery] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string>('all');
  const [selectedStage, setSelectedStage] = useState<FunnelStageId | 'all'>('all');
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState<LeadTag['color']>('teal');
  const [tagError, setTagError] = useState('');

  const filteredLeads = filterLeads(leads, {
    query,
    tagId: selectedTagId,
    stage: selectedStage,
  });

  async function handleCreateTagSubmit(e: FormEvent) {
    e.preventDefault();
    setTagError('');
    if (!newTagName.trim()) {
      setTagError('Informe o nome da etiqueta.');
      return;
    }
    try {
      await onCreateTag(newTagName.trim(), newTagColor);
      setNewTagName('');
    } catch (err) {
      setTagError(err instanceof Error ? err.message : 'Erro ao criar etiqueta.');
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Funil de Vendas e Contatos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Arraste oportunidades entre etapas, gerencie etiquetas e abra o histórico completo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
                viewMode === 'kanban'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="h-3.5 w-3.5" />
              <span>Funil Kanban</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tabela')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm transition-colors whitespace-nowrap ${
                viewMode === 'tabela'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Visão Planilha</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setTagModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Tag className="h-3.5 w-3.5 text-teal-700" />
            <span>Etiquetas ({tags.length})</span>
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Buscar contatos por nome, empresa, telefone ou e-mail"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, empresa, WhatsApp ou e-mail..."
            className="w-full rounded-md border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
          />
        </div>

        <select
          aria-label="Filtrar por etiqueta"
          value={selectedTagId}
          onChange={(e) => setSelectedTagId(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-700 focus:outline-none"
        >
          <option value="all">Todas as etiquetas</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              Etiqueta: {t.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filtrar por etapa do funil"
          value={selectedStage}
          onChange={(e) => setSelectedStage(e.target.value as FunnelStageId | 'all')}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-700 focus:outline-none"
        >
          <option value="all">Todas as etapas</option>
          {FUNNEL_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Kanban Board */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
          {FUNNEL_STAGES.map((stage) => {
            const stageLeads = filteredLeads.filter((l) => l.stage === stage.id);
            const stageTotal = stageLeads.reduce((sum, l) => sum + l.value, 0);

            return (
              <section
                key={stage.id}
                aria-label={`Etapa ${stage.label}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async () => {
                  if (draggedLeadId) {
                    await onMoveStage(draggedLeadId, stage.id);
                    setDraggedLeadId(null);
                  }
                }}
                className="bg-slate-100/80 border border-slate-200 rounded-lg p-3 min-h-[420px] flex flex-col gap-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div>
                    <h2 className="font-display text-xs font-semibold text-slate-900">
                      {stage.label}
                    </h2>
                    <p className="font-mono text-[11px] text-slate-500 tabular-nums mt-0.5">
                      {stageLeads.length} · {formatCurrencyBRL(stageTotal)}
                    </p>
                  </div>
                  <span
                    className="h-2.5 w-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: stage.accentHex }}
                    aria-hidden="true"
                  />
                </div>

                <div className="space-y-2.5">
                  {stageLeads.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">
                      Sem contatos nesta etapa
                    </p>
                  ) : (
                    stageLeads.map((lead) => {
                      const leadTags = tags.filter((t) =>
                        lead.tagIds.includes(t.id),
                      );
                      return (
                        <article
                          key={lead.id}
                          draggable
                          onDragStart={() => setDraggedLeadId(lead.id)}
                          className="bg-white border border-slate-200 rounded-md p-3.5 space-y-2.5 hover:border-teal-600 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => onSelectLead(lead)}
                              className="text-sm font-semibold text-slate-900 hover:text-teal-800 text-left leading-snug"
                            >
                              {lead.name}
                            </button>
                          </div>

                          <p className="text-xs text-slate-500 truncate">
                            {lead.company} ·{' '}
                            <span className="font-mono tabular-nums text-slate-700 font-medium">
                              {formatCurrencyBRL(lead.value)}
                            </span>
                          </p>

                          {leadTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {leadTags.map((t) => (
                                <TagBadge key={t.id} tag={t} />
                              ))}
                            </div>
                          )}

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                            <select
                              aria-label={`Mover etapa de ${lead.name}`}
                              value={lead.stage}
                              onChange={(e) =>
                                onMoveStage(
                                  lead.id,
                                  e.target.value as FunnelStageId,
                                )
                              }
                              className="min-w-0 flex-1 text-[11px] rounded-sm border border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-700 focus:border-teal-700 focus:outline-none truncate"
                            >
                              {FUNNEL_STAGES.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => onSelectLead(lead)}
                              aria-label={`Abrir histórico e WhatsApp de ${lead.name}`}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-800 hover:underline whitespace-nowrap shrink-0"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>Histórico</span>
                            </button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        /* Spreadsheet / Table View */
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="py-3 px-4">Contato</th>
                  <th className="py-3 px-4">Empresa</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4">Etapa</th>
                  <th className="py-3 px-4">Etiquetas</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      Nenhum contato encontrado para os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const leadTags = tags.filter((t) =>
                      lead.tagIds.includes(t.id),
                    );
                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          <button
                            type="button"
                            onClick={() => onSelectLead(lead)}
                            className="hover:text-teal-800 hover:underline text-left"
                          >
                            {lead.name}
                          </button>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {lead.company}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs tabular-nums text-slate-600">
                          {formatPhoneDisplay(lead.phone)}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-slate-700">
                          {getStageLabel(lead.stage)}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {leadTags.map((t) => (
                              <TagBadge key={t.id} tag={t} />
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-xs font-medium tabular-nums text-slate-900">
                          {formatCurrencyBRL(lead.value)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => onSelectLead(lead)}
                            className="text-xs font-medium text-teal-800 hover:underline"
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Custom Tags Manager Modal */}
      {tagModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tag-manager-title"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2
                id="tag-manager-title"
                className="font-display text-base font-semibold text-slate-900"
              >
                Gerenciar Etiquetas de Leads
              </h2>
              <button
                type="button"
                onClick={() => setTagModalOpen(false)}
                aria-label="Fechar gerenciador de etiquetas"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <form onSubmit={handleCreateTagSubmit} className="space-y-3">
                {tagError && (
                  <p role="alert" className="text-xs text-rose-700">
                    {tagError}
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    aria-label="Nome da nova etiqueta"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Ex: Decisor C-Level"
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
                  />
                  <select
                    aria-label="Cor da nova etiqueta"
                    value={newTagColor}
                    onChange={(e) =>
                      setNewTagColor(e.target.value as LeadTag['color'])
                    }
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800"
                  >
                    {TAG_COLOR_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-md"
                >
                  <Plus className="h-4 w-4" />
                  <span>Criar Etiqueta</span>
                </button>
              </form>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-md max-h-60 overflow-y-auto">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between px-3.5 py-2.5"
                  >
                    <TagBadge tag={tag} />
                    <button
                      type="button"
                      onClick={() => onDeleteTag(tag.id)}
                      aria-label={`Excluir etiqueta ${tag.name}`}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
