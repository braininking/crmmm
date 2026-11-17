export type FunnelStageId =
  | 'prospeccao'
  | 'qualificado'
  | 'proposta'
  | 'negociacao'
  | 'fechado'
  | 'perdido';

export interface FunnelStage {
  id: FunnelStageId;
  label: string;
  order: number;
  accentHex: string;
}

export interface LeadTag {
  id: string;
  name: string;
  color: 'teal' | 'amber' | 'indigo' | 'rose' | 'emerald' | 'slate';
}

export type InteractionChannel =
  | 'whatsapp'
  | 'email'
  | 'nota'
  | 'ligacao'
  | 'api'
  | 'funil';

export interface InteractionEvent {
  id: string;
  leadId: string;
  channel: InteractionChannel;
  direction: 'outbound' | 'inbound' | 'system';
  summary: string;
  content: string;
  createdAt: string;
  author: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  value: number;
  stage: FunnelStageId;
  tagIds: string[];
  source: 'manual' | 'planilha' | 'api' | 'whatsapp' | 'email_marketing';
  owner: string;
  nextFollowUpAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewLeadInput {
  name: string;
  company: string;
  email: string;
  phone: string;
  value: number;
  stage?: FunnelStageId;
  tagIds?: string[];
  source?: Lead['source'];
  owner?: string;
  nextFollowUpAt?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'boas_vindas' | 'follow_up' | 'proposta' | 'reativacao';
  body: string;
}

export interface WhatsAppSession {
  connected: boolean;
  deviceName: string;
  phoneNumber: string;
  batteryLevel: number;
  lastSyncAt: string;
  pairingToken: string;
  autoReplyEnabled: boolean;
  totalSent: number;
  totalDelivered: number;
  totalReplied: number;
}

export interface WorkflowStep {
  id: string;
  order: number;
  type: 'whatsapp_template' | 'email_campaign' | 'wait_days' | 'add_tag' | 'move_stage';
  label: string;
  templateId?: string;
  delayDays?: number;
  targetTagId?: string;
  targetStage?: FunnelStageId;
  emailSubject?: string;
}

export interface FollowUpFlow {
  id: string;
  name: string;
  description: string;
  active: boolean;
  trigger: 'lead_created' | 'spreadsheet_import' | 'api_ingest' | 'stage_qualificado';
  targetTagId?: string;
  steps: WorkflowStep[];
  executionsCount: number;
  lastExecutedAt?: string;
}

export interface EmailMarketingConfig {
  provider: 'RD Station' | 'Mailchimp' | 'ActiveCampaign' | 'Brevo';
  connected: boolean;
  audienceListName: string;
  senderEmail: string;
  syncedContactsCount: number;
  openRate: number;
  clickRate: number;
  lastSyncAt: string;
  autoSyncTagIds: string[];
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  event: 'lead.created' | 'stage.changed' | 'whatsapp.dispatched' | 'deal.won';
  active: boolean;
  lastTriggeredAt?: string;
  successCount: number;
}

export type DashboardWidgetId =
  | 'funnel_conversion'
  | 'revenue_trend'
  | 'multichannel_performance'
  | 'pending_followups'
  | 'auto_reports_summary';

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  title: string;
  visible: boolean;
  span: 1 | 2;
  order: number;
}

export interface GeneratedReport {
  id: string;
  title: string;
  periodLabel: string;
  generatedAt: string;
  totalLeads: number;
  pipelineValue: number;
  wonValue: number;
  conversionRate: number;
  whatsappSent: number;
  emailOpenRate: number;
  scheduleRule: string;
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: 'diario' | 'semanal' | 'mensal';
  recipientEmail: string;
  channel: 'email' | 'whatsapp_e_email';
}

export interface CrmState {
  leads: Lead[];
  tags: LeadTag[];
  interactions: InteractionEvent[];
  whatsapp: WhatsAppSession;
  templates: WhatsAppTemplate[];
  workflows: FollowUpFlow[];
  emailMarketing: EmailMarketingConfig;
  webhooks: WebhookConfig[];
  apiKey: string;
  dashboardWidgets: DashboardWidgetConfig[];
  reports: GeneratedReport[];
  reportSchedule: ReportSchedule;
}

export type NavSection =
  | 'dashboard'
  | 'funil'
  | 'planilhas'
  | 'whatsapp'
  | 'automacoes';
