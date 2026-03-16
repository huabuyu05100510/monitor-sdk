import { setupAxiosInterceptor, resetInterceptorState } from './axiosInterceptor';
import { createOverlay, showOverlay, hideOverlay, removeOverlay } from './overlay';
import { getDomMetadata } from './metadataStore';
import type { DomMetadata } from './types';

export interface DomTrackerOptions {
  enabled?: boolean;
  showComponentStack?: boolean;
}

let initialized = false;

// Export for testing purposes
export function resetInitializedState() {
  initialized = false;
}

export function createDomTracker(options: DomTrackerOptions = {}) {
  const { enabled = false, showComponentStack = true } = options;

  // Check if explicitly disabled
  if (!enabled) {
    // Check URL parameter as fallback
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (!urlParams.has('_monit_debug')) {
        console.log('@monit/dom-tracker: Not enabled. Add ?_monit_debug=1 to URL to enable.');
        return undefined;
      }
    } else {
      return undefined;
    }
  }

  // Only enable in development mode
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    console.warn('@monit/dom-tracker: Skipping initialization in non-development environment');
    return undefined;
  }

  // Prevent multiple initializations
  if (initialized) {
    console.log('@monit/dom-tracker: Already initialized');
    return undefined;
  }

  initialized = true;
  console.log('@monit/dom-tracker: Initialized');

  // Reset interceptor state for clean initialization
  resetInterceptorState();

  // Setup Axios interceptor
  const teardownAxios = setupAxiosInterceptor();

  // Setup hover listener
  const overlay = createOverlay();

  const handleMouseOver = (e: MouseEvent) => {
    const target = e.target as Element;
    // Skip overlay elements
    if (target.closest('#monit-dom-tracker-overlay')) return;

    const metadata = getDomMetadata(target);
    if (metadata) {
      showOverlay(target, metadata);
    } else {
      hideOverlay();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    // Reposition overlay on move for better UX
    if (overlay.style.display === 'block') {
      // Find target under cursor
      const target = document.elementFromPoint(e.clientX, e.clientY) as Element;
      if (target) {
        const metadata = getDomMetadata(target);
        if (metadata) {
          showOverlay(target, metadata);
        }
      }
    }
  };

  const handleMouseLeave = () => {
    hideOverlay();
  };

  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseleave', handleMouseLeave);

  // Teardown function
  return () => {
    console.log('@monit/dom-tracker: Teardown');
    teardownAxios();
    document.removeEventListener('mouseover', handleMouseOver);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseleave', handleMouseLeave);
    removeOverlay();
    initialized = false;
  };
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).__MONIT_DOM_TRACKER__ = {
    createDomTracker,
    resetInterceptorState,
    resetInitializedState,
  };
}
