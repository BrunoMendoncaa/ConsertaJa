import { ActionForm, SubmitButton } from '@/components/ui/action-form';
import { Field } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { changeStatus } from '@/features/service-orders/actions';
import { MANUAL_TRANSITIONS, OS_STATUS, MANAGER_ROLES } from '@/lib/constants';
import { formatBRL } from '@/lib/money';

/** Mudança de status: só mostra as transições que o papel pode fazer. */
export function StatusPanel({ order, role, balance }) {
  const options = (MANUAL_TRANSITIONS[order.status] || []).filter((t) => t.roles.includes(role));
  const canCancel = MANAGER_ROLES.includes(role) && !['ENTREGUE', 'CANCELADO'].includes(order.status);
  const hints = {
    EM_DIAGNOSTICO: 'Para pedir aprovação, monte e envie o orçamento: o status muda sozinho.',
    AGUARDANDO_APROVACAO: 'Aguardando o cliente aprovar ou recusar o orçamento (portal, balcão ou telefone).',
    EM_MANUTENCAO: 'Antes de concluir, descreva a solução aplicada em "Diagnóstico e solução".',
    PRONTO: 'Na retirada, registre "Entregue": o prazo da garantia começa hoje e o certificado abre pronto para imprimir.',
  };

  return (
    <div className="space-y-4">
      {hints[order.status] && <p className="text-sm text-slate-500">{hints[order.status]}</p>}

      {order.status === 'PRONTO' && balance?.balance_due > 0 && (
        <Alert variant="warning" title="Saldo em aberto">
          Faltam {formatBRL(balance.balance_due)} de {formatBRL(balance.approved_total)}. Registre o pagamento antes de entregar, se for o caso.
        </Alert>
      )}

      {options.length > 0 && (
        <ActionForm action={changeStatus.bind(null, order.id)} className="space-y-3">
          <Field label="Próximo passo" name="to">
            <Select id="to" name="to" defaultValue={options[0].to}>
              {options.map((o) => <option key={o.to} value={o.to}>{o.label} → {OS_STATUS[o.to].label}</option>)}
            </Select>
          </Field>
          <Field label="Nota (aparece na linha do tempo do cliente)" name="note">
            <Textarea id="note" name="note" rows={2} placeholder="Opcional" />
          </Field>
          <SubmitButton pendingText="Atualizando...">Atualizar status</SubmitButton>
        </ActionForm>
      )}

      {canCancel && (
        <details className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-red-700">Cancelar OS</summary>
          <ActionForm action={changeStatus.bind(null, order.id)} className="mt-3 space-y-3" confirm="Cancelar esta OS? Orçamentos em aberto também serão cancelados.">
            <input type="hidden" name="to" value="CANCELADO" />
            <Field label="Motivo do cancelamento" name="note">
              <Textarea id="cancel_note" name="note" rows={2} required />
            </Field>
            <SubmitButton variant="danger" size="sm">Cancelar OS</SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
