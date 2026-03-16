import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createOverlay, showOverlay, hideOverlay, removeOverlay } from './overlay';
import { setDomMetadata } from './metadataStore';
import type { DomMetadata } from './types';

describe('overlay', () => {
  beforeEach(() => {
    // Clear any existing overlay before each test
    removeOverlay();
  });

  afterEach(() => {
    // Clean up after each test
    removeOverlay();
  });

  describe('createOverlay', () => {
    it('should create overlay element', () => {
      const overlay = createOverlay();

      expect(overlay).toBeDefined();
      expect(overlay.id).toBe('monit-dom-tracker-overlay');
      expect(overlay.style.display).toBe('none');
      expect(overlay.style.pointerEvents).toBe('none');
      expect(overlay.style.zIndex).toBe('99999');
      expect(document.body.contains(overlay)).toBe(true);
    });

    it('should return existing overlay on subsequent calls', () => {
      const overlay1 = createOverlay();
      const overlay2 = createOverlay();

      expect(overlay1).toBe(overlay2);
    });
  });

  describe('showOverlay', () => {
    it('should show overlay with metadata info', () => {
      const target = document.createElement('div');
      target.style.width = '100px';
      target.style.height = '50px';
      document.body.appendChild(target);

      const metadata: DomMetadata = {
        jsSource: { component: 'TestComponent', file: 'Test.tsx', line: 10, column: 5 },
        componentStack: ['App', 'Layout', 'TestComponent']
      };

      showOverlay(target, metadata);

      const overlay = document.getElementById('monit-dom-tracker-overlay');
      expect(overlay).toBeDefined();
      expect(overlay.style.display).toBe('block');

      // Verify info box is positioned below the element
      const rect = target.getBoundingClientRect();
      expect(overlay?.innerHTML).toContain(`top: ${rect.bottom + 8}px`);
      expect(overlay?.innerHTML).toContain(`left: ${rect.left}px`);

      // Verify content contains JS Resource info
      expect(overlay?.innerHTML).toContain('JS Resource');
      expect(overlay?.innerHTML).toContain('TestComponent');
      expect(overlay?.innerHTML).toContain('Test.tsx');

      // Verify component stack
      expect(overlay?.innerHTML).toContain('Component Stack');
      expect(overlay?.innerHTML).toContain('App');
      expect(overlay?.innerHTML).toContain('Layout');
      expect(overlay?.innerHTML).toContain('TestComponent');

      document.body.removeChild(target);
    });

    it('should create overlay if not exists', () => {
      const target = document.createElement('div');
      const metadata: DomMetadata = {
        jsSource: { component: 'Test', file: 'test.tsx', line: 1, column: 1 },
        componentStack: []
      };

      showOverlay(target, metadata);

      expect(document.getElementById('monit-dom-tracker-overlay')).toBeDefined();
    });

    it('should display API source info when available', () => {
      const target = document.createElement('div');
      document.body.appendChild(target);

      const metadata: DomMetadata = {
        apiSource: {
          url: 'https://api.example.com/users',
          method: 'get',
          params: { id: 123 },
          timestamp: Date.now()
        },
        jsSource: { component: 'UserList', file: 'UserList.tsx', line: 20, column: 3 },
        componentStack: []
      };

      showOverlay(target, metadata);

      const overlay = document.getElementById('monit-dom-tracker-overlay');
      expect(overlay?.innerHTML).toContain('API Source');
      expect(overlay?.innerHTML).toContain('GET https://api.example.com/users');
      expect(overlay?.innerHTML).toContain('Params: {"id":123}');

      document.body.removeChild(target);
    });

    it('should escape HTML to prevent XSS', () => {
      const target = document.createElement('div');
      document.body.appendChild(target);

      const maliciousComponent = '<script>alert("xss")</script>';
      const maliciousUrl = 'https://example.com?param=<img src=x onerror=alert(1)>';

      const metadata: DomMetadata = {
        apiSource: {
          url: maliciousUrl,
          method: 'post',
          timestamp: Date.now()
        },
        jsSource: { component: maliciousComponent, file: 'test.tsx', line: 1, column: 1 },
        componentStack: ['<script>alert(1)</script>']
      };

      showOverlay(target, metadata);

      const overlay = document.getElementById('monit-dom-tracker-overlay');
      const html = overlay?.innerHTML || '';

      // Should contain escaped versions, not raw HTML
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;img');

      document.body.removeChild(target);
    });

    it('should position info box below hovered element', () => {
      const target = document.createElement('div');
      target.style.position = 'absolute';
      target.style.top = '100px';
      target.style.left = '50px';
      target.style.width = '200px';
      target.style.height = '100px';
      document.body.appendChild(target);

      const metadata: DomMetadata = {
        jsSource: { component: 'Test', file: 'test.tsx', line: 1, column: 1 },
        componentStack: []
      };

      showOverlay(target, metadata);

      const overlay = document.getElementById('monit-dom-tracker-overlay');
      const rect = target.getBoundingClientRect();
      const expectedTop = rect.bottom + 8;

      expect(overlay?.innerHTML).toContain(`top: ${expectedTop}px`);

      document.body.removeChild(target);
    });
  });

  describe('hideOverlay', () => {
    it('should hide the overlay', () => {
      createOverlay();
      hideOverlay();

      expect(document.getElementById('monit-dom-tracker-overlay')?.style.display).toBe('none');
    });

    it('should handle missing overlay gracefully', () => {
      removeOverlay();
      hideOverlay(); // Should not throw
    });
  });

  describe('removeOverlay', () => {
    it('should remove overlay from DOM', () => {
      createOverlay();
      removeOverlay();

      expect(document.getElementById('monit-dom-tracker-overlay')).toBeNull();
    });

    it('should nullify overlay reference', () => {
      createOverlay();
      removeOverlay();

      // Access the module's internal overlay variable through the module
      // Since we can't directly access it, we verify via createOverlay creating a new one
      const newOverlay = createOverlay();
      expect(newOverlay).toBeDefined();
      expect(newOverlay.id).toBe('monit-dom-tracker-overlay');
    });
  });
});