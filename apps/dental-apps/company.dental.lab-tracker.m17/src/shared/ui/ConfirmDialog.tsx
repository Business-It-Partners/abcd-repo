import { Loader2 } from 'lucide-react';
import { ClinicModal } from '@/shared/ui/ClinicModal';

interface ConfirmDialogProps {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ title, body, confirmLabel, cancelLabel = 'Cancel', destructive = false, busy = false, confirmDisabled = false, onConfirm, onCancel }: ConfirmDialogProps) {
  return <ClinicModal closeDisabled={busy} onClose={onCancel} title={title} verticalAlign="top">
    <div style={{ fontSize: 'var(--fs-14)', color: 'var(--ink-1)', lineHeight: 1.55 }}>{body}</div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
      <button type="button" onClick={onCancel} disabled={busy} className="btn btn-secondary">{cancelLabel}</button>
      <button type="button" autoFocus={!confirmDisabled} onClick={onConfirm} disabled={busy || confirmDisabled} className={destructive ? 'btn btn-danger' : 'btn btn-primary'}>
        {busy && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}{confirmLabel}
      </button>
    </div>
  </ClinicModal>;
}
