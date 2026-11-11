import { getContext, setContext } from 'svelte';
import { root_input_frame, type InputFrameController } from './input-frames.js';
const context = Symbol('keyflow-input-frame');
export const get_input_frame = (): InputFrameController => getContext(context) ?? root_input_frame;
export const provide_input_frame = (frame: InputFrameController) => setContext(context, frame);
