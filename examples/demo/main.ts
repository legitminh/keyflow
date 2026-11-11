import { mount } from 'svelte';
import App from './App.svelte';
import StaticDemo from './StaticDemo.svelte';
import StackDemo from './StackDemo.svelte';
import FramesDemo from './FramesDemo.svelte';
import MixedDemo from './MixedDemo.svelte';
const component = window.location.pathname === '/flow' ? App
  : window.location.pathname === '/stack' ? StackDemo
  : window.location.pathname === '/frames' ? FramesDemo
  : window.location.pathname === '/mixed' ? MixedDemo
  : window.location.pathname === '/static' ? StaticDemo : StackDemo;
mount(component, { target: document.getElementById('app')! });
