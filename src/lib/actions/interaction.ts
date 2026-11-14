import { create_interaction, type InteractionController, type InteractionHandlers, type InteractionExitReason } from '../interaction.js';

// All controls share one hit-test result for each dispatched pointer event.
const pointerTargets = new WeakMap<PointerEvent, Element | null>();

export interface InteractionOptions extends InteractionHandlers {
  controller?: InteractionController;
  disabled?: boolean;
  key?: string;
  /** False lets a custom gesture own the press channel while retaining cursor/focus. */
  press?: boolean | 'keyboard';
}

/** Add the same lifecycle to a custom element: use:interaction={{ on_pressed_down, on_pressed_up, on_cursor_enter, on_cursor_exit }}. */
export function interaction(element: HTMLElement, initial: InteractionOptions = {}) {
  let options = initial;
  let controller = options.controller ?? create_interaction(() => options);
  let pointer: number | undefined;
  const cursors = new Set<number>();
  let keyboard: string | undefined;
  let pendingBlur: (() => void) | undefined;
  let keyboardClick = false;
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners: (() => void)[] = [];
  const listen = <E extends Event>(target: EventTarget, name: string, handler: (event: E) => void) => {
    const listener = handler as EventListener;
    target.addEventListener(name, listener);
    listeners.push(() => target.removeEventListener(name, listener));
  };
  const enabled = () => !options.disabled && !element.matches(':disabled');
  const enter = (kind: 'cursor' | 'focus' | 'press', source: 'pointer' | 'keyboard', event: Event) => {
    if (enabled()) controller.enter({ kind, source, key: options.key, original_event: event,
      ...(event instanceof PointerEvent ? { pointer_type: event.pointerType, pointer_id: event.pointerId } : {}) });
  };
  const cancel = (reason: InteractionExitReason) => {
    pointer = undefined;
    cursors.clear();
    keyboard = undefined;
    keyboardClick = false;
    clearTimeout(clickTimer);
    controller.cancel(reason === 'completed' ? 'cancelled' : reason);
  };
  const cursor = (event: PointerEvent, inside: boolean, reason: InteractionExitReason = 'completed') => {
    if (inside && enabled()) {
      const first = cursors.size === 0;
      cursors.add(event.pointerId);
      if (first) enter('cursor', 'pointer', event);
    } else if (cursors.delete(event.pointerId) && !cursors.size) {
      controller.exit('cursor', reason, event);
    }
  };
  const hit = (event: PointerEvent) => {
    if (!pointerTargets.has(event)) pointerTargets.set(event, document.elementFromPoint(event.clientX, event.clientY));
    const target = pointerTargets.get(event);
    return !!target && element.contains(target);
  };
  listen(element, 'pointerenter', (event: PointerEvent) => {
    if (event.pointerType !== 'touch') cursor(event, true);
  });
  listen(element, 'pointerleave', (event: PointerEvent) => {
    if (event.pointerType !== 'touch') cursor(event, false);
  });
  // Touch implicitly captures its original target. Hit-test movement so contacts
  // can leave and enter neighboring controls without releasing that capture.
  listen(window, 'pointerdown', (event: PointerEvent) => {
    if (event.pointerType === 'touch') cursor(event, hit(event));
  });
  listen(window, 'pointermove', (event: PointerEvent) => {
    if (event.pointerType === 'touch') cursor(event, hit(event));
  });
  listen(element, 'focus', (event: FocusEvent) => {
    const finish = pendingBlur;
    pendingBlur = undefined;
    finish?.();
    enter('focus', 'keyboard', event);
  });
  listen(element, 'blur', (event: FocusEvent) => {
    const finish = () => {
      if (!element.isConnected) return cancel('unmounted');
      keyboard = undefined;
      controller.exit('press', 'cancelled', event);
      controller.exit('focus', 'completed', event);
    };
    // Removing a focused node can blur it before it is disconnected. Let teardown
    // own cancellation, and avoid invoking application state updates mid-removal.
    if (event.relatedTarget === null) {
      pendingBlur = finish;
      queueMicrotask(() => {
        if (pendingBlur !== finish) return;
        pendingBlur = undefined;
        finish();
      });
    } else finish();
  });
  listen(element, 'pointerdown', (event: PointerEvent) => {
    if (event.pointerType === 'touch') cursor(event, true);
    if (options.press === false || options.press === 'keyboard' || !enabled() || event.button !== 0 || pointer !== undefined) return;
    pointer = event.pointerId;
    enter('press', 'pointer', event);
  });
  listen(window, 'pointerup', (event: PointerEvent) => {
    if (event.pointerId === pointer) {
      pointer = undefined;
      controller.exit('press', hit(event) ? 'completed' : 'cancelled', event);
    }
    if (event.pointerType === 'touch') cursor(event, false);
  });
  listen(window, 'pointercancel', (event: PointerEvent) => {
    if (event.pointerId === pointer) {
      pointer = undefined;
      controller.exit('press', 'cancelled', event);
    }
    cursor(event, false, 'cancelled');
  });
  listen(element, 'lostpointercapture', (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = undefined;
    controller.exit('press', 'cancelled', event);
  });
  listen(element, 'keydown', (event: KeyboardEvent) => {
    if (options.press === false || !enabled() || !['Enter', ' '].includes(event.key) || event.repeat || keyboard) return;
    keyboard = event.key;
    keyboardClick = true;
    clearTimeout(clickTimer);
    enter('press', 'keyboard', event);
  });
  listen(element, 'keyup', (event: KeyboardEvent) => {
    if (event.key !== keyboard) return;
    keyboard = undefined;
    controller.exit('press', 'completed', event);
    clickTimer = setTimeout(() => { keyboardClick = false; }, 0);
  });
  listen(element, 'click', (event: MouseEvent) => {
    if (!enabled() || options.press === false || event.detail !== 0 || keyboardClick || controller.has('press')) return;
    enter('press', 'keyboard', event);
    controller.exit('press', 'completed', event);
  });
  listen(window, 'blur', () => cancel('reset'));
  const visibility = () => { if (document.hidden) cancel('reset'); };
  listen(document, 'visibilitychange', visibility);
  return {
    update(next: InteractionOptions) {
      if (next.controller !== options.controller) {
        cancel('reset');
        controller = next.controller ?? create_interaction(() => options);
      }
      options = next;
      if (options.disabled) cancel('disabled');
    },
    destroy() { pendingBlur = undefined; listeners.forEach((remove) => remove()); cancel('unmounted'); }
  };
}
