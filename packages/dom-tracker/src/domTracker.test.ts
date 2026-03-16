import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomTracker, resetInterceptorState, resetInitializedState } from './domTracker';

describe('createDomTracker', () => {
  let originalNodeEnv: string | undefined;
  let originalWindowLocation: any;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    originalWindowLocation = window.location;

    // Mock URLSearchParams
    (global as any).URLSearchParams = class {
      private params = new Map<string, string>();
      constructor(public search: string = '') {
        search.slice(1).split('&').forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            this.params.set(decodeURIComponent(key), decodeURIComponent(value));
          }
        });
      }
      has(key: string) {
        return this.params.has(key);
      }
      get(key: string) {
        return this.params.get(key);
      }
    };

    // Mock window.location.search
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({
        search: '',
      }),
    });

    // Reset initialized state between tests
    resetInitializedState();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    // Reset window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalWindowLocation,
    });
    resetInitializedState();
    (vi as any).resetModules();
  });

  it('should return undefined when explicitly disabled and no _monit_debug param', () => {
    process.env.NODE_ENV = 'development';
    const result = createDomTracker({ enabled: false });
    expect(result).toBeUndefined();
  });

  it('should return undefined when enabled via URL param in development', () => {
    process.env.NODE_ENV = 'development';
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({
        search: '?_monit_debug=1',
      }),
    });

    const result = createDomTracker({ enabled: false });
    expect(result).toBeDefined();
    expect(typeof result).toBe('function');
  });

  it('should return undefined in non-development environment without URL param', () => {
    process.env.NODE_ENV = 'production';
    const result = createDomTracker({ enabled: true });
    expect(result).toBeUndefined();
  });

  it('should return undefined in production even with URL param', () => {
    process.env.NODE_ENV = 'production';
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({
        search: '?_monit_debug=1',
      }),
    });
    const result = createDomTracker({ enabled: true });
    expect(result).toBeUndefined();
  });

  it('should return undefined in test environment without URL param', () => {
    process.env.NODE_ENV = 'test';
    const result = createDomTracker({ enabled: false });
    expect(result).toBeUndefined();
  });

  it('should initialize when enabled in test environment', () => {
    process.env.NODE_ENV = 'test';
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({
        search: '?_monit_debug=1',
      }),
    });
    const result = createDomTracker({ enabled: false });
    expect(result).toBeDefined();
  });

  it('should only initialize once', () => {
    process.env.NODE_ENV = 'development';
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({
        search: '?_monit_debug=1',
      }),
    });

    const result1 = createDomTracker({ enabled: false });
    const result2 = createDomTracker({ enabled: false });

    expect(result1).toBeDefined();
    expect(result2).toBeUndefined();
  });

  it('should return a teardown function', () => {
    process.env.NODE_ENV = 'development';
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({
        search: '?_monit_debug=1',
      }),
    });

    const teardown = createDomTracker({ enabled: false });
    expect(teardown).toBeDefined();
    expect(typeof teardown).toBe('function');

    // Call teardown
    teardown!();
  });

  it('should log messages during initialization', () => {
    const consoleLogSpy = vi.spyOn(console, 'log');
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    process.env.NODE_ENV = 'development';
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({
        search: '?_monit_debug=1',
      }),
    });

    createDomTracker({ enabled: false });

    expect(consoleLogSpy).toHaveBeenCalledWith('@monit/dom-tracker: Initialized');

    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should return undefined in non-browser environment', () => {
    const originalWindow = (global as any).window;
    delete (global as any).window;

    process.env.NODE_ENV = 'development';

    // In non-browser, should return undefined when not explicitly enabled
    const result = createDomTracker({ enabled: false });
    expect(result).toBeUndefined();

    (global as any).window = originalWindow;
  });

  it('should log warning in non-development environment', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    process.env.NODE_ENV = 'production';
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({
        search: '?_monit_debug=1',
      }),
    });

    createDomTracker({ enabled: true });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '@monit/dom-tracker: Skipping initialization in non-development environment'
    );

    consoleWarnSpy.mockRestore();
  });

  it('should set up event listeners on document', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

    process.env.NODE_ENV = 'development';
    Object.defineProperty(window, 'location', {
      configurable: true,
      get: () => ({
        search: '?_monit_debug=1',
      }),
    });

    const teardown = createDomTracker({ enabled: false });

    expect(addEventListenerSpy).toHaveBeenCalledWith('mouseover', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('mouseleave', expect.any(Function));

    teardown!();

    addEventListenerSpy.mockRestore();
  });

  it('should expose resetInitializedState for testing', () => {
    // Verify resetInitializedState is exported
    expect(resetInitializedState).toBeDefined();
    expect(typeof resetInitializedState).toBe('function');
  });
});
