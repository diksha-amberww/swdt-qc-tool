/**
 * Yields to the browser so the UI can paint between QC ticks.
 * Prevents the main thread from locking on low-end hardware.
 */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    const ric = (window as Window & { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(() => resolve(), { timeout: 32 });
      return;
    }
    setTimeout(resolve, 0);
  });
}
