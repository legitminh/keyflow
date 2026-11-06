import { mount } from 'svelte';
import App from './App.svelte';
import StaticDemo from './StaticDemo.svelte';
import MixedDemo from './MixedDemo.svelte';
const component = window.location.pathname === '/mixed' ? MixedDemo
  : window.location.pathname === '/static' ? StaticDemo : App;
mount(component, { target: document.getElementById('app')! });
