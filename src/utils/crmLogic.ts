import type {
  FollowUpFlow,
  FunnelStage,
  FunnelStageId,
  InteractionEvent,
  Lead,
  LeadTag,
  NewLeadInput,
} from '../types/crm';

export const FUNNEL_STAGES: FunnelStage[] = [
  { id: 'prospeccao', label: 'Prospecção', order: 1, accentHex: '#64748B' },
  { id: 'qualificado', label: 'Qualificado', order: 2, accentHex: '#0284C7' },
  { id: 'proposta', label: 'Proposta Enviada', order: 3, accentHex: '#D97706' },
  { id: 'negociacao', label: 'Negociação', order: 4, accentHex: '#0D9488' },
  { id: 'fechado', label: 'Fechado (Ganho)', order: 5, accentHex: '#16A34A' },
];

export function getStageLabel(stageId: FunnelStageId): string {
  const found = FUNNEL_STAGES.find((s) => s.id === stageId);
  if (found) return found.label;
  if (stageId === 'perdido') return 'Perdido';
  return stageId;
}

export function formatCurrencyBRL(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(safe);
}

export function normalizeBrazilianPhone(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

export function formatPhoneDisplay(raw: string): string {
  const digits = normalizeBrazilianPhone(raw);
  if (digits.length === 13 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9, 13);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 8);
    const part2 = digits.slice(8, 12);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }
  return raw || '—';
}

export function interpolateTemplate(
  templateBody: string,
  lead: Pick<Lead, 'name' | 'company' | 'value' | 'stage'>,
): string {
  const firstName = lead.name.trim().split(/\s+/)[0] || lead.name;
  const stageLabel = getStageLabel(lead.stage);
  const formattedValue = formatCurrencyBRL(lead.value);

  return templateBody
    .replace(/\{\{\s*nome\s*\}\}/gi, lead.name)
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, firstName)
    .replace(/\{\{\s*empresa\s*\}\}/gi, lead.company || 'sua empresa')
    .replace(/\{\{\s*valor\s*\}\}/gi, formattedValue)
    .replace(/\{\{\s*etapa\s*\}\}/gi, stageLabel);
}

export function buildWhatsAppWebUrl(phone: string, message: string): string {
  const normalized = normalizeBrazilianPhone(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}

export type SpreadsheetFieldKey =
  | 'name'
  | 'company'
  | 'email'
  | 'phone'
  | 'value'
  | 'stage'
  | 'tag';

const COLUMN_SYNONYMS: Record<SpreadsheetFieldKey, string[]> = {
  name: ['nome', 'contato', 'lead', 'name', 'cliente', 'responsavel'],
  company: ['empresa', 'companhia', 'company', 'organizacao', 'conta'],
  email: ['email', 'e-mail', 'mail', 'correio'],
  phone: ['telefone', 'whatsapp', 'celular', 'fone', 'phone', 'numero', 'zap'],
  value: ['valor', 'ticket', 'receita', 'value', 'deal', 'orcamento'],
  stage: ['etapa', 'estagio', 'funil', 'stage', 'status'],
  tag: ['etiqueta', 'tag', 'tags', 'segmento', 'categoria'],
};

function normalizeHeaderText(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function autoMapSpreadsheetColumns(
  headers: string[],
): Partial<Record<SpreadsheetFieldKey, string>> {
  const mapping: Partial<Record<SpreadsheetFieldKey, string>> = {};
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    normalized: normalizeHeaderText(h),
  }));

  (Object.keys(COLUMN_SYNONYMS) as SpreadsheetFieldKey[]).forEach((fieldKey) => {
    const synonyms = COLUMN_SYNONYMS[fieldKey];
    const exactMatch = normalizedHeaders.find((h) => synonyms.includes(h.normalized));
    if (exactMatch) {
      mapping[fieldKey] = exactMatch.original;
      return;
    }
    const partialMatch = normalizedHeaders.find((h) =>
      synonyms.some((syn) => h.normalized.includes(syn)),
    );
    if (partialMatch) {
      mapping[fieldKey] = partialMatch.original;
    }
  });

  return mapping;
}

export function parseCurrencyInput(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const text = String(raw ?? '').trim();
  if (!text) return 0;
  // Handle Brazilian currency formats like "R$ 12.500,00" or plain "12500"
  const cleaned = text.replace(/[^\d,.-]/g, '');
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

export function parseStageInput(raw: unknown): FunnelStageId {
  const text = normalizeHeaderText(String(raw ?? ''));
  if (text.includes('qualif')) return 'qualificado';
  if (text.includes('propost')) return 'proposta';
  if (text.includes('negoc')) return 'negociacao';
  if (text.includes('fech') || text.includes('ganh')) return 'fechado';
  if (text.includes('perd')) return 'perdido';
  return 'prospeccao';
}

export function parseMappedRowsToLeads(
  rows: Record<string, unknown>[],
  mapping: Partial<Record<SpreadsheetFieldKey, string>>,
  existingPhones: Set<string>,
  availableTags: LeadTag[],
): {
  validLeads: NewLeadInput[];
  skippedDuplicates: number;
  invalidCount: number;
  discoveredTagNames: string[];
} {
  const validLeads: NewLeadInput[] = [];
  const seenBatchPhones = new Set<string>();
  const discoveredTags = new Set<string>();
  let skippedDuplicates = 0;
  let invalidCount = 0;

  for (const row of rows) {
    const nameCol = mapping.name;
    const phoneCol = mapping.phone;
    const emailCol = mapping.email;
    const companyCol = mapping.company;
    const valueCol = mapping.value;
    const stageCol = mapping.stage;
    const tagCol = mapping.tag;

    const name = nameCol ? String(row[nameCol] ?? '').trim() : '';
    const rawPhone = phoneCol ? String(row[phoneCol] ?? '').trim() : '';
    const email = emailCol ? String(row[emailCol] ?? '').trim() : '';
    const company = companyCol ? String(row[companyCol] ?? '').trim() : '';
    const value = valueCol ? parseCurrencyInput(row[valueCol]) : 0;
    const stage = stageCol ? parseStageInput(row[stageCol]) : 'prospeccao';
    const rawTag = tagCol ? String(row[tagCol] ?? '').trim() : '';

    const normalizedPhone = normalizeBrazilianPhone(rawPhone);
    if (!name || (!normalizedPhone && !email)) {
      invalidCount += 1;
      continue;
    }

    if (
      normalizedPhone &&
      (existingPhones.has(normalizedPhone) || seenBatchPhones.has(normalizedPhone))
    ) {
      skippedDuplicates += 1;
      continue;
    }

    if (normalizedPhone) {
      seenBatchPhones.add(normalizedPhone);
    }

    const matchedTagIds: string[] = [];
    if (rawTag) {
      const splitTags = rawTag
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter(Boolean);
      for (const tagName of splitTags) {
        const existingTag = availableTags.find(
          (t) => t.name.toLowerCase() === tagName.toLowerCase(),
        );
        if (existingTag) {
          matchedTagIds.push(existingTag.id);
        } else {
          discoveredTags.add(tagName);
        }
      }
    }

    validLeads.push({
      name,
      company: company || 'Conta Importada',
      email,
      phone: normalizedPhone,
      value,
      stage,
      tagIds: matchedTagIds,
      source: 'planilha',
    });
  }

  return {
    validLeads,
    skippedDuplicates,
    invalidCount,
    discoveredTagNames: Array.from(discoveredTags),
  };
}

export interface LeadFilters {
  query: string;
  tagId: string;
  stage: FunnelStageId | 'all';
}

export function filterLeads(leads: Lead[], filters: LeadFilters): Lead[] {
  const q = filters.query.trim().toLowerCase();
  return leads.filter((lead) => {
    if (filters.stage !== 'all' && lead.stage !== filters.stage) {
      return false;
    }
    if (filters.tagId !== 'all' && !lead.tagIds.includes(filters.tagId)) {
      return false;
    }
    if (!q) return true;
    return (
      lead.name.toLowerCase().includes(q) ||
      lead.company.toLowerCase().includes(q) ||
      lead.email.toLowerCase().includes(q) ||
      lead.phone.toLowerCase().includes(q)
    );
  });
}

export interface StageBreakdown {
  stage: FunnelStage;
  count: number;
  totalValue: number;
  percentageOfLeads: number;
}

export interface FunnelMetrics {
  totalLeads: number;
  activePipelineValue: number;
  wonValue: number;
  wonCount: number;
  conversionRate: number;
  followUpPendingCount: number;
  whatsappEventsCount: number;
  emailEventsCount: number;
  byStage: StageBreakdown[];
}

export function calculateFunnelMetrics(
  leads: Lead[],
  interactions: InteractionEvent[],
): FunnelMetrics {
  const nonLost = leads.filter((l) => l.stage !== 'perdido');
  const wonLeads = leads.filter((l) => l.stage === 'fechado');
  const activeLeads = leads.filter(
    (l) => l.stage !== 'fechado' && l.stage !== 'perdido',
  );

  const activePipelineValue = activeLeads.reduce((sum, l) => sum + l.value, 0);
  const wonValue = wonLeads.reduce((sum, l) => sum + l.value, 0);
  const totalLeads = leads.length;
  const conversionRate =
    totalLeads > 0 ? Number(((wonLeads.length / totalLeads) * 100).toFixed(1)) : 0;

  const followUpPendingCount = activeLeads.filter((l) =>
    Boolean(l.nextFollowUpAt),
  ).length;

  const whatsappEventsCount = interactions.filter(
    (i) => i.channel === 'whatsapp',
  ).length;
  const emailEventsCount = interactions.filter(
    (i) => i.channel === 'email',
  ).length;

  const byStage: StageBreakdown[] = FUNNEL_STAGES.map((stage) => {
    const stageLeads = leads.filter((l) => l.stage === stage.id);
    const stageValue = stageLeads.reduce((sum, l) => sum + l.value, 0);
    const pct =
      nonLost.length > 0
        ? Math.round((stageLeads.length / nonLost.length) * 100)
        : 0;
    return {
      stage,
      count: stageLeads.length,
      totalValue: stageValue,
      percentageOfLeads: pct,
    };
  });

  return {
    totalLeads,
    activePipelineValue,
    wonValue,
    wonCount: wonLeads.length,
    conversionRate,
    followUpPendingCount,
    whatsappEventsCount,
    emailEventsCount,
    byStage,
  };
}

export interface MonthlySeriesPoint {
  monthLabel: string;
  forecastValue: number;
  closedValue: number;
}

export function calculateMonthlyRevenueSeries(
  leads: Lead[],
): MonthlySeriesPoint[] {
  const wonTotal = leads
    .filter((l) => l.stage === 'fechado')
    .reduce((sum, l) => sum + l.value, 0);
  const activeTotal = leads
    .filter((l) => l.stage !== 'fechado' && l.stage !== 'perdido')
    .reduce((sum, l) => sum + l.value, 0);

  const baseMonths = [
    { monthLabel: 'Jun', fMult: 0.62, cMult: 0.48 },
    { monthLabel: 'Jul', fMult: 0.71, cMult: 0.56 },
    { monthLabel: 'Ago', fMult: 0.78, cMult: 0.64 },
    { monthLabel: 'Set', fMult: 0.85, cMult: 0.74 },
    { monthLabel: 'Out', fMult: 0.93, cMult: 0.86 },
    { monthLabel: 'Nov', fMult: 1.0, cMult: 1.0 },
  ];

  const currentForecast = Math.max(activeTotal + wonTotal, 45000);
  const currentClosed = Math.max(wonTotal, 18000);

  return baseMonths.map((m) => ({
    monthLabel: m.monthLabel,
    forecastValue: Math.round(currentForecast * m.fMult),
    closedValue: Math.round(currentClosed * m.cMult),
  }));
}

export function evaluateFollowUpEligibility(
  flow: FollowUpFlow,
  leads: Lead[],
): Lead[] {
  return leads.filter((lead) => {
    if (lead.stage === 'fechado' || lead.stage === 'perdido') return false;
    if (flow.targetTagId && !lead.tagIds.includes(flow.targetTagId)) {
      return false;
    }
    if (flow.trigger === 'spreadsheet_import') {
      return lead.source === 'planilha';
    }
    if (flow.trigger === 'api_ingest') {
      return lead.source === 'api';
    }
    if (flow.trigger === 'stage_qualificado') {
      return lead.stage === 'qualificado';
    }
    return true;
  });
}
