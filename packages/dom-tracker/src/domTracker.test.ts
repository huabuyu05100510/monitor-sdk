import { describe, it, expect } from 'vitest';
import { createDomTracker } from './domTracker';

describe('DomTracker', () => {
  it('should create a dom tracker instance', () => {
    const tracker = createDomTracker();
    expect(tracker).toBeDefined();
  });

  it('should have start and stop methods', () => {
    const tracker = createDomTracker();
    expect(tracker.start).toBeDefined();
    expect(tracker.stop).toBeDefined();
  });
});