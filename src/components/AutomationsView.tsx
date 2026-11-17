import { useState, type FormEvent } from 'react';
import {
  Workflow,
  Play,
  KeyRound,
  Copy,
  RefreshCw,
  Mail,
  Webhook,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import type {
  CrmState,
  EmailMarketingConfig,
  FollowUpFlow,
  WebhookConfig,
} from '../types/crm';

interface AutomationsViewProps {
  state: CrmState;
  onToggleWorkflow: (id: string, active: boolean) => Promise<void>;
  onExecuteWorkflow: (id: string) => Promise<{
    executedLeadsCount: number;
    eventsCreated: number;
  }>;
  onCreateWorkflow: (payload: {
    name: string;
    description: string;
    trigger: FollowUpFlow['trigger'];
    targetTagId?: string;
    steps: FollowUpFlow['steps'];
  }) => Promise<void>;
  onRotateApiKey: () => Promise<void>;
  onTestApiIngest: (payload: {
    name: string;
    company: string;
    phone: string;
    email: string;
    value: number;
    tagName: string;
  }) => Promise<{ leadName: string }>;
  onCreateWebhook: (payload: {
    name: string;
    url: string;
    event: WebhookConfig['event'];
  }) => Promise<void>;
  onDeleteWebhook: (id: string) => Promise<void>;
  onSaveEmailConfig: (config: Partial<EmailMarketingConfig>) => Promise<void>;
  onSyncEmailCampaign: (subject: string) => Promise<{ syncedCount: number }>;
}

const TRIGGER_LABELS: Record<FollowUpFlow['trigger'], string> = {
  lead_created: 'Novo Lead Criado',
  spreadsheet_import: 'Extração de Planilha',
  api_ingest: 'Captura via API REST',
  stage_qualificado: 'Entrada em Qualificado',
};

export function AutomationsView({
  state,
  onToggleWorkflow,
  onExecuteWorkflow,
  onCreateWorkflow,
  onRotateApiKey,
  onTestApiIngest,
  onCreateWebhook,
  onDeleteWebhook,
  onSaveEmailConfig,
  onSyncEmailCampaign,
}: AutomationsViewProps) {
  const [execResult, setExecResult] = useState('');
  const [execError, setExecError] = useState('');

  // New workflow form
  const [newWfName, setNewWfName] = useState('');
  const [newWfTrigger, setNewWfTrigger] =
    useState<FollowUpFlow['trigger']>('lead_created');
  const [newWfTemplateId, setNewWfTemplateId] = useState(
    state.templates[0]?.id ?? '',
  );
  const [newWfEmailSubject, setNewWfEmailSubject] = useState(
    'Proposta personalizada para {{empresa}}',
  );

  // API Tester state
  const [apiName, setApiName] = useState('Rodrigo Alencar');
  const [apiCompany, setApiCompany] = useState('Alencar Transportes');
  const [apiPhone, setApiPhone] = useState('(11) 99555-4433');
  const [apiEmail, setApiEmail] = useState('rodrigo@alencartransportes.com.br');
  const [apiValue, setApiValue] = useState('27500');
  const [apiTag, setApiTag] = useState('Inbound Site');
  const [apiTestResult, setApiTestResult] = useState('');
  const [apiTesting, setApiTesting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhook form
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whEvent, setWhEvent] = useState<WebhookConfig['event']>('lead.created');

  // Email Marketing
  const [emailConfig, setEmailConfig] = useState<EmailMarketingConfig>(
    state.emailMarketing,
  );
  const [campaignSubject, setCampaignSubject] = useState(
    'Solução comercial integrada para sua equipe',
  );
  const [emailSyncStatus, setEmailSyncStatus] = useState('');

  async function handleRunFlow(id: string) {
    setExecResult('');
    setExecError('');
    try {
      const res = await onExecuteWorkflow(id);
      setExecResult(
        `Fluxo executado em ${res.executedLeadsCount} contatos (${res.eventsCreated} ações registradas).`,
      );
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Erro ao executar fluxo.');
    }
  }

  async function handleCreateWfSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newWfName.trim()) return;
    await onCreateWorkflow({
      name: newWfName.trim(),
      description: 'Sequência multicanal WhatsApp Web + E-mail Marketing.',
      trigger: newWfTrigger,
      steps: [
        {
          id: 'step-1',
          order: 1,
          type: 'whatsapp_template',
          label: 'Disparo automático WhatsApp Web',
          templateId: newWfTemplateId,
        },
        {
          id: 'step-2',
          order: 2,
          type: 'wait_days',
          label: 'Aguardar 2 dias sem resposta',
          delayDays: 2,
        },
        {
          id: 'step-3',
          order: 3,
          type: 'email_campaign',
          label: `E-mail Marketing: ${newWfEmailSubject}`,
          emailSubject: newWfEmailSubject,
        },
      ],
    });
    setNewWfName('');
  }

  async function handleRunApiIngest(e: FormEvent) {
    e.preventDefault();
    setApiTesting(true);
    setApiTestResult('');
    try {
      const res = await onTestApiIngest({
        name: apiName,
        company: apiCompany,
        phone: apiPhone,
        email: apiEmail,
        value: Number(apiValue) || 12000,
        tagName: apiTag,
      });
      setApiTestResult(
        `201 Created: Lead "${res.leadName}" ingerido via API e fluxo automático disparado.`,
      );
    } finally {
      setApiTesting(false);
    }
  }

  async function handleAddWebhook(e: FormEvent) {
    e.preventDefault();
    if (!whName.trim() || !whUrl.trim()) return;
    await onCreateWebhook({
      name: whName.trim(),
      url: whUrl.trim(),
      event: whEvent,
    });
    setWhName('');
    setWhUrl('');
  }

  async function handleSyncEmail() {
    await onSaveEmailConfig(emailConfig);
    const res = await onSyncEmailCampaign(campaignSubject);
    setEmailSyncStatus(
      `${res.syncedCount} contatos sincronizados e campanha registrada via ${emailConfig.provider}.`,
    );
    setTimeout(() => setEmailSyncStatus(''), 4000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
          Automações Multicanal, API e E-mail Marketing
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Orquestre fluxos inteligentes de follow-up, receba leads via API REST e integre ferramentas de e-mail.
        </p>
      </div>

      {/* Multichannel Follow-up Workflows */}
      <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <Workflow className="h-4 w-4 text-teal-700" />
              <span>Fluxos Inteligentes de Prospecção e Follow-up</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sequências combinando disparo no WhatsApp Web, espera condicional, e-mail marketing e etiquetas.
            </p>
          </div>
        </div>

        {execResult && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            <span>{execResult}</span>
          </div>
        )}
        {execError && (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-900"
          >
            {execError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {state.workflows.map((wf) => (
            <article
              key={wf.id}
              className="border border-slate-200 rounded-md p-4 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {wf.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Gatilho: {TRIGGER_LABELS[wf.trigger]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleWorkflow(wf.id, !wf.active)}
                    className={`px-2 py-1 text-[11px] font-medium rounded-sm border ${
                      wf.active
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {wf.active ? 'Ativo' : 'Pausado'}
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {wf.description}
                </p>

                <ol className="space-y-1.5 pt-1">
                  {wf.steps.map((step) => (
                    <li
                      key={step.id}
                      className="text-xs text-slate-700 flex items-center gap-2"
                    >
                      <span className="font-mono text-[10px] font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded-xs">
                        0{step.order}
                      </span>
                      <span className="truncate">{step.label}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {wf.executionsCount} execuções
                </span>
                <button
                  type="button"
                  onClick={() => handleRunFlow(wf.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-md"
                >
                  <Play className="h-3 w-3" />
                  <span>Executar Agora</span>
                </button>
              </div>
            </article>
          ))}
        </div>

        {/* Quick Create Multichannel Flow */}
        <form
          onSubmit={handleCreateWfSubmit}
          className="border-t border-slate-100 pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Novo Fluxo Multicanal
            </label>
            <input
              type="text"
              value={newWfName}
              onChange={(e) => setNewWfName(e.target.value)}
              placeholder="Ex: Cadência Outbound Q4"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Gatilho
            </label>
            <select
              value={newWfTrigger}
              onChange={(e) =>
                setNewWfTrigger(e.target.value as FollowUpFlow['trigger'])
              }
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            >
              <option value="lead_created">Novo Lead Criado</option>
              <option value="spreadsheet_import">Extração de Planilha</option>
              <option value="api_ingest">Captura via API REST</option>
              <option value="stage_qualificado">Entrada em Qualificado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Template WhatsApp (Passo 1)
            </label>
            <select
              value={newWfTemplateId}
              onChange={(e) => setNewWfTemplateId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
            >
              {state.templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Assunto E-mail (Passo 3)
            </label>
            <input
              type="text"
              value={newWfEmailSubject}
              onChange={(e) => setNewWfEmailSubject(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Criar Fluxo</span>
          </button>
        </form>
      </section>

      {/* API Ingestion & Outgoing Webhooks + Email Marketing */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* API Automation & Tester */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-teal-700" />
                <span>API REST de Prospecção e Webhooks</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Endpoint ativo para integrar landing pages, formulários e robôs de prospecção.
              </p>
            </div>
          </div>

          <div className="rounded-md bg-slate-900 text-slate-100 p-4 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between gap-2">
              <span className="text-emerald-400">
                POST /api/v1/leads/ingest
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(state.apiKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{copiedKey ? 'Copiado' : 'Copiar Key'}</span>
                </button>
                <button
                  type="button"
                  onClick={onRotateApiKey}
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Gerar Nova</span>
                </button>
              </div>
            </div>
            <p className="text-slate-300 break-all">
              x-api-key: {state.apiKey}
            </p>
          </div>

          <form onSubmit={handleRunApiIngest} className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-800">
              Testar Ingestão de Lead via API Agora
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                aria-label="Nome do lead via API"
                value={apiName}
                onChange={(e) => setApiName(e.target.value)}
                placeholder="Nome"
                className="rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
              <input
                type="text"
                aria-label="Empresa do lead via API"
                value={apiCompany}
                onChange={(e) => setApiCompany(e.target.value)}
                placeholder="Empresa"
                className="rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
              <input
                type="text"
                aria-label="WhatsApp do lead via API"
                value={apiPhone}
                onChange={(e) => setApiPhone(e.target.value)}
                placeholder="WhatsApp"
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
              />
              <input
                type="email"
                aria-label="E-mail do lead via API"
                value={apiEmail}
                onChange={(e) => setApiEmail(e.target.value)}
                placeholder="E-mail"
                className="rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
              <input
                type="number"
                aria-label="Valor estimado via API"
                value={apiValue}
                onChange={(e) => setApiValue(e.target.value)}
                placeholder="Valor R$"
                className="rounded-md border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900"
              />
              <input
                type="text"
                aria-label="Etiqueta via API"
                value={apiTag}
                onChange={(e) => setApiTag(e.target.value)}
                placeholder="Etiqueta"
                className="rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            {apiTestResult && (
              <p
                role="status"
                className="text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2"
              >
                {apiTestResult}
              </p>
            )}

            <button
              type="submit"
              disabled={apiTesting}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium rounded-md"
            >
              {apiTesting
                ? 'Enviando payload...'
                : 'Disparar Requisição POST /api/v1/leads/ingest'}
            </button>
          </form>

          {/* Outgoing Webhooks */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Webhook className="h-3.5 w-3.5 text-slate-600" />
              <span>Webhooks de Saída</span>
            </h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-md">
              {state.webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{wh.name}</p>
                    <p className="font-mono text-[11px] text-slate-500 truncate">
                      {wh.event} → {wh.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] text-emerald-700 tabular-nums">
                      {wh.successCount} ok
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteWebhook(wh.id)}
                      aria-label={`Remover webhook ${wh.name}`}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddWebhook}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2"
            >
              <input
                type="text"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder="Nome do webhook"
                className="sm:col-span-4 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <input
                type="url"
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
                placeholder="https://..."
                className="sm:col-span-4 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-mono"
              />
              <select
                value={whEvent}
                onChange={(e) =>
                  setWhEvent(e.target.value as WebhookConfig['event'])
                }
                className="sm:col-span-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="lead.created">lead.created</option>
                <option value="stage.changed">stage.changed</option>
                <option value="whatsapp.dispatched">whatsapp.dispatched</option>
                <option value="deal.won">deal.won</option>
              </select>
              <button
                type="submit"
                className="sm:col-span-2 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md whitespace-nowrap"
              >
                Adicionar
              </button>
            </form>
          </div>
        </section>

        {/* Email Marketing Integration */}
        <section className="bg-white border border-slate-200 rounded-lg p-6 space-y-5 h-fit">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
              <Mail className="h-4 w-4 text-sky-700" />
              <span>Integração com E-mail Marketing</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sincronize contatos segmentados por etiquetas com sua plataforma de campanhas.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-md p-3.5">
            <div>
              <p className="text-[11px] text-slate-500">Sincronizados</p>
              <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {state.emailMarketing.syncedContactsCount}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Taxa Abertura</p>
              <p className="font-mono text-lg font-semibold text-emerald-700 tabular-nums">
                {state.emailMarketing.openRate}%
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Taxa Cliques</p>
              <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
                {state.emailMarketing.clickRate}%
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="email-provider"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Plataforma Conectada
              </label>
              <select
                id="email-provider"
                value={emailConfig.provider}
                onChange={(e) =>
                  setEmailConfig((prev) => ({
                    ...prev,
                    provider: e.target.value as EmailMarketingConfig['provider'],
                  }))
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              >
                <option value="RD Station">RD Station Marketing</option>
                <option value="Mailchimp">Mailchimp</option>
                <option value="ActiveCampaign">ActiveCampaign</option>
                <option value="Brevo">Brevo (Sendinblue)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="email-list-name"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Lista / Audiência de Destino
              </label>
              <input
                id="email-list-name"
                type="text"
                value={emailConfig.audienceListName}
                onChange={(e) =>
                  setEmailConfig((prev) => ({
                    ...prev,
                    audienceListName: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="email-sender"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Remetente Verificado
              </label>
              <input
                id="email-sender"
                type="email"
                value={emailConfig.senderEmail}
                onChange={(e) =>
                  setEmailConfig((prev) => ({
                    ...prev,
                    senderEmail: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            <div>
              <span className="block text-xs font-medium text-slate-600 mb-1.5">
                Etiquetas com Sincronização Automática
              </span>
              <div className="flex flex-wrap gap-1.5">
                {state.tags.map((tag) => {
                  const active = emailConfig.autoSyncTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() =>
                        setEmailConfig((prev) => ({
                          ...prev,
                          autoSyncTagIds: active
                            ? prev.autoSyncTagIds.filter((id) => id !== tag.id)
                            : [...prev.autoSyncTagIds, tag.id],
                        }))
                      }
                      className={`px-2.5 py-1 text-xs rounded-md border ${
                        active
                          ? 'bg-sky-700 text-white border-sky-700'
                          : 'bg-white text-slate-700 border-slate-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="campaign-subject"
                className="block text-xs font-medium text-slate-600 mb-1"
              >
                Assunto do Disparo Imediato
              </label>
              <input
                id="campaign-subject"
                type="text"
                value={campaignSubject}
                onChange={(e) => setCampaignSubject(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-900"
              />
            </div>

            {emailSyncStatus && (
              <p
                role="status"
                className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2"
              >
                {emailSyncStatus}
              </p>
            )}

            <button
              type="button"
              onClick={handleSyncEmail}
              className="w-full px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium rounded-md"
            >
              Salvar Integração e Sincronizar Campanha
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
