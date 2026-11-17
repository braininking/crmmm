import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { loadState, saveState } from './server/store';
import {
  calculateFunnelMetrics,
  evaluateFollowUpEligibility,
  getStageLabel,
  interpolateTemplate,
  normalizeBrazilianPhone,
} from './src/utils/crmLogic';
import type {
  DashboardWidgetConfig,
  EmailMarketingConfig,
  FollowUpFlow,
  FunnelStageId,
  InteractionEvent,
  Lead,
  LeadTag,
  ReportSchedule,
  WhatsAppTemplate,
} from './src/types/crm';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  let state = loadState();

  function commit(nextState: typeof state) {
    state = nextState;
    saveState(state);
    return state;
  }

  function recordWebhookTrigger(
    eventName: 'lead.created' | 'stage.changed' | 'whatsapp.dispatched' | 'deal.won',
  ) {
    const now = new Date().toISOString();
    state.webhooks = state.webhooks.map((wh) =>
      wh.active && wh.event === eventName
        ? { ...wh, lastTriggeredAt: now, successCount: wh.successCount + 1 }
        : wh,
    );
  }

  function runWorkflowOnLead(flow: FollowUpFlow, lead: Lead): InteractionEvent[] {
    const now = new Date().toISOString();
    const newEvents: InteractionEvent[] = [];

    for (const step of flow.steps) {
      if (step.type === 'whatsapp_template') {
        const tpl = state.templates.find((t) => t.id === step.templateId);
        const body = tpl
          ? interpolateTemplate(tpl.body, lead)
          : `Olá ${lead.name}, contato automático do fluxo ${flow.name}.`;
        newEvents.push({
          id: `evt-${crypto.randomUUID().slice(0, 8)}`,
          leadId: lead.id,
          channel: 'whatsapp',
          direction: 'outbound',
          summary: `Fluxo "${flow.name}": WhatsApp enviado`,
          content: body,
          createdAt: now,
          author: `Fluxo: ${flow.name}`,
        });
        state.whatsapp.totalSent += 1;
        state.whatsapp.totalDelivered += 1;
        recordWebhookTrigger('whatsapp.dispatched');
      } else if (step.type === 'email_campaign') {
        const subject = step.emailSubject
          ? interpolateTemplate(step.emailSubject, lead)
          : `Comunicação ${flow.name}`;
        newEvents.push({
          id: `evt-${crypto.randomUUID().slice(0, 8)}`,
          leadId: lead.id,
          channel: 'email',
          direction: 'outbound',
          summary: `E-mail Marketing (${state.emailMarketing.provider}): ${subject}`,
          content: `Contato sincronizado na lista "${state.emailMarketing.audienceListName}" e disparo agendado.`,
          createdAt: now,
          author: state.emailMarketing.provider,
        });
        state.emailMarketing.syncedContactsCount += 1;
        state.emailMarketing.lastSyncAt = now;
      } else if (step.type === 'add_tag' && step.targetTagId) {
        if (!lead.tagIds.includes(step.targetTagId)) {
          lead.tagIds = [...lead.tagIds, step.targetTagId];
          const tagObj = state.tags.find((t) => t.id === step.targetTagId);
          newEvents.push({
            id: `evt-${crypto.randomUUID().slice(0, 8)}`,
            leadId: lead.id,
            channel: 'api',
            direction: 'system',
            summary: `Etiqueta aplicada: ${tagObj?.name ?? step.targetTagId}`,
            content: `Etiqueta adicionada automaticamente pelo fluxo "${flow.name}".`,
            createdAt: now,
            author: `Fluxo: ${flow.name}`,
          });
        }
      } else if (step.type === 'move_stage' && step.targetStage) {
        if (lead.stage !== step.targetStage) {
          const prevLabel = getStageLabel(lead.stage);
          const nextLabel = getStageLabel(step.targetStage);
          lead.stage = step.targetStage;
          lead.updatedAt = now;
          newEvents.push({
            id: `evt-${crypto.randomUUID().slice(0, 8)}`,
            leadId: lead.id,
            channel: 'funil',
            direction: 'system',
            summary: `Etapa movida: ${prevLabel} → ${nextLabel}`,
            content: `Movimentação automática executada pelo fluxo "${flow.name}".`,
            createdAt: now,
            author: `Fluxo: ${flow.name}`,
          });
          recordWebhookTrigger('stage.changed');
        }
      }
    }

    flow.executionsCount += 1;
    flow.lastExecutedAt = now;
    return newEvents;
  }

  // --- API Routes ---

  app.get('/api/state', (_req, res) => {
    res.json(state);
  });

  app.post('/api/leads', (req, res) => {
    const { name, company, email, phone, value, stage, tagIds, owner, nextFollowUpAt } =
      req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Nome do contato é obrigatório.' });
      return;
    }
    const normalizedPhone = normalizeBrazilianPhone(String(phone ?? ''));
    if (!normalizedPhone && !String(email ?? '').trim()) {
      res.status(400).json({ error: 'Informe um WhatsApp ou E-mail válido.' });
      return;
    }

    const now = new Date().toISOString();
    const newLead: Lead = {
      id: `lead-${crypto.randomUUID().slice(0, 8)}`,
      name: name.trim(),
      company: String(company ?? '').trim() || 'Independente',
      email: String(email ?? '').trim(),
      phone: normalizedPhone,
      value: Number(value) > 0 ? Math.round(Number(value)) : 0,
      stage: (stage as FunnelStageId) || 'prospeccao',
      tagIds: Array.isArray(tagIds) ? tagIds : [],
      source: 'manual',
      owner: String(owner ?? '').trim() || 'Camila Rocha',
      nextFollowUpAt: nextFollowUpAt || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const createdEvent: InteractionEvent = {
      id: `evt-${crypto.randomUUID().slice(0, 8)}`,
      leadId: newLead.id,
      channel: 'funil',
      direction: 'system',
      summary: `Contato adicionado em ${getStageLabel(newLead.stage)}`,
      content: `Lead cadastrado manualmente por ${newLead.owner}.`,
      createdAt: now,
      author: newLead.owner,
    };

    state.leads = [newLead, ...state.leads];
    state.interactions = [createdEvent, ...state.interactions];
    recordWebhookTrigger('lead.created');

    // Run active lead_created flows if requested
    if (req.body?.runAutoFlows) {
      for (const wf of state.workflows.filter((w) => w.active && w.trigger === 'lead_created')) {
        const autoEvents = runWorkflowOnLead(wf, newLead);
        state.interactions = [...autoEvents, ...state.interactions];
      }
    }

    commit(state);
    res.status(201).json({ lead: newLead, state });
  });

  app.patch('/api/leads/:id', (req, res) => {
    const idx = state.leads.findIndex((l) => l.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Contato não encontrado.' });
      return;
    }

    const prev = state.leads[idx];
    const updates = req.body ?? {};
    const now = new Date().toISOString();

    const nextLead: Lead = {
      ...prev,
      name: typeof updates.name === 'string' && updates.name.trim() ? updates.name.trim() : prev.name,
      company: typeof updates.company === 'string' ? updates.company.trim() : prev.company,
      email: typeof updates.email === 'string' ? updates.email.trim() : prev.email,
      phone:
        typeof updates.phone === 'string'
          ? normalizeBrazilianPhone(updates.phone)
          : prev.phone,
      value: typeof updates.value === 'number' ? Math.max(0, Math.round(updates.value)) : prev.value,
      stage: (updates.stage as FunnelStageId) || prev.stage,
      tagIds: Array.isArray(updates.tagIds) ? updates.tagIds : prev.tagIds,
      nextFollowUpAt:
        updates.nextFollowUpAt === null
          ? undefined
          : typeof updates.nextFollowUpAt === 'string'
            ? updates.nextFollowUpAt
            : prev.nextFollowUpAt,
      updatedAt: now,
    };

    state.leads[idx] = nextLead;

    if (updates.stage && updates.stage !== prev.stage) {
      const stageEvent: InteractionEvent = {
        id: `evt-${crypto.randomUUID().slice(0, 8)}`,
        leadId: nextLead.id,
        channel: 'funil',
        direction: 'system',
        summary: `Etapa alterada: ${getStageLabel(prev.stage)} → ${getStageLabel(nextLead.stage)}`,
        content: `Movimentação registrada no funil de vendas.`,
        createdAt: now,
        author: 'Camila Rocha',
      };
      state.interactions = [stageEvent, ...state.interactions];
      recordWebhookTrigger('stage.changed');
      if (nextLead.stage === 'fechado') {
        recordWebhookTrigger('deal.won');
      }
    }

    commit(state);
    res.json({ lead: nextLead, state });
  });

  app.delete('/api/leads/:id', (req, res) => {
    state.leads = state.leads.filter((l) => l.id !== req.params.id);
    state.interactions = state.interactions.filter((i) => i.leadId !== req.params.id);
    commit(state);
    res.json({ state });
  });

  app.post('/api/leads/import', (req, res) => {
    const { leads: incomingLeads, newTagNames, triggerFlow } = req.body ?? {};
    if (!Array.isArray(incomingLeads) || incomingLeads.length === 0) {
      res.status(400).json({ error: 'Nenhum contato válido para importar.' });
      return;
    }

    const now = new Date().toISOString();
    const palette: LeadTag['color'][] = ['teal', 'indigo', 'amber', 'emerald', 'rose'];
    const createdTags: LeadTag[] = [];

    if (Array.isArray(newTagNames)) {
      for (const rawName of newTagNames) {
        const cleanName = String(rawName).trim();
        if (!cleanName) continue;
        const exists = state.tags.find(
          (t) => t.name.toLowerCase() === cleanName.toLowerCase(),
        );
        if (!exists) {
          const newTag: LeadTag = {
            id: `tag-${crypto.randomUUID().slice(0, 6)}`,
            name: cleanName,
            color: palette[state.tags.length % palette.length],
          };
          state.tags.push(newTag);
          createdTags.push(newTag);
        }
      }
    }

    const imported: Lead[] = [];
    const importEvents: InteractionEvent[] = [];

    for (const item of incomingLeads) {
      const normalizedPhone = normalizeBrazilianPhone(String(item.phone ?? ''));
      const newLead: Lead = {
        id: `lead-${crypto.randomUUID().slice(0, 8)}`,
        name: String(item.name).trim(),
        company: String(item.company ?? 'Conta Importada').trim(),
        email: String(item.email ?? '').trim(),
        phone: normalizedPhone,
        value: Number(item.value) > 0 ? Math.round(Number(item.value)) : 0,
        stage: (item.stage as FunnelStageId) || 'prospeccao',
        tagIds: Array.isArray(item.tagIds) ? item.tagIds : [],
        source: 'planilha',
        owner: 'Camila Rocha',
        nextFollowUpAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: now,
        updatedAt: now,
      };
      imported.push(newLead);
      importEvents.push({
        id: `evt-${crypto.randomUUID().slice(0, 8)}`,
        leadId: newLead.id,
        channel: 'api',
        direction: 'system',
        summary: 'Extraído via importação de planilha',
        content: `Contato importado em lote para etapa ${getStageLabel(newLead.stage)}.`,
        createdAt: now,
        author: 'Extrator de Planilhas',
      });

      if (triggerFlow) {
        const importFlow = state.workflows.find(
          (w) => w.active && w.trigger === 'spreadsheet_import',
        );
        if (importFlow) {
          const wfEvents = runWorkflowOnLead(importFlow, newLead);
          importEvents.push(...wfEvents);
        }
      }
    }

    state.leads = [...imported, ...state.leads];
    state.interactions = [...importEvents, ...state.interactions];
    commit(state);

    res.status(201).json({
      importedCount: imported.length,
      createdTags,
      state,
    });
  });

  app.post('/api/tags', (req, res) => {
    const { name, color } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Nome da etiqueta é obrigatório.' });
      return;
    }
    const newTag: LeadTag = {
      id: `tag-${crypto.randomUUID().slice(0, 6)}`,
      name: name.trim(),
      color: (color as LeadTag['color']) || 'teal',
    };
    state.tags = [...state.tags, newTag];
    commit(state);
    res.status(201).json({ tag: newTag, state });
  });

  app.delete('/api/tags/:id', (req, res) => {
    state.tags = state.tags.filter((t) => t.id !== req.params.id);
    state.leads = state.leads.map((l) => ({
      ...l,
      tagIds: l.tagIds.filter((id) => id !== req.params.id),
    }));
    commit(state);
    res.json({ state });
  });

  app.post('/api/interactions', (req, res) => {
    const { leadId, channel, summary, content, direction } = req.body ?? {};
    if (!leadId || !content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Lead e conteúdo da interação são obrigatórios.' });
      return;
    }
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) {
      res.status(404).json({ error: 'Contato não encontrado.' });
      return;
    }

    const now = new Date().toISOString();
    const evt: InteractionEvent = {
      id: `evt-${crypto.randomUUID().slice(0, 8)}`,
      leadId,
      channel: channel || 'nota',
      direction: direction || 'outbound',
      summary: summary || 'Registro de interação',
      content: content.trim(),
      createdAt: now,
      author: 'Camila Rocha',
    };

    lead.updatedAt = now;
    state.interactions = [evt, ...state.interactions];
    commit(state);
    res.status(201).json({ interaction: evt, state });
  });

  // --- WhatsApp Web Routes ---

  app.post('/api/whatsapp/connect', (req, res) => {
    const { deviceName, phoneNumber } = req.body ?? {};
    state.whatsapp = {
      ...state.whatsapp,
      connected: true,
      deviceName: deviceName || 'Chrome Web — Estação Comercial',
      phoneNumber: phoneNumber || '+55 (11) 98842-1090',
      lastSyncAt: new Date().toISOString(),
    };
    commit(state);
    res.json({ state });
  });

  app.post('/api/whatsapp/disconnect', (_req, res) => {
    state.whatsapp = {
      ...state.whatsapp,
      connected: false,
      pairingToken: `vtc-wpp-${crypto.randomBytes(6).toString('hex')}`,
    };
    commit(state);
    res.json({ state });
  });

  app.post('/api/whatsapp/refresh-qr', (_req, res) => {
    state.whatsapp = {
      ...state.whatsapp,
      pairingToken: `vtc-wpp-${crypto.randomBytes(6).toString('hex')}`,
    };
    commit(state);
    res.json({ state });
  });

  app.post('/api/whatsapp/templates', (req, res) => {
    const { name, category, body } = req.body ?? {};
    if (!name || !body) {
      res.status(400).json({ error: 'Nome e mensagem do template são obrigatórios.' });
      return;
    }
    const tpl: WhatsAppTemplate = {
      id: `tpl-${crypto.randomUUID().slice(0, 6)}`,
      name: String(name).trim(),
      category: category || 'follow_up',
      body: String(body).trim(),
    };
    state.templates = [...state.templates, tpl];
    commit(state);
    res.status(201).json({ template: tpl, state });
  });

  app.delete('/api/whatsapp/templates/:id', (req, res) => {
    state.templates = state.templates.filter((t) => t.id !== req.params.id);
    commit(state);
    res.json({ state });
  });

  app.post('/api/whatsapp/inbound', (req, res) => {
    const { leadId, content } = req.body ?? {};
    if (!leadId || !content || typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Contato e conteúdo da resposta são obrigatórios.' });
      return;
    }
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) {
      res.status(404).json({ error: 'Contato não encontrado.' });
      return;
    }

    const now = new Date().toISOString();
    const evt: InteractionEvent = {
      id: `evt-${crypto.randomUUID().slice(0, 8)}`,
      leadId: lead.id,
      channel: 'whatsapp',
      direction: 'inbound',
      summary: 'Resposta recebida no WhatsApp',
      content: content.trim(),
      createdAt: now,
      author: lead.name,
    };

    state.interactions = [evt, ...state.interactions];
    state.whatsapp.totalReplied += 1;
    state.whatsapp.lastSyncAt = now;
    lead.updatedAt = now;
    commit(state);

    res.status(201).json({ interaction: evt, state });
  });

  app.post('/api/whatsapp/dispatch', (req, res) => {
    if (!state.whatsapp.connected) {
      res.status(409).json({
        error: 'WhatsApp Web desconectado. Pareie o QR Code antes de disparar.',
      });
      return;
    }

    const { leadIds, messageTemplate, summaryLabel } = req.body ?? {};
    if (!Array.isArray(leadIds) || leadIds.length === 0 || !messageTemplate) {
      res.status(400).json({
        error: 'Selecione ao menos um contato e informe a mensagem.',
      });
      return;
    }

    const now = new Date().toISOString();
    const dispatched: { leadId: string; leadName: string; phone: string; message: string }[] = [];

    for (const id of leadIds) {
      const lead = state.leads.find((l) => l.id === id);
      if (!lead) continue;
      const rendered = interpolateTemplate(String(messageTemplate), lead);
      const evt: InteractionEvent = {
        id: `evt-${crypto.randomUUID().slice(0, 8)}`,
        leadId: lead.id,
        channel: 'whatsapp',
        direction: 'outbound',
        summary: summaryLabel || 'Disparo via WhatsApp Web',
        content: rendered,
        createdAt: now,
        author: 'WhatsApp Web Conectado',
      };
      state.interactions = [evt, ...state.interactions];
      lead.updatedAt = now;
      state.whatsapp.totalSent += 1;
      state.whatsapp.totalDelivered += 1;
      dispatched.push({
        leadId: lead.id,
        leadName: lead.name,
        phone: lead.phone,
        message: rendered,
      });
    }

    state.whatsapp.lastSyncAt = now;
    recordWebhookTrigger('whatsapp.dispatched');
    commit(state);

    res.json({ dispatchedCount: dispatched.length, dispatched, state });
  });

  // --- Workflows & Multichannel Automation Routes ---

  app.post('/api/workflows', (req, res) => {
    const { name, description, trigger, targetTagId, steps } = req.body ?? {};
    if (!name || !Array.isArray(steps) || steps.length === 0) {
      res.status(400).json({ error: 'Nome e ao menos 1 passo são obrigatórios.' });
      return;
    }
    const wf: FollowUpFlow = {
      id: `wf-${crypto.randomUUID().slice(0, 6)}`,
      name: String(name).trim(),
      description: String(description ?? '').trim() || 'Fluxo automatizado multicanal.',
      active: true,
      trigger: trigger || 'lead_created',
      targetTagId: targetTagId || undefined,
      steps,
      executionsCount: 0,
    };
    state.workflows = [wf, ...state.workflows];
    commit(state);
    res.status(201).json({ workflow: wf, state });
  });

  app.patch('/api/workflows/:id', (req, res) => {
    const wf = state.workflows.find((w) => w.id === req.params.id);
    if (!wf) {
      res.status(404).json({ error: 'Fluxo não encontrado.' });
      return;
    }
    if (typeof req.body?.active === 'boolean') wf.active = req.body.active;
    if (typeof req.body?.name === 'string') wf.name = req.body.name;
    commit(state);
    res.json({ workflow: wf, state });
  });

  app.post('/api/workflows/:id/execute', (req, res) => {
    const wf = state.workflows.find((w) => w.id === req.params.id);
    if (!wf) {
      res.status(404).json({ error: 'Fluxo não encontrado.' });
      return;
    }

    const specificLeadId = req.body?.leadId as string | undefined;
    const targets = specificLeadId
      ? state.leads.filter((l) => l.id === specificLeadId)
      : evaluateFollowUpEligibility(wf, state.leads).slice(0, 5);

    if (targets.length === 0) {
      res.status(400).json({
        error: 'Nenhum lead elegível encontrado para os critérios deste fluxo.',
      });
      return;
    }

    const createdEvents: InteractionEvent[] = [];
    for (const lead of targets) {
      const evts = runWorkflowOnLead(wf, lead);
      createdEvents.push(...evts);
    }

    state.interactions = [...createdEvents, ...state.interactions];
    commit(state);

    res.json({
      executedLeadsCount: targets.length,
      eventsCreated: createdEvents.length,
      state,
    });
  });

  // --- Email Marketing & Webhooks & API Key ---

  app.post('/api/email-marketing/config', (req, res) => {
    const updates = (req.body ?? {}) as Partial<EmailMarketingConfig>;
    state.emailMarketing = {
      ...state.emailMarketing,
      ...updates,
      lastSyncAt: new Date().toISOString(),
    };
    commit(state);
    res.json({ state });
  });

  app.post('/api/email-marketing/sync', (req, res) => {
    const subject =
      String(req.body?.subject ?? '').trim() ||
      'Campanha de Prospecção — Novidades Vértice';
    const tagIds = state.emailMarketing.autoSyncTagIds;
    const matchingLeads =
      tagIds.length > 0
        ? state.leads.filter((l) => l.tagIds.some((t) => tagIds.includes(t)))
        : state.leads;

    const now = new Date().toISOString();
    const events: InteractionEvent[] = matchingLeads.map((lead) => ({
      id: `evt-${crypto.randomUUID().slice(0, 8)}`,
      leadId: lead.id,
      channel: 'email',
      direction: 'outbound',
      summary: `Campanha ${state.emailMarketing.provider}: ${subject}`,
      content: `E-mail disparado para ${lead.email || lead.name} na lista "${state.emailMarketing.audienceListName}".`,
      createdAt: now,
      author: state.emailMarketing.provider,
    }));

    state.interactions = [...events, ...state.interactions];
    state.emailMarketing.syncedContactsCount = matchingLeads.length;
    state.emailMarketing.lastSyncAt = now;
    commit(state);
    res.json({ syncedCount: matchingLeads.length, state });
  });

  app.post('/api/webhooks', (req, res) => {
    const { name, url, event } = req.body ?? {};
    if (!name || !url) {
      res.status(400).json({ error: 'Nome e URL do webhook são obrigatórios.' });
      return;
    }
    const wh = {
      id: `wh-${crypto.randomUUID().slice(0, 6)}`,
      name: String(name).trim(),
      url: String(url).trim(),
      event: event || 'lead.created',
      active: true,
      successCount: 0,
    };
    state.webhooks = [wh, ...state.webhooks];
    commit(state);
    res.status(201).json({ webhook: wh, state });
  });

  app.delete('/api/webhooks/:id', (req, res) => {
    state.webhooks = state.webhooks.filter((w) => w.id !== req.params.id);
    commit(state);
    res.json({ state });
  });

  app.post('/api/apikey/rotate', (_req, res) => {
    state.apiKey = `vtc_live_${crypto.randomBytes(12).toString('hex')}`;
    commit(state);
    res.json({ apiKey: state.apiKey, state });
  });

  // Public API Ingestion Endpoint (authenticated via x-api-key)
  app.post('/api/v1/leads/ingest', (req, res) => {
    const providedKey = req.header('x-api-key') || req.body?.apiKey;
    if (providedKey !== state.apiKey) {
      res.status(401).json({ error: 'Chave de API inválida (x-api-key).' });
      return;
    }

    const { name, company, email, phone, value, tagName, autoFollowUp } =
      req.body ?? {};
    if (!name) {
      res.status(400).json({ error: 'Campo "name" é obrigatório no payload JSON.' });
      return;
    }

    const now = new Date().toISOString();
    const resolvedTagIds: string[] = [];
    if (tagName) {
      const existingTag = state.tags.find(
        (t) => t.name.toLowerCase() === String(tagName).toLowerCase(),
      );
      if (existingTag) {
        resolvedTagIds.push(existingTag.id);
      } else {
        const createdTag: LeadTag = {
          id: `tag-${crypto.randomUUID().slice(0, 6)}`,
          name: String(tagName).trim(),
          color: 'indigo',
        };
        state.tags.push(createdTag);
        resolvedTagIds.push(createdTag.id);
      }
    }

    const newLead: Lead = {
      id: `lead-${crypto.randomUUID().slice(0, 8)}`,
      name: String(name).trim(),
      company: String(company ?? 'API Lead').trim(),
      email: String(email ?? '').trim(),
      phone: normalizeBrazilianPhone(String(phone ?? '')),
      value: Number(value) > 0 ? Math.round(Number(value)) : 12000,
      stage: 'prospeccao',
      tagIds: resolvedTagIds,
      source: 'api',
      owner: 'Automação API',
      nextFollowUpAt: new Date(Date.now() + 3600000).toISOString(),
      createdAt: now,
      updatedAt: now,
    };

    const apiEvt: InteractionEvent = {
      id: `evt-${crypto.randomUUID().slice(0, 8)}`,
      leadId: newLead.id,
      channel: 'api',
      direction: 'system',
      summary: 'Ingestão via API REST (/api/v1/leads/ingest)',
      content: `Lead recebido via integração externa com valor estimado de R$ ${newLead.value}.`,
      createdAt: now,
      author: 'API Pública Vértice',
    };

    state.leads = [newLead, ...state.leads];
    state.interactions = [apiEvt, ...state.interactions];
    recordWebhookTrigger('lead.created');

    if (autoFollowUp !== false) {
      for (const wf of state.workflows.filter((w) => w.active && w.trigger === 'api_ingest')) {
        const wfEvts = runWorkflowOnLead(wf, newLead);
        state.interactions = [...wfEvts, ...state.interactions];
      }
    }

    commit(state);
    res.status(201).json({
      ok: true,
      lead: newLead,
      state,
    });
  });

  // --- Dashboard Customization & Automated Reports ---

  app.patch('/api/dashboard/widgets', (req, res) => {
    const { widgets } = req.body ?? {};
    if (!Array.isArray(widgets)) {
      res.status(400).json({ error: 'Lista de widgets inválida.' });
      return;
    }
    state.dashboardWidgets = widgets as DashboardWidgetConfig[];
    commit(state);
    res.json({ state });
  });

  app.post('/api/reports/generate', (req, res) => {
    const { periodLabel, title } = req.body ?? {};
    const metrics = calculateFunnelMetrics(state.leads, state.interactions);
    const now = new Date().toISOString();

    const report = {
      id: `rep-${crypto.randomUUID().slice(0, 6)}`,
      title:
        String(title ?? '').trim() ||
        `Relatório Automático de Desempenho — ${periodLabel || 'Últimos 30 dias'}`,
      periodLabel: String(periodLabel || 'Últimos 30 dias'),
      generatedAt: now,
      totalLeads: metrics.totalLeads,
      pipelineValue: metrics.activePipelineValue,
      wonValue: metrics.wonValue,
      conversionRate: metrics.conversionRate,
      whatsappSent: state.whatsapp.totalSent,
      emailOpenRate: state.emailMarketing.openRate,
      scheduleRule: state.reportSchedule.enabled
        ? `Automático · ${state.reportSchedule.frequency}`
        : 'Sob demanda',
    };

    state.reports = [report, ...state.reports];
    commit(state);
    res.status(201).json({ report, state });
  });

  app.patch('/api/reports/schedule', (req, res) => {
    state.reportSchedule = {
      ...state.reportSchedule,
      ...(req.body as Partial<ReportSchedule>),
    };
    commit(state);
    res.json({ state });
  });

  // --- Vite / Static Frontend ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vértice CRM server running on http://localhost:${PORT}`);
  });
}

startServer();
