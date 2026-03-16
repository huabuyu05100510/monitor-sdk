import { createDomTracker, type DomTrackerOptions } from '@monit/dom-tracker';

// Type declaration for ImportMeta.env (Vite's HMR env)
interface ImportMeta {
  env: {
    DEV: boolean;
  };
}

export interface LababelTrackerOptions {
  enabled?: boolean;
  showComponentStack?: boolean;
}

/**
 * Initialize DOM tracker for lababel-fe project
 * Only activates in development mode with _monit_debug URL parameter
 */
export function initDomTracker(options: LababelTrackerOptions = {}) {
  // Check if in development mode
  const isDev = import.meta.env?.DEV ?? false;

  if (!isDev) {
    console.log('@monit/lababel-integration: Skipping in non-development environment');
    return undefined;
  }

  return createDomTracker({
    enabled: options.enabled ?? true,
    showComponentStack: options.showComponentStack ?? true,
  });
}

// Expose for debugging
if (typeof window !== 'undefined') {
  (window as any).__MONIT_LABABEL__ = {
    initDomTracker,
  };
}
