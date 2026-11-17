import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoMapSpreadsheetColumns,
  buildWhatsAppWebUrl,
  calculateFunnelMetrics,
  evaluateFollowUpEligibility,
  filterLeads,
  interpolateTemplate,
  normalizeBrazilianPhone,
  parseCurrencyInput,
  parseMappedRowsToLeads,
} from './crmLogic';
import type { FollowUpFlow, InteractionEvent, Lead, LeadTag } from '../types/crm';

const SAMPLE_TAGS: LeadTag[] = [
  { id: 'tag-vip', name: 'VIP Enterprise', color: 'teal' },
  { id: 'tag-inbound', name: 'Inbound Site', color: 'indigo' },
];

const SAMPLE_LEADS: Lead[] = [
  {
    id: 'l1',
    name: 'Mariana Costa',
    company: 'Grupo Vanguarda',
    email: 'mariana@vanguarda.com.br',
    phone: '5511998765432',
    value: 45000,
    stage: 'negociacao',
    tagIds: ['tag-vip'],
    source: 'manual',
    owner: 'Camila Rocha',
    nextFollowUpAt: '2026-11-17T10:00:00Z',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-15T10:00:00Z',
  },
  {
    id: 'l2',
    name: 'Rafael Mendes',
    company: 'LogiTech Sul',
    email: 'rafael@logitechsul.com.br',
    phone: '5541987654321',
    value: 28000,
    stage: 'fechado',
    tagIds: ['tag-inbound'],
    source: 'planilha',
    owner: 'Camila Rocha',
    createdAt: '2026-11-08T10:00:00Z',
    updatedAt: '2026-11-14T10:00:00Z',
  },
];

test('normalizeBrazilianPhone adds DDI 55 to 11-digit DDD numbers', () => {
  assert.equal(normalizeBrazilianPhone('(11) 99876-5432'), '5511998765432');
  assert.equal(normalizeBrazilianPhone('+55 21 98888-1111'), '5521988881111');
  assert.equal(normalizeBrazilianPhone(''), '');
});

test('interpolateTemplate replaces dynamic Portuguese variables accurately', () => {
  const msg = interpolateTemplate(
    'Olá {{primeiro_nome}} da {{empresa}}, sua proposta de {{valor}} está em {{etapa}}.',
    SAMPLE_LEADS[0],
  );
  assert.equal(
    msg,
    'Olá Mariana da Grupo Vanguarda, sua proposta de R$ 45.000 está em Negociação.',
  );
});

test('buildWhatsAppWebUrl creates properly encoded wa.me URL', () => {
  const url = buildWhatsAppWebUrl('(11) 99876-5432', 'Olá Mariana!');
  assert.equal(url, 'https://wa.me/5511998765432?text=Ol%C3%A1%20Mariana!');
});

test('autoMapSpreadsheetColumns matches Portuguese and English headers', () => {
  const mapping = autoMapSpreadsheetColumns([
    'Nome Completo',
    'Empresa',
    'WhatsApp',
    'E-mail Corporativo',
    'Valor Estimado',
    'Etiqueta',
  ]);
  assert.equal(mapping.name, 'Nome Completo');
  assert.equal(mapping.company, 'Empresa');
  assert.equal(mapping.phone, 'WhatsApp');
  assert.equal(mapping.email, 'E-mail Corporativo');
  assert.equal(mapping.value, 'Valor Estimado');
  assert.equal(mapping.tag, 'Etiqueta');
});

test('parseCurrencyInput handles Brazilian R$ formatting', () => {
  assert.equal(parseCurrencyInput('R$ 12.500,00'), 12500);
  assert.equal(parseCurrencyInput('8400,50'), 8401);
  assert.equal(parseCurrencyInput(19000), 19000);
});

test('parseMappedRowsToLeads deduplicates existing phones and validates required fields', () => {
  const existingPhones = new Set(['5511998765432']);
  const rows = [
    { Nome: 'Duplicado', Zap: '11998765432', Empresa: 'X', Valor: '1000' },
    { Nome: 'Novo Lead', Zap: '21999112233', Empresa: 'Atlas BR', Valor: 'R$ 15.000,00', Tag: 'VIP Enterprise, Novo Segmento' },
    { Nome: '', Zap: '', Empresa: 'Inválido' },
  ];
  const result = parseMappedRowsToLeads(
    rows,
    { name: 'Nome', phone: 'Zap', company: 'Empresa', value: 'Valor', tag: 'Tag' },
    existingPhones,
    SAMPLE_TAGS,
  );

  assert.equal(result.skippedDuplicates, 1);
  assert.equal(result.invalidCount, 1);
  assert.equal(result.validLeads.length, 1);
  assert.equal(result.validLeads[0].phone, '5521999112233');
  assert.equal(result.validLeads[0].value, 15000);
  assert.deepEqual(result.validLeads[0].tagIds, ['tag-vip']);
  assert.deepEqual(result.discoveredTagNames, ['Novo Segmento']);
});

test('calculateFunnelMetrics computes conversion rate, active pipeline, and channel totals', () => {
  const interactions: InteractionEvent[] = [
    {
      id: 'i1',
      leadId: 'l1',
      channel: 'whatsapp',
      direction: 'outbound',
      summary: 'Envio de apresentação',
      content: 'Olá!',
      createdAt: '2026-11-15T12:00:00Z',
      author: 'Camila Rocha',
    },
    {
      id: 'i2',
      leadId: 'l2',
      channel: 'email',
      direction: 'outbound',
      summary: 'Follow-up E-mail',
      content: 'Case enviado',
      createdAt: '2026-11-15T14:00:00Z',
      author: 'Automação',
    },
  ];
  const metrics = calculateFunnelMetrics(SAMPLE_LEADS, interactions);
  assert.equal(metrics.totalLeads, 2);
  assert.equal(metrics.activePipelineValue, 45000);
  assert.equal(metrics.wonValue, 28000);
  assert.equal(metrics.conversionRate, 50);
  assert.equal(metrics.whatsappEventsCount, 1);
  assert.equal(metrics.emailEventsCount, 1);
});

test('filterLeads and evaluateFollowUpEligibility filter accurately', () => {
  const filtered = filterLeads(SAMPLE_LEADS, {
    query: 'vanguarda',
    tagId: 'tag-vip',
    stage: 'all',
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 'l1');

  const flow: FollowUpFlow = {
    id: 'f1',
    name: 'Boas-vindas VIP',
    description: 'Fluxo teste',
    active: true,
    trigger: 'lead_created',
    targetTagId: 'tag-vip',
    steps: [],
    executionsCount: 0,
  };
  const eligible = evaluateFollowUpEligibility(flow, SAMPLE_LEADS);
  assert.equal(eligible.length, 1);
  assert.equal(eligible[0].id, 'l1');
});
