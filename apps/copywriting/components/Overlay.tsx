import React, { useEffect, useId, useRef } from 'react';

type OverlayProps = {
  open: boolean;
  title: string;
  description?: string;
  kind?: 'drawer' | 'sheet' | 'dialog';
  onClose: () => void;
  returnFocus?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'summary',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export const Overlay: React.FC<OverlayProps> = ({
  open,
  title,
  description,
  kind = 'drawer',
  onClose,
  returnFocus = true,
  children,
  footer,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusEnabledRef = useRef(returnFocus);

  useEffect(() => {
    onCloseRef.current = onClose;
    returnFocusEnabledRef.current = returnFocus;
  }, [onClose, returnFocus]);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable || panel)?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = (Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)) as HTMLElement[])
        .filter(element => (
          !element.hasAttribute('hidden')
          && element.getAttribute('aria-hidden') !== 'true'
          && element.getClientRects().length > 0
        ));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (returnFocusEnabledRef.current) {
        window.setTimeout(() => returnFocusRef.current?.focus(), 0);
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="overlay" data-kind={kind}>
      <button
        className="overlay__scrim"
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="overlay__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label={`Close ${title}`}>
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className="overlay__body">{children}</div>
        {footer ? <footer className="overlay__footer">{footer}</footer> : null}
      </div>
    </div>
  );
};
