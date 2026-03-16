import { describe, it, expect } from 'vitest';
import { setDomMetadata, getDomMetadata, clearDomMetadata } from './metadataStore';
import type { DomMetadata } from './types';

describe('metadataStore', () => {
  it('should store and retrieve metadata', () => {
    const el = document.createElement('div');
    const metadata: DomMetadata = {
      jsSource: { component: 'Test', file: 'test.tsx', line: 1, column: 1 },
      componentStack: []
    };

    setDomMetadata(el, metadata);
    expect(getDomMetadata(el)).toEqual(metadata);
  });

  it('should clear metadata', () => {
    const el = document.createElement('div');
    const metadata: DomMetadata = {
      jsSource: { component: 'Test', file: 'test.tsx', line: 1, column: 1 },
      componentStack: []
    };

    setDomMetadata(el, metadata);
    clearDomMetadata(el);
    expect(getDomMetadata(el)).toBeUndefined();
  });

  it('should handle multiple elements independently', () => {
    const el1 = document.createElement('div');
    const el2 = document.createElement('span');

    const meta1: DomMetadata = {
      jsSource: { component: 'Component1', file: 'comp1.tsx', line: 1, column: 1 },
      componentStack: []
    };

    const meta2: DomMetadata = {
      jsSource: { component: 'Component2', file: 'comp2.tsx', line: 2, column: 1 },
      componentStack: []
    };

    setDomMetadata(el1, meta1);
    setDomMetadata(el2, meta2);

    expect(getDomMetadata(el1)).toEqual(meta1);
    expect(getDomMetadata(el2)).toEqual(meta2);
  });
});
