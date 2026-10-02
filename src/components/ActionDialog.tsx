'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';

type ActionDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
};

export function ActionDialog({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: ActionDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!busy) onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)'
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background: 'rgba(3, 5, 14, .78)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onKeyDown={handleKeyDown}
        className="card"
        style={{ width: 'min(100%, 440px)', borderRadius: 8, padding: 24 }}
      >
        <h2 id={titleId} className="h2">{title}</h2>
        <p id={messageId} className="muted" style={{ lineHeight: 1.6, margin: '12px 0 24px' }}>
          {message}
        </p>
        <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {onConfirm && (
            <button ref={cancelRef} className="btn ghost" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </button>
          )}
          <button
            ref={onConfirm ? undefined : cancelRef}
            className={'btn ' + (destructive ? 'danger' : '')}
            onClick={onConfirm ?? onClose}
            disabled={busy}
          >
            {busy ? <><span className="spinner" /> Working…</> : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}