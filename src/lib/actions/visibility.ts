// lib/actions/visibility.ts
export function visibility(
  node: HTMLElement,
  {
    onFullyVisible,
    onHidden
  }: {
    onFullyVisible?: () => void;
    onHidden?: () => void;
  }
) {
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.intersectionRatio > 0.1) {
        onFullyVisible?.();
      } else {
        onHidden?.();
      }
    },
    {
      threshold: [0, 1]
    }
  );

  observer.observe(node);

  return {
    destroy() {
      observer.disconnect();
    }
  };
}
