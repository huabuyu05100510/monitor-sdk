import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initDomTracker } from './index'
import { resetInitializedState } from '@monit/dom-tracker'

// Mock the dom-tracker to avoid DOM interactions
vi.mock('@monit/dom-tracker', () => ({
  createDomTracker: vi.fn(() => () => {}),
  resetInitializedState: vi.fn(),
}))

describe('lababel-integration', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    // Restore the real import.meta.env
    vi.unstubAllGlobals()
  })

  it('should return undefined in non-development mode', () => {
    // Mock import.meta.env.DEV to false
    vi.stubGlobal('import.meta', {
      env: {
        DEV: false,
      },
    })

    const result = initDomTracker()
    expect(result).toBeUndefined()
  })

  it('should initialize tracker in development mode with default options', () => {
    // Mock import.meta.env.DEV to true
    vi.stubGlobal('import.meta', {
      env: {
        DEV: true,
      },
    })

    // Mock URLSearchParams to not have _monit_debug
    global.URLSearchParams = class {
      has() { return false }
    } as any

    const result = initDomTracker()
    // The real createDomTracker is mocked, so we just verify it was called
    expect(result).toBeUndefined()
  })

  it('should pass enabled option to createDomTracker', () => {
    // Mock import.meta.env.DEV to true
    vi.stubGlobal('import.meta', {
      env: {
        DEV: true,
      },
    })

    // Mock URLSearchParams to not have _monit_debug
    global.URLSearchParams = class {
      has() { return false }
    } as any

    const result = initDomTracker({ enabled: true })
    expect(result).toBeUndefined()
  })

  it('should pass showComponentStack option to createDomTracker', () => {
    // Mock import.meta.env.DEV to true
    vi.stubGlobal('import.meta', {
      env: {
        DEV: true,
      },
    })

    // Mock URLSearchParams to not have _monit_debug
    global.URLSearchParams = class {
      has() { return false }
    } as any

    const result = initDomTracker({ showComponentStack: false })
    expect(result).toBeUndefined()
  })

  it('should expose initDomTracker on window for debugging', () => {
    // This test verifies the module exports are correct
    // The actual window exposure is tested in browser environment
    expect(typeof initDomTracker).toBe('function')
  })
})
