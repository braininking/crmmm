import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  CrmState,
  InteractionEvent,
  Lead,
  LeadTag,
} from '../src/types/crm';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'crm-db.json');

function createInitialState(): CrmState {
  const now = new Date();
  const hoursAgo = (h: number) =>
    new Date(now.getTime() - h * 3600 * 1000).toISOString();
  const hoursAhead = (h: number) =>
    new Date(now.getTime() + h * 3600 * 1000).toISOString();

  const tags: LeadTag[] = [
    { id: 'tag-vip', name: 'VIP Enterprise', color: 'teal' },
    { id: 'tag-inbound', name: 'Inbound Site', color: 'indigo' },
    { id: 'tag-urgente', name: 'Urgente', color: 'rose' },
    { id: 'tag-reengajar', name: 'Reengajamento', color: 'amber' },
    { id: 'tag-wpp', name: 'WhatsApp Ativo', color: 'emerald' },
  ];

  const leads: Lead[] = [
    {
      id: 'lead-101',
      name: 'Mariana Costa',
      company: 'Grupo Vanguarda Logística',
      email: 'mariana.costa@vanguardalog.com.br',
      phone: '5511998765432',
      value: 48000,
      stage: 'negociacao',
      tagIds: ['tag-vip', 'tag-wpp'],
      source: 'manual',
      owner: 'Camila Rocha',
      nextFollowUpAt: hoursAhead(3),
      createdAt: hoursAgo(120),
      updatedAt: hoursAgo(2),
    },
    {
      id: 'lead-102',
      name: 'Rafael Mendes',
      company: 'Aliança Indústria Sul',
      email: 'rafael@aliancasul.ind.br',
      phone: '5541987651122',
      value: 32500,
      stage: 'proposta',
      tagIds: ['tag-inbound', 'tag-urgente'],
      source: 'api',
      owner: 'Camila Rocha',
      nextFollowUpAt: hoursAhead(5),
      createdAt: hoursAgo(96),
      updatedAt: hoursAgo(4),
    },
    {
      id: 'lead-103',
      name: 'Beatriz Oliveira',
      company: 'Clínica Vitae Saúde',
      email: 'beatriz@vitaesaude.com.br',
      phone: '5521996543321',
      value: 19800,
      stage: 'qualificado',
      tagIds: ['tag-wpp'],
      source: 'whatsapp',
      owner: 'Lucas Ferreira',
      nextFollowUpAt: hoursAhead(18),
      createdAt: hoursAgo(72),
      updatedAt: hoursAgo(6),
    },
    {
      id: 'lead-104',
      name: 'Thiago Albuquerque',
      company: 'Construtora Horizonte',
      email: 'thiago@horizontecorp.com.br',
      phone: '5531991234567',
      value: 64000,
      stage: 'fechado',
      tagIds: ['tag-vip'],
      source: 'manual',
      owner: 'Camila Rocha',
      createdAt: hoursAgo(240),
      updatedAt: hoursAgo(14),
    },
    {
      id: 'lead-105',
      name: 'Juliana Peixoto',
      company: 'Rede Mercado Paulista',
      email: 'juliana.p@mercadopaulista.com.br',
      phone: '5511974458899',
      value: 24000,
      stage: 'prospeccao',
      tagIds: ['tag-reengajar'],
      source: 'planilha',
      owner: 'Lucas Ferreira',
      nextFollowUpAt: hoursAhead(24),
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(9),
    },
    {
      id: 'lead-106',
      name: 'Eduardo Vasconcelos',
      company: 'AgroTech Cerrado',
      email: 'eduardo@agrotechcerrado.com.br',
      phone: '5562993347788',
      value: 41000,
      stage: 'proposta',
      tagIds: ['tag-vip', 'tag-inbound'],
      source: 'email_marketing',
      owner: 'Camila Rocha',
      nextFollowUpAt: hoursAhead(8),
      createdAt: hoursAgo(80),
      updatedAt: hoursAgo(3),
    },
    {
      id: 'lead-107',
      name: 'Fernanda Nogueira',
      company: 'Nogueira & Associados',
      email: 'fernanda@nogueiraadv.com.br',
      phone: '5511982214455',
      value: 29500,
      stage: 'fechado',
      tagIds: ['tag-inbound'],
      source: 'api',
      owner: 'Lucas Ferreira',
      createdAt: hoursAgo(190),
      updatedAt: hoursAgo(20),
    },
    {
      id: 'lead-108',
      name: 'Gustavo Sampaio',
      company: 'Sampaio Distribuidora',
      email: 'gustavo@sampaiodist.com.br',
      phone: '5571991126677',
      value: 16500,
      stage: 'prospeccao',
      tagIds: ['tag-wpp'],
      source: 'planilha',
      owner: 'Camila Rocha',
      nextFollowUpAt: hoursAhead(12),
      createdAt: hoursAgo(30),
      updatedAt: hoursAgo(5),
    },
  ];

  const interactions: InteractionEvent[] = [
    {
      id: 'evt-1',
      leadId: 'lead-101',
      channel: 'whatsapp',
      direction: 'outbound',
      summary: 'Envio de proposta via WhatsApp Web',
      content:
        'Olá Mariana, encaminhei os detalhes da proposta comercial de R$ 48.000 para a Grupo Vanguarda Logística. Podemos validar os prazos hoje às 15h?',
      createdAt: hoursAgo(2),
      author: 'Camila Rocha',
    },
    {
      id: 'evt-2',
      leadId: 'lead-101',
      channel: 'whatsapp',
      direction: 'inbound',
      summary: 'Resposta recebida no WhatsApp',
      content:
        'Oi Camila! Recebi sim, nossa diretoria financeira está revisando a cláusula de implantação até o fim da tarde.',
      createdAt: hoursAgo(1),
      author: 'Mariana Costa',
    },
    {
      id: 'evt-3',
      leadId: 'lead-102',
      channel: 'api',
      direction: 'system',
      summary: 'Lead capturado via API Webhook',
      content:
        'Contato ingerido automaticamente via POST /api/v1/leads/ingest (origem: Formulário B2B).',
      createdAt: hoursAgo(96),
      author: 'API Vértice',
    },
    {
      id: 'evt-4',
      leadId: 'lead-102',
      channel: 'email',
      direction: 'outbound',
      summary: 'E-mail Marketing: Case de Sucesso Industrial',
      content:
        'Disparo automático pela sequência RD Station: "Como indústrias reduziram em 34% o ciclo de vendas".',
      createdAt: hoursAgo(28),
      author: 'Automação Multicanal',
    },
    {
      id: 'evt-5',
      leadId: 'lead-103',
      channel: 'ligacao',
      direction: 'outbound',
      summary: 'Reunião de descoberta (18 min)',
      content:
        'Cliente busca centralizar atendimentos de 4 recepcionistas no WhatsApp Web com etiquetas por especialidade.',
      createdAt: hoursAgo(6),
      author: 'Lucas Ferreira',
    },
    {
      id: 'evt-6',
      leadId: 'lead-104',
      channel: 'funil',
      direction: 'system',
      summary: 'Negócio marcado como Fechado (Ganho)',
      content: 'Contrato anual assinado no valor de R$ 64.000.',
      createdAt: hoursAgo(14),
      author: 'Camila Rocha',
    },
    {
      id: 'evt-7',
      leadId: 'lead-106',
      channel: 'whatsapp',
      direction: 'outbound',
      summary: 'Follow-up automático de proposta',
      content:
        'Olá Eduardo, passando para confirmar se conseguiu avaliar a proposta de R$ 41.000 para a AgroTech Cerrado.',
      createdAt: hoursAgo(3),
      author: 'Fluxo Follow-up Proposta',
    },
  ];

  return {
    leads,
    tags,
    interactions,
    whatsapp: {
      connected: true,
      deviceName: 'iPhone 15 Pro — Comercial Matriz',
      phoneNumber: '+55 (11) 98842-1090',
      batteryLevel: 88,
      lastSyncAt: hoursAgo(0.1),
      pairingToken: `vtc-wpp-${crypto.randomBytes(6).toString('hex')}`,
      autoReplyEnabled: true,
      totalSent: 142,
      totalDelivered: 139,
      totalReplied: 58,
    },
    templates: [
      {
        id: 'tpl-boas-vindas',
        name: 'Boas-vindas Prospecção',
        category: 'boas_vindas',
        body: 'Olá {{primeiro_nome}}, tudo bem? Aqui é da equipe comercial. Vi que a {{empresa}} demonstrou interesse em otimizar o atendimento e funil de vendas. Posso te enviar uma apresentação rápida?',
      },
      {
        id: 'tpl-followup',
        name: 'Follow-up de Proposta',
        category: 'follow_up',
        body: 'Oi {{primeiro_nome}}! Passando para saber o que achou da nossa proposta de {{valor}} para a {{empresa}}. Ficou alguma dúvida técnica que eu possa esclarecer hoje?',
      },
      {
        id: 'tpl-reativacao',
        name: 'Reativação de Base',
        category: 'reativacao',
        body: 'Olá {{primeiro_nome}}, retomando nosso contato sobre a operação da {{empresa}}. Liberamos novas automações para WhatsApp Web esta semana — faz sentido conversarmos 10 minutos?',
      },
    ],
    workflows: [
      {
        id: 'wf-inbound',
        name: 'Prospecção Multicanal Boas-vindas',
        description:
          'Dispara mensagem inicial no WhatsApp Web, envia apresentação por e-mail marketing e etiqueta o contato automaticamente.',
        active: true,
        trigger: 'lead_created',
        steps: [
          {
            id: 's1',
            order: 1,
            type: 'whatsapp_template',
            label: 'Disparar WhatsApp Web (Boas-vindas)',
            templateId: 'tpl-boas-vindas',
          },
          {
            id: 's2',
            order: 2,
            type: 'email_campaign',
            label: 'Enviar E-mail: Apresentação Institucional',
            emailSubject: 'Bem-vindo(a) — Como escalar vendas com o Vértice CRM',
          },
          {
            id: 's3',
            order: 3,
            type: 'add_tag',
            label: 'Aplicar etiqueta WhatsApp Ativo',
            targetTagId: 'tag-wpp',
          },
        ],
        executionsCount: 24,
        lastExecutedAt: hoursAgo(3),
      },
      {
        id: 'wf-planilha',
        name: 'Aquecimento de Leads de Planilha',
        description:
          'Para contatos extraídos de planilhas XLSX/CSV: envia abordagem inicial no WhatsApp e agenda qualificação.',
        active: true,
        trigger: 'spreadsheet_import',
        steps: [
          {
            id: 's4',
            order: 1,
            type: 'whatsapp_template',
            label: 'Disparar WhatsApp Web (Reativação)',
            templateId: 'tpl-reativacao',
          },
          {
            id: 's5',
            order: 2,
            type: 'wait_days',
            label: 'Aguardar 2 dias úteis sem resposta',
            delayDays: 2,
          },
          {
            id: 's6',
            order: 3,
            type: 'email_campaign',
            label: 'Sequência E-mail Marketing Follow-up',
            emailSubject: 'Material exclusivo para a {{empresa}}',
          },
        ],
        executionsCount: 11,
        lastExecutedAt: hoursAgo(12),
      },
      {
        id: 'wf-api',
        name: 'Atendimento Imediato via API',
        description:
          'Acionado instantaneamente quando um lead entra via webhook POST /api/v1/leads/ingest.',
        active: true,
        trigger: 'api_ingest',
        steps: [
          {
            id: 's7',
            order: 1,
            type: 'whatsapp_template',
            label: 'Disparo imediato WhatsApp Web',
            templateId: 'tpl-boas-vindas',
          },
          {
            id: 's8',
            order: 2,
            type: 'move_stage',
            label: 'Avançar para Qualificado',
            targetStage: 'qualificado',
          },
        ],
        executionsCount: 19,
        lastExecutedAt: hoursAgo(5),
      },
    ],
    emailMarketing: {
      provider: 'RD Station',
      connected: true,
      audienceListName: 'Leads B2B Qualificados 2026',
      senderEmail: 'comercial@verticecrm.com.br',
      syncedContactsCount: 8,
      openRate: 42.8,
      clickRate: 14.3,
      lastSyncAt: hoursAgo(1),
      autoSyncTagIds: ['tag-vip', 'tag-inbound'],
    },
    webhooks: [
      {
        id: 'wh-1',
        name: 'Sincronização ERP / Faturamento',
        url: 'https://hooks.empresa.com.br/crm/deal-won',
        event: 'deal.won',
        active: true,
        lastTriggeredAt: hoursAgo(14),
        successCount: 12,
      },
      {
        id: 'wh-2',
        name: 'Alerta Slack Diretoria Comercial',
        url: 'https://hooks.slack.com/services/T000/B000/vertice',
        event: 'lead.created',
        active: true,
        lastTriggeredAt: hoursAgo(2),
        successCount: 38,
      },
    ],
    apiKey: 'vtc_live_98f2a4c7d1e04b63a91c52e8',
    dashboardWidgets: [
      {
        id: 'funnel_conversion',
        title: 'Conversão por Etapa do Funil',
        visible: true,
        span: 1,
        order: 1,
      },
      {
        id: 'revenue_trend',
        title: 'Receita Prevista vs. Fechada',
        visible: true,
        span: 1,
        order: 2,
      },
      {
        id: 'multichannel_performance',
        title: 'Desempenho WhatsApp Web & E-mail',
        visible: true,
        span: 1,
        order: 3,
      },
      {
        id: 'pending_followups',
        title: 'Follow-ups Prioritários',
        visible: true,
        span: 1,
        order: 4,
      },
      {
        id: 'auto_reports_summary',
        title: 'Relatórios Automáticos Recentes',
        visible: true,
        span: 2,
        order: 5,
      },
    ],
    reports: [
      {
        id: 'rep-1',
        title: 'Relatório Executivo Semanal — Pipeline B2B',
        periodLabel: 'Últimos 7 dias',
        generatedAt: hoursAgo(24),
        totalLeads: 8,
        pipelineValue: 181800,
        wonValue: 93500,
        conversionRate: 25.0,
        whatsappSent: 142,
        emailOpenRate: 42.8,
        scheduleRule: 'Automático · Segundas às 08:00',
      },
    ],
    reportSchedule: {
      enabled: true,
      frequency: 'semanal',
      recipientEmail: 'diretoria@verticecrm.com.br',
      channel: 'whatsapp_e_email',
    },
  };
}

export function loadState(): CrmState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialState();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) as CrmState;
  } catch {
    const initial = createInitialState();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

export function saveState(state: CrmState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf-8');
}
