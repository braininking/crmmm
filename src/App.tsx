import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { FunnelView } from './components/FunnelView';
import { SpreadsheetsReportsView } from './components/SpreadsheetsReportsView';
import { WhatsAppView } from './components/WhatsAppView';
import { AutomationsView } from './components/AutomationsView';
import { LeadDrawer } from './components/LeadDrawer';
import { NewLeadModal } from './components/NewLeadModal';
import { apiRequest } from './utils/apiClient';
import type {
  CrmState,
  DashboardWidgetConfig,
  EmailMarketingConfig,
  FollowUpFlow,
  FunnelStageId,
  InteractionChannel,
  Lead,
  LeadTag,
  NavSection,
  ReportSchedule,
  WebhookConfig,
  WhatsAppTemplate,
} from './types/crm';

export default function App() {
  const [state, setState] = useState<CrmState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeWhatsAppLeadId, setActiveWhatsAppLeadId] = useState<string | null>(null);
  const [newLeadModalOpen, setNewLeadModalOpen] = useState(false);
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(true);

  const fetchState = useCallback(async () => {
    try {
      const data = await apiRequest<CrmState>('/api/state');
      setState(data);
      setError('');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao carregar dados do CRM.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Real-time background polling when liveSyncEnabled is active
  useEffect(() => {
    if (!liveSyncEnabled) return;
    const timer = window.setInterval(() => {
      fetchState();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [liveSyncEnabled, fetchState]);

  const selectedLead =
    state?.leads.find((l) => l.id === selectedLeadId) ?? null;

  async function handleCreateLead(payload: {
    name: string;
    company: string;
    email: string;
    phone: string;
    value: number;
    stage: FunnelStageId;
    tagIds: string[];
    runAutoFlows: boolean;
  }) {
    const res = await apiRequest<{ state: CrmState }>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setState(res.state);
  }

  async function handleUpdateLead(
    leadId: string,
    updates: Partial<Pick<Lead, 'stage' | 'tagIds' | 'value'>>,
  ) {
    const res = await apiRequest<{ state: CrmState }>(`/api/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    setState(res.state);
  }

  async function handleDeleteLead(leadId: string) {
    const res = await apiRequest<{ state: CrmState }>(`/api/leads/${leadId}`, {
      method: 'DELETE',
    });
    setState(res.state);
  }

  async function handleAddInteraction(payload: {
    leadId: string;
    channel: InteractionChannel;
    summary: string;
    content: string;
  }) {
    const res = await apiRequest<{ state: CrmState }>('/api/interactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setState(res.state);
  }

  async function handleCreateTag(name: string, color: LeadTag['color']) {
    const res = await apiRequest<{ state: CrmState }>('/api/tags', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    });
    setState(res.state);
  }

  async function handleDeleteTag(tagId: string) {
    const res = await apiRequest<{ state: CrmState }>(`/api/tags/${tagId}`, {
      method: 'DELETE',
    });
    setState(res.state);
  }

  async function handleImportLeads(payload: {
    leads: unknown[];
    newTagNames: string[];
    triggerFlow: boolean;
  }) {
    const res = await apiRequest<{ importedCount: number; state: CrmState }>(
      '/api/leads/import',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    setState(res.state);
    return { importedCount: res.importedCount };
  }

  async function handleSaveWidgets(widgets: DashboardWidgetConfig[]) {
    setState((prev) =>
      prev ? { ...prev, dashboardWidgets: widgets } : prev,
    );
    const res = await apiRequest<{ state: CrmState }>('/api/dashboard/widgets', {
      method: 'PATCH',
      body: JSON.stringify({ widgets }),
    });
    setState(res.state);
  }

  async function handleGenerateReport(
    periodLabel = 'Últimos 30 dias',
    title?: string,
  ) {
    const res = await apiRequest<{ state: CrmState }>('/api/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ periodLabel, title }),
    });
    setState(res.state);
  }

  async function handleSaveReportSchedule(schedule: ReportSchedule) {
    const res = await apiRequest<{ state: CrmState }>('/api/reports/schedule', {
      method: 'PATCH',
      body: JSON.stringify(schedule),
    });
    setState(res.state);
  }

  async function handleDispatchWhatsApp(
    leadIds: string[],
    messageTemplate: string,
    summaryLabel?: string,
  ) {
    const res = await apiRequest<{
      dispatched: {
        leadId: string;
        leadName: string;
        phone: string;
        message: string;
      }[];
      state: CrmState;
    }>('/api/whatsapp/dispatch', {
      method: 'POST',
      body: JSON.stringify({ leadIds, messageTemplate, summaryLabel }),
    });
    setState(res.state);
    return { dispatched: res.dispatched };
  }

  async function handleRecordInboundReply(leadId: string, content: string) {
    const res = await apiRequest<{ state: CrmState }>('/api/whatsapp/inbound', {
      method: 'POST',
      body: JSON.stringify({ leadId, content }),
    });
    setState(res.state);
  }

  function handleOpenWhatsAppChat(leadId: string) {
    setActiveWhatsAppLeadId(leadId);
    setSelectedLeadId(null);
    setActiveSection('whatsapp');
  }

  async function handleExecuteWorkflow(id: string, leadId?: string) {
    const res = await apiRequest<{
      executedLeadsCount: number;
      eventsCreated: number;
      state: CrmState;
    }>(`/api/workflows/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify(leadId ? { leadId } : {}),
    });
    setState(res.state);
    return {
      executedLeadsCount: res.executedLeadsCount,
      eventsCreated: res.eventsCreated,
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-3">
          <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
          <div className="h-32 bg-white border border-slate-200 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white border border-rose-200 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm font-medium text-rose-800">
            {error || 'Erro ao inicializar o Vértice CRM.'}
          </p>
          <button
            type="button"
            onClick={fetchState}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-md"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        whatsappConnected={state.whatsapp.connected}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <Header
          activeSection={activeSection}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenNewLead={() => setNewLeadModalOpen(true)}
          totalLeads={state.leads.length}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeSection === 'dashboard' && (
            <DashboardView
              state={state}
              liveSyncEnabled={liveSyncEnabled}
              onToggleLiveSync={() => setLiveSyncEnabled((v) => !v)}
              onRefreshNow={fetchState}
              onSaveWidgets={handleSaveWidgets}
              onGenerateReport={() => handleGenerateReport()}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'funil' && (
            <FunnelView
              leads={state.leads}
              tags={state.tags}
              onSelectLead={(lead) => setSelectedLeadId(lead.id)}
              onMoveStage={(leadId, stage) => handleUpdateLead(leadId, { stage })}
              onCreateTag={handleCreateTag}
              onDeleteTag={handleDeleteTag}
            />
          )}

          {activeSection === 'planilhas' && (
            <SpreadsheetsReportsView
              state={state}
              onImportLeads={handleImportLeads}
              onGenerateReport={handleGenerateReport}
              onSaveReportSchedule={handleSaveReportSchedule}
            />
          )}

          {activeSection === 'whatsapp' && (
            <WhatsAppView
              state={state}
              activeLeadId={activeWhatsAppLeadId}
              onSelectActiveLead={setActiveWhatsAppLeadId}
              onOpenLeadDetails={(lead) => setSelectedLeadId(lead.id)}
              onConnect={async () => {
                const res = await apiRequest<{ state: CrmState }>(
                  '/api/whatsapp/connect',
                  { method: 'POST', body: JSON.stringify({}) },
                );
                setState(res.state);
              }}
              onDisconnect={async () => {
                const res = await apiRequest<{ state: CrmState }>(
                  '/api/whatsapp/disconnect',
                  { method: 'POST' },
                );
                setState(res.state);
              }}
              onRefreshQr={async () => {
                const res = await apiRequest<{ state: CrmState }>(
                  '/api/whatsapp/refresh-qr',
                  { method: 'POST' },
                );
                setState(res.state);
              }}
              onCreateTemplate={async (payload: {
                name: string;
                category: WhatsAppTemplate['category'];
                body: string;
              }) => {
                const res = await apiRequest<{ state: CrmState }>(
                  '/api/whatsapp/templates',
                  { method: 'POST', body: JSON.stringify(payload) },
                );
                setState(res.state);
              }}
              onDeleteTemplate={async (id: string) => {
                const res = await apiRequest<{ state: CrmState }>(
                  `/api/whatsapp/templates/${id}`,
                  { method: 'DELETE' },
                );
                setState(res.state);
              }}
              onDispatchBatch={handleDispatchWhatsApp}
              onRecordInboundReply={handleRecordInboundReply}
            />
          )}

          {activeSection === 'automacoes' && (
            <AutomationsView
              state={state}
              onToggleWorkflow={async (id: string, active: boolean) => {
                const res = await apiRequest<{ state: CrmState }>(
                  `/api/workflows/${id}`,
                  { method: 'PATCH', body: JSON.stringify({ active }) },
                );
                setState(res.state);
              }}
              onExecuteWorkflow={(id: string) => handleExecuteWorkflow(id)}
              onCreateWorkflow={async (payload: {
                name: string;
                description: string;
                trigger: FollowUpFlow['trigger'];
                targetTagId?: string;
                steps: FollowUpFlow['steps'];
              }) => {
                const res = await apiRequest<{ state: CrmState }>(
                  '/api/workflows',
                  { method: 'POST', body: JSON.stringify(payload) },
                );
                setState(res.state);
              }}
              onRotateApiKey={async () => {
                const res = await apiRequest<{ state: CrmState }>(
                  '/api/apikey/rotate',
                  { method: 'POST' },
                );
                setState(res.state);
              }}
              onTestApiIngest={async (payload) => {
                const res = await apiRequest<{ lead: Lead; state: CrmState }>(
                  '/api/v1/leads/ingest',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-api-key': state.apiKey,
                    },
                    body: JSON.stringify(payload),
                  },
                );
                setState(res.state);
                return { leadName: res.lead.name };
              }}
              onCreateWebhook={async (payload: {
                name: string;
                url: string;
                event: WebhookConfig['event'];
              }) => {
                const res = await apiRequest<{ state: CrmState }>(
                  '/api/webhooks',
                  { method: 'POST', body: JSON.stringify(payload) },
                );
                setState(res.state);
              }}
              onDeleteWebhook={async (id: string) => {
                const res = await apiRequest<{ state: CrmState }>(
                  `/api/webhooks/${id}`,
                  { method: 'DELETE' },
                );
                setState(res.state);
              }}
              onSaveEmailConfig={async (config: Partial<EmailMarketingConfig>) => {
                const res = await apiRequest<{ state: CrmState }>(
                  '/api/email-marketing/config',
                  { method: 'POST', body: JSON.stringify(config) },
                );
                setState(res.state);
              }}
              onSyncEmailCampaign={async (subject: string) => {
                const res = await apiRequest<{
                  syncedCount: number;
                  state: CrmState;
                }>('/api/email-marketing/sync', {
                  method: 'POST',
                  body: JSON.stringify({ subject }),
                });
                setState(res.state);
                return { syncedCount: res.syncedCount };
              }}
            />
          )}
        </main>
      </div>

      <LeadDrawer
        lead={selectedLead}
        tags={state.tags}
        interactions={state.interactions}
        templates={state.templates}
        workflows={state.workflows}
        whatsappConnected={state.whatsapp.connected}
        onClose={() => setSelectedLeadId(null)}
        onUpdateLead={handleUpdateLead}
        onDeleteLead={handleDeleteLead}
        onAddInteraction={handleAddInteraction}
        onDispatchWhatsApp={async (leadIds, tpl, label) => {
          await handleDispatchWhatsApp(leadIds, tpl, label);
        }}
        onExecuteWorkflowForLead={async (wfId, leadId) => {
          await handleExecuteWorkflow(wfId, leadId);
        }}
        onOpenWhatsAppChat={handleOpenWhatsAppChat}
      />

      <NewLeadModal
        open={newLeadModalOpen}
        tags={state.tags}
        onClose={() => setNewLeadModalOpen(false)}
        onSubmit={handleCreateLead}
      />
    </div>
  );
}
