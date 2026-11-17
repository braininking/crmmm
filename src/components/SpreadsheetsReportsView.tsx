import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  Download,
  FileSpreadsheet,
  FileBarChart2,
  Printer,
  CheckCircle2,
} from 'lucide-react';
import {
  FUNNEL_STAGES,
  autoMapSpreadsheetColumns,
  calculateFunnelMetrics,
  formatCurrencyBRL,
  getStageLabel,
  parseMappedRowsToLeads,
  type SpreadsheetFieldKey,
} from '../utils/crmLogic';
import type { CrmState, ReportSchedule } from '../types/crm';

interface SpreadsheetsReportsViewProps {
  state: CrmState;
  onImportLeads: (payload: {
    leads: ReturnType<typeof parseMappedRowsToLeads>['validLeads'];
    newTagNames: string[];
    triggerFlow: boolean;
  }) => Promise<{ importedCount: number }>;
  onGenerateReport: (periodLabel: string, title?: string) => Promise<void>;
  onSaveReportSchedule: (schedule: ReportSchedule) => Promise<void>;
}

const FIELD_LABELS: { key: SpreadsheetFieldKey; label: string }[] = [
  { key: 'name', label: 'Nome do Contato *' },
  { key: 'company', label: 'Empresa' },
  { key: 'phone', label: 'WhatsApp / Telefone *' },
  { key: 'email', label: 'E-mail' },
  { key: 'value', label: 'Valor Estimado (R$)' },
  { key: 'stage', label: 'Etapa do Funil' },
  { key: 'tag', label: 'Etiquetas' },
];

export function SpreadsheetsReportsView({
  state,
  onImportLeads,
  onGenerateReport,
  onSaveReportSchedule,
}: SpreadsheetsReportsViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<SpreadsheetFieldKey, string>>>({});
  const [triggerFlow, setTriggerFlow] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string>('');
  const [importError, setImportError] = useState<string>('');

  const [periodLabel, setPeriodLabel] = useState('Últimos 30 dias');
  const [reportTitle, setReportTitle] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [schedule, setSchedule] = useState<ReportSchedule>(state.reportSchedule);
  const [scheduleSavedMsg, setScheduleSavedMsg] = useState('');

  const existingPhones = new Set(state.leads.map((l) => l.phone).filter(Boolean));
  const parsedPreview =
    rawRows.length > 0
      ? parseMappedRowsToLeads(rawRows, mapping, existingPhones, state.tags)
      : null;

  const metrics = calculateFunnelMetrics(state.leads, state.interactions);

  async function handleFileSelect(file: File) {
    setImportError('');
    setImportFeedback('');
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
        defval: '',
      });
      if (rows.length === 0) {
        setImportError('A planilha selecionada está vazia.');
        return;
      }
      const detectedHeaders = Object.keys(rows[0]);
      setFileName(file.name);
      setHeaders(detectedHeaders);
      setRawRows(rows);
      setMapping(autoMapSpreadsheetColumns(detectedHeaders));
    } catch {
      setImportError('Não foi possível ler o arquivo. Envie um arquivo .xlsx ou .csv válido.');
    }
  }

  function loadSampleSpreadsheet() {
    setImportError('');
    setImportFeedback('');
    const sampleRows: Record<string, unknown>[] = [
      {
        Nome: 'Carla Vasques',
        Empresa: 'Vasques Engenharia',
        WhatsApp: '(11) 99123-7788',
        Email: 'carla@vasqueseng.com.br',
        Valor: 'R$ 36.000,00',
        Etapa: 'Qualificado',
        Etiqueta: 'VIP Enterprise',
      },
      {
        Nome: 'Henrique Tavares',
        Empresa: 'Tavares Distribuição',
        WhatsApp: '(21) 98444-5522',
        Email: 'henrique@tavaresdist.com.br',
        Valor: 'R$ 18.500,00',
        Etapa: 'Prospecção',
        Etiqueta: 'Prospecção Planilha',
      },
      {
        Nome: 'Patrícia Lemos',
        Empresa: 'Studio Lemos Arquitetura',
        WhatsApp: '(31) 99777-3311',
        Email: 'patricia@studiolemos.arq.br',
        Valor: 'R$ 22.000,00',
        Etapa: 'Proposta',
        Etiqueta: 'Inbound Site',
      },
    ];
    const detectedHeaders = Object.keys(sampleRows[0]);
    setFileName('prospeccao_b2b_exemplo.xlsx');
    setHeaders(detectedHeaders);
    setRawRows(sampleRows);
    setMapping(autoMapSpreadsheetColumns(detectedHeaders));
  }

  function downloadTemplateXlsx() {
    const templateRows = [
      {
        Nome: 'Exemplo Contato',
        Empresa: 'Empresa Modelo Ltda',
        WhatsApp: '(11) 99999-0000',
        Email: 'contato@empresamodelo.com.br',
        Valor: 25000,
        Etapa: 'Prospecção',
        Etiqueta: 'Inbound Site',
      },
    ];
    const ws = XLSX.utils.json_to_sheet(templateRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
    XLSX.writeFile(wb, 'modelo_importacao_vertice_crm.xlsx');
  }

  function exportLeadsSpreadsheet(format: 'xlsx' | 'csv') {
    const exportRows = state.leads.map((l) => {
      const leadTags = state.tags
        .filter((t) => l.tagIds.includes(t.id))
        .map((t) => t.name)
        .join(', ');
      return {
        Nome: l.name,
        Empresa: l.company,
        WhatsApp: l.phone,
        Email: l.email,
        Etapa: getStageLabel(l.stage),
        Valor_BRL: l.value,
        Etiquetas: leadTags,
        Origem: l.source,
        Responsavel: l.owner,
        Criado_em: new Date(l.createdAt).toLocaleDateString('pt-BR'),
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pipeline_CRM');
    const filename = `vertice_crm_pipeline_${new Date().toISOString().slice(0, 10)}.${format}`;
    XLSX.writeFile(wb, filename, { bookType: format });
  }

  async function handleConfirmImport() {
    if (!parsedPreview || parsedPreview.validLeads.length === 0) return;
    setImporting(true);
    setImportError('');
    try {
      const res = await onImportLeads({
        leads: parsedPreview.validLeads,
        newTagNames: parsedPreview.discoveredTagNames,
        triggerFlow,
      });
      setImportFeedback(
        `${res.importedCount} contatos extraídos e importados para o funil com sucesso.`,
      );
      setRawRows([]);
      setHeaders([]);
      setFileName('');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Falha na importação.');
    } finally {
      setImporting(false);
    }
  }

  async function handleGenerateReportClick() {
    setGeneratingReport(true);
    try {
      await onGenerateReport(periodLabel, reportTitle.trim() || undefined);
      setReportTitle('');
    } finally {
      setGeneratingReport(false);
    }
  }

  async function handleSaveSchedule() {
    await onSaveReportSchedule(schedule);
    setScheduleSavedMsg('Regra de relatório automático salva.');
    setTimeout(() => setScheduleSavedMsg(''), 3000);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Extração de Planilhas e Relatórios Automáticos
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Importe contatos de arquivos XLSX/CSV com deduplicação e gere relatórios executivos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => exportLeadsSpreadsheet('xlsx')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 text-teal-700" />
            <span>Exportar XLSX</span>
          </button>
          <button
            type="button"
            onClick={() => exportLeadsSpreadsheet('csv')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir PDF</span>
          </button>
        </div>
      </div>

      {/* Section 1: Spreadsheet Extractor */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-teal-700" />
              <span>Extrator Inteligente de Planilhas (.xlsx e .csv)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Envie sua planilha de prospecção para mapear colunas, normalizar DDI +55 e evitar contatos duplicados.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={downloadTemplateXlsx}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
            >
              Baixar modelo XLSX
            </button>
            <button
              type="button"
              onClick={loadSampleSpreadsheet}
              className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800"
            >
              Carregar Planilha Exemplo
            </button>
          </div>
        </div>

        {importFeedback && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>{importFeedback}</span>
          </div>
        )}

        {importError && (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-900"
          >
            {importError}
          </div>
        )}

        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center bg-slate-50/50">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            aria-label="Selecionar arquivo de planilha XLSX ou CSV"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            className="sr-only"
          />
          <Upload className="h-7 w-7 text-slate-400 mx-auto" />
          <p className="text-sm font-medium text-slate-800 mt-2">
            {fileName
              ? `Arquivo carregado: ${fileName} (${rawRows.length} linhas)`
              : 'Selecione uma planilha .xlsx ou .csv para extrair leads'}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md"
          >
            Selecionar Arquivo
          </button>
        </div>

        {/* Column Mapping & Preview */}
        {headers.length > 0 && parsedPreview && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {FIELD_LABELS.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {field.label}
                  </label>
                  <select
                    value={mapping[field.key] ?? ''}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field.key]: e.target.value || undefined,
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                  >
                    <option value="">Ignorar coluna</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-slate-700 tabular-nums">
                <span>
                  Válidos para importar:{' '}
                  <strong className="text-emerald-700">
                    {parsedPreview.validLeads.length}
                  </strong>
                </span>
                <span>
                  Duplicados ignorados:{' '}
                  <strong>{parsedPreview.skippedDuplicates}</strong>
                </span>
                <span>
                  Linhas inválidas: <strong>{parsedPreview.invalidCount}</strong>
                </span>
                {parsedPreview.discoveredTagNames.length > 0 && (
                  <span>
                    Novas etiquetas:{' '}
                    <strong>{parsedPreview.discoveredTagNames.join(', ')}</strong>
                  </span>
                )}
              </div>

              <label className="flex items-center gap-2 text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={triggerFlow}
                  onChange={(e) => setTriggerFlow(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
                <span>Executar fluxo de aquecimento WhatsApp após importar</span>
              </label>
            </div>

            {parsedPreview.validLeads.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded-md">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="py-2 px-3">Nome</th>
                      <th className="py-2 px-3">Empresa</th>
                      <th className="py-2 px-3">WhatsApp Normalizado</th>
                      <th className="py-2 px-3">Etapa</th>
                      <th className="py-2 px-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedPreview.validLeads.slice(0, 6).map((row, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {row.name}
                        </td>
                        <td className="py-2 px-3 text-slate-600">{row.company}</td>
                        <td className="py-2 px-3 font-mono tabular-nums text-slate-700">
                          {row.phone || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-700">
                          {getStageLabel(row.stage || 'prospeccao')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">
                          {formatCurrencyBRL(row.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={importing || parsedPreview.validLeads.length === 0}
                onClick={handleConfirmImport}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-sm font-medium rounded-md"
              >
                {importing
                  ? 'Importando...'
                  : `Importar ${parsedPreview.validLeads.length} Contatos Extraídos`}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Automated Performance Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
                <FileBarChart2 className="h-4 w-4 text-teal-700" />
                <span>Relatórios Automáticos de Desempenho</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Consolidação em tempo real de conversão, funil e canais de prospecção.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 rounded-md p-4">
            <div>
              <p className="text-[11px] text-slate-500">Total de Contatos</p>
              <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {metrics.totalLeads}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Pipeline Ativo</p>
              <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {formatCurrencyBRL(metrics.activePipelineValue)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Receita Fechada</p>
              <p className="font-mono text-lg font-semibold text-emerald-700 tabular-nums">
                {formatCurrencyBRL(metrics.wonValue)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Conversão Geral</p>
              <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {metrics.conversionRate}%
              </p>
            </div>
          </div>

          {/* Stage summary table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4">Etapa do Funil</th>
                  <th className="py-2 px-3 text-right">Qtd. Leads</th>
                  <th className="py-2 px-3 text-right">Participação</th>
                  <th className="py-2 pl-3 text-right">Volume Financeiro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {FUNNEL_STAGES.map((stage) => {
                  const row = metrics.byStage.find((b) => b.stage.id === stage.id);
                  return (
                    <tr key={stage.id}>
                      <td className="py-2.5 pr-4 font-medium text-slate-900">
                        {stage.label}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {row?.count ?? 0}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                        {row?.percentageOfLeads ?? 0}%
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-900 font-medium">
                        {formatCurrencyBRL(row?.totalValue ?? 0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 no-print">
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Título personalizado (opcional)"
              className="flex-1 min-w-[180px] rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
            <select
              aria-label="Período do relatório"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
            >
              <option value="Últimos 7 dias">Últimos 7 dias</option>
              <option value="Últimos 30 dias">Últimos 30 dias</option>
              <option value="Trimestre Atual">Trimestre Atual</option>
            </select>
            <button
              type="button"
              disabled={generatingReport}
              onClick={handleGenerateReportClick}
              className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium rounded-md whitespace-nowrap"
            >
              {generatingReport ? 'Gerando...' : 'Gerar Relatório Agora'}
            </button>
          </div>

          {/* Archive of Generated Reports */}
          <div className="pt-3 space-y-2">
            <h3 className="text-xs font-semibold text-slate-700">
              Histórico de Relatórios Gerados ({state.reports.length})
            </h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
              {state.reports.map((rep) => (
                <div
                  key={rep.id}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <p className="font-medium text-slate-900">{rep.title}</p>
                    <p className="text-slate-500 mt-0.5">
                      {rep.periodLabel} · {rep.scheduleRule} ·{' '}
                      {new Date(rep.generatedAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <p className="text-emerald-700 font-medium">
                      Fechado: {formatCurrencyBRL(rep.wonValue)}
                    </p>
                    <p className="text-slate-500">
                      Conversão: {rep.conversionRate}% · WPP: {rep.whatsappSent}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Automated Schedule Configuration */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-4 h-fit no-print">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Agendamento Automático
          </h2>
          <p className="text-xs text-slate-500">
            Receba consolidados automáticos do funil e disparos diretamente na diretoria.
          </p>

          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={schedule.enabled}
                onChange={(e) =>
                  setSchedule((prev) => ({ ...prev, enabled: e.target.checked }))
                }
                className="h-4 w-4 rounded border-slate-300 text-teal-700"
              />
              <span className="text-xs font-medium text-slate-800">
                Ativar envio automático periódico
              </span>
            </label>

            <div>
              <label
                htmlFor="report-freq"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Frequência
              </label>
              <select
                id="report-freq"
                value={schedule.frequency}
                onChange={(e) =>
                  setSchedule((prev) => ({
                    ...prev,
                    frequency: e.target.value as ReportSchedule['frequency'],
                  }))
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                <option value="diario">Diário (18:00)</option>
                <option value="semanal">Semanal (Segundas às 08:00)</option>
                <option value="mensal">Mensal (1º dia útil)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="report-channel"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Canal de Entrega
              </label>
              <select
                id="report-channel"
                value={schedule.channel}
                onChange={(e) =>
                  setSchedule((prev) => ({
                    ...prev,
                    channel: e.target.value as ReportSchedule['channel'],
                  }))
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                <option value="whatsapp_e_email">WhatsApp Web + E-mail</option>
                <option value="email">Somente E-mail</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="report-recipient"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                E-mail de Destino
              </label>
              <input
                id="report-recipient"
                type="email"
                value={schedule.recipientEmail}
                onChange={(e) =>
                  setSchedule((prev) => ({
                    ...prev,
                    recipientEmail: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            {scheduleSavedMsg && (
              <p role="status" className="text-xs text-emerald-700 font-medium">
                {scheduleSavedMsg}
              </p>
            )}

            <button
              type="button"
              onClick={handleSaveSchedule}
              className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md"
            >
              Salvar Agendamento
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
