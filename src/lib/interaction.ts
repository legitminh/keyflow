import { untrack } from 'svelte';

/** The independent interaction channels of a control. Cursor contact and focus may overlap a press; hover is a legacy controller channel. */
export type InteractionKind = 'press' | 'cursor' | 'hover' | 'focus';
export type InteractionSource = 'pointer' | 'keyboard' | 'virtual' | 'programmatic';
export type InteractionExitReason = 'completed' | 'cancelled' | 'reset' | 'disabled' | 'unmounted' | 'frame-change' | 'unregistered';
export interface InteractionDetails {
  kind?: InteractionKind;
  source?: InteractionSource;
  key?: string;
  code?: string;
  original_event?: Event;
  pointer_type?: string;
  pointer_id?: number;
}
export interface InteractionEvent {
  phase: 'enter' | 'exit';
  kind: InteractionKind;
  source: InteractionSource;
  key?: string;
  code?: string;
  original_event?: Event;
  pointer_type?: string;
  pointer_id?: number;
  /** Monotonic timestamps and elapsed time in milliseconds, independent of display animations. */
  started_at: number;
  ended_at?: number;
  duration_ms: number;
  cancelled: boolean;
  reason?: InteractionExitReason;
}
export interface InteractionHandlers {
  on_pressed_down?: (event: InteractionEvent) => void;
  on_pressed_up?: (event: InteractionEvent) => void;
  on_cursor_enter?: (event: InteractionEvent) => void;
  on_cursor_exit?: (event: InteractionEvent) => void;
  /** @deprecated Use the specific press/cursor callbacks. Also observes native focus. */
  on_enter?: (event: InteractionEvent) => void;
  /** @deprecated Use the specific press/cursor callbacks. Also observes native focus. */
  on_exit?: (event: InteractionEvent) => void;
}

/** Reusable without the DOM, Svelte components, or Keyflow's routing. Repeats are idempotent. */
export function create_interaction(
  handlers: InteractionHandlers | (() => InteractionHandlers) = {},
  { now = () => performance.now() }: { now?: () => number } = {}
) {
  const sessions = new Map<InteractionKind, InteractionEvent>();
  const callbacks = () => typeof handlers === 'function' ? handlers() : handlers;
  const notify = (event: InteractionEvent) => untrack(() => {
    const current = callbacks();
    const handler = event.kind === 'press'
      ? event.phase === 'enter' ? current.on_pressed_down : current.on_pressed_up
      : event.kind === 'cursor' || event.kind === 'hover'
        ? event.phase === 'enter' ? current.on_cursor_enter : current.on_cursor_exit
        : undefined;
    (handler ?? (event.phase === 'enter' ? current.on_enter : current.on_exit))?.(event);
  });
  const controller = {
    has(kind: InteractionKind = 'press') { return sessions.has(kind); },
    enter(details: InteractionDetails = {}) {
      const kind = details.kind ?? 'press';
      if (sessions.has(kind)) return;
      const event: InteractionEvent = { ...details, kind, source: details.source ?? 'programmatic',
        phase: 'enter', started_at: now(), duration_ms: 0, cancelled: false };
      // Record before callbacks so reentrant cleanup always sees the live session.
      sessions.set(kind, event);
      notify({ ...event });
    },
    exit(kind: InteractionKind = 'press', reason: InteractionExitReason = 'completed', original_event?: Event) {
      const start = sessions.get(kind);
      if (!start) return;
      sessions.delete(kind);
      const ended_at = now();
      const event: InteractionEvent = { ...start, phase: 'exit', ended_at,
        duration_ms: Math.max(0, ended_at - start.started_at), cancelled: reason !== 'completed', reason,
        original_event: original_event ?? start.original_event };
      notify(event);
      return event;
    },
    cancel(reason: Exclude<InteractionExitReason, 'completed'> = 'cancelled') {
      // Snapshot: callbacks may start new sessions, which belong to the next interaction.
      for (const [kind, session] of [...sessions]) {
        if (sessions.get(kind) === session) controller.exit(kind, reason);
      }
    }
  };
  return controller;
}
export type InteractionController = ReturnType<typeof create_interaction>;

const interactions = new WeakMap<object, InteractionController>();
/** Shared by routed shortcuts and the DOM control for a token. Callbacks stay live. */
export function input_token_interaction(token: InteractionHandlers): InteractionController {
  let controller = interactions.get(token);
  if (!controller) interactions.set(token, controller = create_interaction(() => token));
  return controller;
}
