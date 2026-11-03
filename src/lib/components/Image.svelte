<script lang="ts">
  import type { HTMLImgAttributes } from 'svelte/elements';
  import { must_view } from '../actions/must_view.js';

  type Props = Omit<HTMLImgAttributes, 'src' | 'alt' | 'width' | 'height'> & {
    href: string;
    alt: string;
    width?: string | number;
    height?: string | number;
    maxWidth?: string;
    maxHeight?: string;
    fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  };

  let {
    href,
    alt,
    width = 'auto',
    height = 'auto',
    maxWidth = '75vw',
    maxHeight = '75vh',
    fit = 'contain',
    class: className,
    ...attributes
  }: Props = $props();

  const cssLength = (value: string | number) => (typeof value === 'number' ? `${value}px` : value);
</script>

<img
  {...attributes}
  src={href}
  {alt}
  width={typeof width === 'number' ? width : undefined}
  height={typeof height === 'number' ? height : undefined}
  class={['image', className]}
  style:width={cssLength(width)}
  style:height={cssLength(height)}
  style:max-width={maxWidth}
  style:max-height={maxHeight}
  style:object-fit={fit}
  use:must_view
/>
