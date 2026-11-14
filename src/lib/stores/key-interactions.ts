import type { InteractionController, InteractionExitReason } from '../interaction.js';

/** Pending automatic-route presses, cleared whenever their routing context changes. */
export const held_key_interactions = new Map<string, InteractionController>();
export function cancel_key_interactions(reason: InteractionExitReason = 'reset') {
  const held = [...held_key_interactions.values()];
  held_key_interactions.clear();
  for (const controller of held) controller.exit('press', reason);
}
