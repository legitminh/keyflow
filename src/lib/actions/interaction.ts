import { create_interaction, type InteractionController, type InteractionHandlers, type InteractionExitReason } from '../interaction.js';

export interface InteractionOptions extends InteractionHandlers {
  controller?: InteractionController;
  disabled?: boolean;
  key?: string;
  /** False lets a custom gesture own the press channel while retaining hover/focus. */
  press?: boolean | 'keyboard';
}

/** Add the same lifecycle to a custom element: use:interaction={{ on_enter, on_exit }}. */
export function interaction(element: HTMLElement, initial: InteractionOptions = {}) {
  let options = initial;
  let controller = options.controller ?? create_interaction(() => options);
  let pointer: number | undefined;
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
  const enter = (kind: 'hover' | 'focus' | 'press', source: 'pointer' | 'keyboard', event: Event) => {
    if (enabled()) controller.enter({ kind, source, key: options.key, original_event: event });
  };
  const cancel = (reason: InteractionExitReason) => {
    pointer = undefined;
    keyboard = undefined;
    keyboardClick = false;
    clearTimeout(clickTimer);
    controller.cancel(reason === 'completed' ? 'cancelled' : reason);
  };
  listen(element, 'pointerenter', (event: PointerEvent) => {
    if (event.pointerType !== 'touch') enter('hover', 'pointer', event);
  });
  listen(element, 'pointerleave', (event: PointerEvent) => controller.exit('hover', 'completed', event));
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
    if (options.press === false || options.press === 'keyboard' || !enabled() || event.button !== 0 || pointer !== undefined) return;
    pointer = event.pointerId;
    enter('press', 'pointer', event);
  });
  listen(window, 'pointerup', (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = undefined;
    const rect = element.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    controller.exit('press', inside ? 'completed' : 'cancelled', event);
  });
  listen(window, 'pointercancel', (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = undefined;
    controller.exit('press', 'cancelled', event);
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
