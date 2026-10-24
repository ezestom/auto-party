"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ChevronUp, Music, X } from 'lucide-react';
interface LibraryDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    triggerRef: RefObject<HTMLButtonElement | null>;
    children: ReactNode;
}
const subscribe = () => () => { };
export default function LibraryDrawer({ open, onOpenChange, triggerRef, children }: LibraryDrawerProps) {
    const mounted = useSyncExternalStore(subscribe, () => true, () => false);
    const panel = useRef<HTMLElement>(null), handle = useRef<HTMLButtonElement>(null);
    const gesture = useRef<{
        y: number;
        base: number;
        limit: number;
        offset: number;
        clipRatio: number;
        moved: boolean;
    } | null>(null), suppressClick = useRef(false);
    const [drag, setDrag] = useState<{
        offset: number;
        clip: number;
    } | null>(null);
    const collapsedOffset = () => {
        if (!panel.current)
            return 0;
        const style = getComputedStyle(panel.current);
        return Math.max(0, panel.current.offsetHeight - parseFloat(style.getPropertyValue('--library-peek')) - parseFloat(style.getPropertyValue('--library-footer')));
    };
    useEffect(() => {
        if (!open || !mounted)
            return;
        const shell = document.querySelector<HTMLElement>('.console-shell'), returnTarget = triggerRef.current;
        const wasInert = shell?.inert || false, hidden = shell?.getAttribute('aria-hidden');
        handle.current?.focus({ preventScroll: true });
        if (shell) {
            shell.inert = true;
            shell.setAttribute('aria-hidden', 'true');
        }
        const key = (event: KeyboardEvent) => {
            if (document.querySelector('[role="dialog"]:not(#media-library-drawer),[role="alertdialog"]')) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onOpenChange(false);
                return;
            }
            if (event.key !== 'Tab')
                return;
            const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || []).filter(item => item.getClientRects().length && !item.closest('[inert]'));
            const first = items[0], last = items.at(-1);
            if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) {
                event.preventDefault();
                last?.focus();
            }
            else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) {
                event.preventDefault();
                first?.focus();
            }
        };
        document.addEventListener('keydown', key, true);
        return () => {
            document.removeEventListener('keydown', key, true);
            if (shell) {
                shell.inert = wasInert;
                if (hidden === null || hidden === undefined)
                    shell.removeAttribute('aria-hidden');
                else
                    shell.setAttribute('aria-hidden', hidden);
            }
            if (returnTarget?.isConnected)
                returnTarget.focus({ preventScroll: true });
        };
    }, [open, mounted, onOpenChange, triggerRef]);
    const finish = () => {
        const current = gesture.current;
        gesture.current = null;
        if (current?.moved) {
            const offset = current.offset;
            const distance = offset - current.base;
            onOpenChange(Math.abs(distance) > 30 ? distance < 0 : offset < current.limit / 2);
        }
        setDrag(null);
    };
    const layer = <>
    {open && <div className="library-drawer-overlay" aria-hidden="true" onClick={() => onOpenChange(false)}/>}
    <aside ref={panel} id="media-library-drawer" className="library-drawer" data-open={open} data-dragging={drag !== null} role={open ? 'dialog' : undefined} aria-modal={open || undefined} aria-label={open ? 'Media library' : undefined} style={drag === null ? undefined : { transform: 'translateY(' + drag.offset + 'px)', clipPath: 'inset(0 0 ' + drag.clip + 'px 0 round 12px 12px 0 0)' }}>
      <button ref={handle} className="library-sheet-handle" type="button" aria-label={open ? 'Close library' : 'Open media library'} aria-expanded={open} aria-controls="library-sheet-body" onClick={() => { if (!suppressClick.current) {
        if (!open)
            triggerRef.current = handle.current;
        onOpenChange(!open);
    } }} onKeyDown={() => { suppressClick.current = false; }} onPointerDown={event => { if (event.button !== 0)
        return; if (!open)
        triggerRef.current = handle.current; const limit = collapsedOffset(); const style = getComputedStyle(panel.current!); const base = Math.max(0, Math.min(limit, new DOMMatrixReadOnly(style.transform).m42)); const clipRatio = (panel.current!.offsetHeight - event.currentTarget.offsetHeight) / Math.max(1, limit); gesture.current = { y: event.clientY, base, limit, offset: base, clipRatio, moved: false }; suppressClick.current = false; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={event => { const current = gesture.current; if (!current)
        return; const distance = event.clientY - current.y; if (Math.abs(distance) > 6) {
        current.moved = true;
        suppressClick.current = true;
    } if (current.moved) {
        current.offset = Math.max(0, Math.min(current.limit, current.base + distance));
        setDrag({ offset: current.offset, clip: current.offset * current.clipRatio });
    } }} onPointerUp={finish} onPointerCancel={() => { gesture.current = null; setDrag(null); suppressClick.current = true; }}>
        <span className="library-sheet-grip" aria-hidden="true"/><span className="library-sheet-title"><Music size={13}/>Media library</span>
        <span className="library-sheet-hint">{open ? 'Drag down or click to close' : 'Drag up or click to browse'}</span>{open ? <X size={16}/> : <ChevronUp size={16}/>}
      </button>
      <div id="library-sheet-body" className="library-drawer-body" inert={!open} aria-hidden={!open}>{children}</div>
    </aside>
  </>;
    return <><div className="library-dock-space" aria-hidden="true"/>{mounted && createPortal(layer, document.body)}</>;
}
