import { useState } from 'react';
import {
  SlidersHorizontal,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Minimize2,
  RefreshCw,
  FileBarChart2,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  calculateFunnelMetrics,
  calculateMonthlyRevenueSeries,
  formatCurrencyBRL,
  getStageLabel,
} from '../utils/crmLogic';
import type {
  CrmState,
  DashboardWidgetConfig,
  Lead,
  NavSection,
} from '../types/crm';

interface DashboardViewProps {
  state: CrmState;
  liveSyncEnabled: boolean;
  onToggleLiveSync: () => void;
  onRefreshNow: () => Promise<void>;
  onSaveWidgets: (widgets: DashboardWidgetConfig[]) => Promise<void>;
  onGenerateReport: () => Promise<void>;
  onSelectLead: (lead: Lead) => void;
  onNavigate: (section: NavSection) => void;
}

export function DashboardView({
  state,
  liveSyncEnabled,
  onToggleLiveSync,
  onRefreshNow,
  onSaveWidgets,
  onGenerateReport,
  onSelectLead,
  onNavigate,
}: DashboardViewProps) {
  const [customizing, setCustomizing] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const metrics = calculateFunnelMetrics(state.leads, state.interactions);
  const revenueSeries = calculateMonthlyRevenueSeries(state.leads);
  const maxRevenueValue = Math.max(
    ...revenueSeries.map((p) => Math.max(p.forecastValue, p.closedValue)),
    1,
  );

  const sortedWidgets = [...state.dashboardWidgets].sort(
    (a, b) => a.order - b.order,
  );

  const pendingFollowUps = state.leads
    .filter(
      (l) => l.stage !== 'fechado' && l.stage !== 'perdido' && l.nextFollowUpAt,
    )
    .sort(
      (a, b) =>
        new Date(a.nextFollowUpAt!).getTime() -
        new Date(b.nextFollowUpAt!).getTime(),
    )
    .slice(0, 5);

  async function toggleWidgetVisibility(id: DashboardWidgetConfig['id']) {
    const updated = sortedWidgets.map((w) =>
      w.id === id ? { ...w, visible: !w.visible } : w,
    );
    await onSaveWidgets(updated);
  }

  async function toggleWidgetSpan(id: DashboardWidgetConfig['id']) {
    const updated = sortedWidgets.map((w) =>
      w.id === id ? { ...w, span: (w.span === 2 ? 1 : 2) as 1 | 2 } : w,
    );
    await onSaveWidgets(updated);
  }

  async function moveWidget(index: number, direction: -1 | 1) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= sortedWidgets.length) return;
    const copy = [...sortedWidgets];
    const [removed] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, removed);
    const reordered = copy.map((w, idx) => ({ ...w, order: idx + 1 }));
    await onSaveWidgets(reordered);
  }

  async function handleQuickReport() {
    setGeneratingReport(true);
    try {
      await onGenerateReport();
    } finally {
      setGeneratingReport(false);
    }
  }

  function renderWidgetContent(widget: DashboardWidgetConfig) {
    switch (widget.id) {
      case 'funnel_conversion':
        return (
          <div className="space-y-3">
            {metrics.byStage.map((item) => {
              const barPct = Math.max(item.percentageOfLeads, 6);
              return (
                <div key={item.stage.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">
                      {item.stage.label}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {item.count === 1 ? '1 lead' : `${item.count} leads`} ·{' '}
                      {formatCurrencyBRL(item.totalValue)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-sm bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all duration-300"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: item.stage.accentHex,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => onNavigate('funil')}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:underline"
              >
                <span>Abrir quadro do funil</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );

      case 'revenue_trend':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-xs bg-slate-300" />
                  Previsão
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-xs bg-teal-700" />
                  Fechado
                </span>
              </div>
              {hoveredMonth && (
                <span className="font-mono tabular-nums text-slate-800 font-medium">
                  {hoveredMonth}
                </span>
              )}
            </div>

            <div className="grid grid-cols-6 gap-3 items-end h-44 pt-4 border-b border-slate-200 pb-2">
              {revenueSeries.map((pt) => {
                const fHeight = Math.round((pt.forecastValue / maxRevenueValue) * 100);
                const cHeight = Math.round((pt.closedValue / maxRevenueValue) * 100);
                return (
                  <div
                    key={pt.monthLabel}
                    onMouseEnter={() =>
                      setHoveredMonth(
                        `${pt.monthLabel}: Prev. ${formatCurrencyBRL(pt.forecastValue)} · Fech. ${formatCurrencyBRL(pt.closedValue)}`,
                      )
                    }
                    onMouseLeave={() => setHoveredMonth(null)}
                    className="flex flex-col items-center gap-1.5 h-full justify-end cursor-default"
                  >
                    <div className="flex items-end gap-1 h-full w-full justify-center">
                      <div
                        className="w-3 sm:w-4 bg-slate-200 rounded-t-xs transition-all"
                        style={{ height: `${Math.max(fHeight, 8)}%` }}
                        title={`Previsão ${pt.monthLabel}: ${formatCurrencyBRL(pt.forecastValue)}`}
                      />
                      <div
                        className="w-3 sm:w-4 bg-teal-700 rounded-t-xs transition-all"
                        style={{ height: `${Math.max(cHeight, 6)}%` }}
                        title={`Fechado ${pt.monthLabel}: ${formatCurrencyBRL(pt.closedValue)}`}
                      />
                    </div>
                    <span className="text-[11px] font-medium text-slate-600">
                      {pt.monthLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'multichannel_performance': {
        const wppReplyRate =
          state.whatsapp.totalSent > 0
            ? Math.round((state.whatsapp.totalReplied / state.whatsapp.totalSent) * 100)
            : 0;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-md">
                <p className="text-xs text-slate-500">WhatsApp Web (Disparos)</p>
                <p className="font-mono text-xl font-semibold text-slate-900 tabular-nums mt-1">
                  {state.whatsapp.totalSent}
                </p>
                <p className="text-xs text-emerald-700 mt-1 tabular-nums">
                  {wppReplyRate}% taxa de resposta ({state.whatsapp.totalReplied})
                </p>
              </div>
              <div className="p-3 bg-slate-50 rounded-md">
                <p className="text-xs text-slate-500">
                  E-mail ({state.emailMarketing.provider})
                </p>
                <p className="font-mono text-xl font-semibold text-slate-900 tabular-nums mt-1">
                  {state.emailMarketing.openRate}%
                </p>
                <p className="text-xs text-slate-600 mt-1 tabular-nums">
                  Cliques: {state.emailMarketing.clickRate}% · {state.emailMarketing.syncedContactsCount} sincronizados
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500">
                Fluxos ativos:{' '}
                <strong className="text-slate-800 tabular-nums">
                  {state.workflows.filter((w) => w.active).length}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => onNavigate('whatsapp')}
                className="font-medium text-teal-800 hover:underline"
              >
                Abrir Central WhatsApp Web
              </button>
            </div>
          </div>
        );
      }

      case 'pending_followups':
        return (
          <div className="space-y-2">
            {pendingFollowUps.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">
                Todos os follow-ups estão em dia.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pendingFollowUps.map((lead) => (
                  <li key={lead.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectLead(lead)}
                        className="text-sm font-medium text-slate-900 hover:text-teal-800 truncate block text-left"
                      >
                        {lead.name}
                      </button>
                      <p className="text-xs text-slate-500 truncate">
                        {lead.company} · {getStageLabel(lead.stage)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-xs font-medium text-slate-900 tabular-nums">
                        {formatCurrencyBRL(lead.value)}
                      </p>
                      <p className="font-mono text-[11px] text-amber-700 tabular-nums">
                        {lead.nextFollowUpAt
                          ? new Date(lead.nextFollowUpAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                            })
                          : 'Hoje'}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );

      case 'auto_reports_summary':
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                Agendamento atual:{' '}
                <span className="font-medium text-slate-900">
                  {state.reportSchedule.enabled
                    ? `${state.reportSchedule.frequency} para ${state.reportSchedule.recipientEmail}`
                    : 'Desativado'}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickReport}
                  disabled={generatingReport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-md"
                >
                  <FileBarChart2 className="h-3.5 w-3.5" />
                  <span>
                    {generatingReport ? 'Gerando...' : 'Gerar Relatório Agora'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('planilhas')}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-md"
                >
                  Ver Planilhas e Relatórios
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                    <th className="py-2 pr-4">Relatório</th>
                    <th className="py-2 px-3">Gerado em</th>
                    <th className="py-2 px-3 text-right">Pipeline</th>
                    <th className="py-2 px-3 text-right">Fechado</th>
                    <th className="py-2 pl-3 text-right">Conversão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {state.reports.slice(0, 4).map((rep) => (
                    <tr key={rep.id} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-4 font-medium text-slate-900">
                        {rep.title}
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-500">
                        {new Date(rep.generatedAt).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {formatCurrencyBRL(rep.pipelineValue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium">
                        {formatCurrencyBRL(rep.wonValue)}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-900">
                        {rep.conversionRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Painel de Desempenho Comercial
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Visualização em tempo real do funil, disparos WhatsApp Web e métricas de receita.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleLiveSync}
            className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              liveSyncEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                liveSyncEnabled ? 'bg-emerald-600' : 'bg-slate-400'
              }`}
              aria-hidden="true"
            />
            <span>{liveSyncEnabled ? 'Tempo real ativo' : 'Tempo real pausado'}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshNow}
            aria-label="Atualizar dados do painel"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => setCustomizing((v) => !v)}
            aria-expanded={customizing}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
              customizing
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Personalizar Dashboard</span>
          </button>
        </div>
      </div>

      {/* Customize Panel */}
      {customizing && (
        <section
          aria-label="Personalização de widgets do painel"
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                Configurar Widgets em Tempo Real
              </h2>
              <p className="text-xs text-slate-500">
                Ative, oculte, reordene ou altere a largura dos blocos do seu painel.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCustomizing(false)}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 hover:underline"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Concluir</span>
            </button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
            {sortedWidgets.map((widget, idx) => (
              <div
                key={widget.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={widget.visible}
                    onChange={() => toggleWidgetVisibility(widget.id)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                  />
                  <span className="font-medium text-slate-800">
                    {widget.title}
                  </span>
                </label>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleWidgetSpan(widget.id)}
                    aria-label={`Alternar largura de ${widget.title}`}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 rounded-sm text-slate-600 hover:bg-slate-50"
                  >
                    {widget.span === 2 ? (
                      <>
                        <Minimize2 className="h-3 w-3" />
                        <span>1 coluna</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3 w-3" />
                        <span>2 colunas</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveWidget(idx, -1)}
                    aria-label={`Mover ${widget.title} para cima`}
                    className="p-1.5 border border-slate-200 rounded-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sortedWidgets.length - 1}
                    onClick={() => moveWidget(idx, 1)}
                    aria-label={`Mover ${widget.title} para baixo`}
                    className="p-1.5 border border-slate-200 rounded-sm text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4-column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Pipeline Ativo</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1.5">
            {formatCurrencyBRL(metrics.activePipelineValue)}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {metrics.totalLeads - metrics.wonCount} oportunidades em aberto
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Receita Fechada</p>
          <p className="font-mono text-2xl font-semibold text-emerald-700 tabular-nums mt-1.5">
            {formatCurrencyBRL(metrics.wonValue)}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {metrics.wonCount} negócios ganhos no período
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">Taxa de Conversão</p>
          <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums mt-1.5">
            {metrics.conversionRate}%
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Base total de {metrics.totalLeads} contatos
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <p className="text-xs font-medium text-slate-500">
            Follow-ups Agendados
          </p>
          <p className="font-mono text-2xl font-semibold text-amber-700 tabular-nums mt-1.5">
            {metrics.followUpPendingCount}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {metrics.whatsappEventsCount} interações WhatsApp registradas
          </p>
        </div>
      </div>

      {/* Customizable Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {sortedWidgets
          .filter((w) => w.visible)
          .map((widget) => (
            <section
              key={widget.id}
              data-testid={`widget-${widget.id}`}
              className={`bg-white border border-slate-200 rounded-lg p-5 ${
                widget.span === 2 ? 'lg:col-span-2' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <h2 className="font-display text-sm font-semibold text-slate-900">
                  {widget.title}
                </h2>
              </div>
              {renderWidgetContent(widget)}
            </section>
          ))}
      </div>
    </div>
  );
}
