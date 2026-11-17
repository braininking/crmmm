import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { FUNNEL_STAGES } from '../utils/crmLogic';
import type { FunnelStageId, LeadTag } from '../types/crm';

interface NewLeadModalProps {
  open: boolean;
  tags: LeadTag[];
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    company: string;
    email: string;
    phone: string;
    value: number;
    stage: FunnelStageId;
    tagIds: string[];
    runAutoFlows: boolean;
  }) => Promise<void>;
}

export function NewLeadModal({
  open,
  tags,
  onClose,
  onSubmit,
}: NewLeadModalProps) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [value, setValue] = useState('15000');
  const [stage, setStage] = useState<FunnelStageId>('prospeccao');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [runAutoFlows, setRunAutoFlows] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  function toggleTag(tagId: string) {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Informe o nome completo do contato.');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError('Informe pelo menos o número de WhatsApp ou o e-mail.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        company: company.trim(),
        email: email.trim(),
        phone: phone.trim(),
        value: Number(value) || 0,
        stage,
        tagIds: selectedTags,
        runAutoFlows,
      });
      setName('');
      setCompany('');
      setEmail('');
      setPhone('');
      setValue('15000');
      setSelectedTags([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar contato.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-lead-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id="new-lead-modal-title"
            className="font-display text-base font-semibold text-slate-900"
          >
            Adicionar Novo Contato ao Funil
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de novo contato"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-name-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Nome do Contato *
              </label>
              <input
                id="lead-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Bruno Azevedo"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="lead-company-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Empresa
              </label>
              <input
                id="lead-company-input"
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Azevedo Tech"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-phone-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                WhatsApp (com DDD)
              </label>
              <input
                id="lead-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-8888"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="lead-email-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                E-mail Corporativo
              </label>
              <input
                id="lead-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="bruno@empresa.com.br"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lead-value-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Valor Estimado (R$)
              </label>
              <input
                id="lead-value-input"
                type="number"
                min="0"
                step="100"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="lead-stage-select"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Etapa Inicial do Funil
              </label>
              <select
                id="lead-stage-select"
                value={stage}
                onChange={(e) => setStage(e.target.value as FunnelStageId)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-700 focus:outline-none"
              >
                {FUNNEL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Etiquetas Personalizadas
            </span>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                      active
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={runAutoFlows}
              onChange={(e) => setRunAutoFlows(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
            />
            <span>
              Iniciar fluxo automático de boas-vindas (WhatsApp Web e E-mail)
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-md border border-slate-200 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-md"
            >
              {submitting ? 'Salvando...' : 'Salvar Contato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
