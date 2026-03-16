import { getDomMetadata } from './metadataStore';
import type { DomMetadata, ApiDataSource, JsResourceSource } from './types';

let overlay: HTMLElement | null = null;

export function createOverlay(): HTMLElement {
  if (overlay) return overlay;

  overlay = document.createElement('div');
  overlay.id = 'monit-dom-tracker-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 99999;
    display: none;
  `;
  document.body.appendChild(overlay);
  return overlay;
}

export function showOverlay(target: Element, metadata: DomMetadata): void {
  if (!overlay) createOverlay();

  const rect = target.getBoundingClientRect();
  const infoHtml = buildInfoHtml(metadata);

  overlay.innerHTML = `
    <div style="
      position: absolute;
      top: ${rect.bottom + 8}px;
      left: ${rect.left}px;
      min-width: 320px;
      max-width: 500px;
      background: rgba(22, 23, 26, 0.95);
      color: #fff;
      padding: 14px;
      border-radius: 8px;
      font-size: 12px;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      pointer-events: auto;
      border: 1px solid rgba(255, 255, 255, 0.1);
    ">
      ${infoHtml}
    </div>
  `;
  overlay.style.display = 'block';
}

function buildInfoHtml(metadata: DomMetadata): string {
  const parts: string[] = [];

  if (metadata.apiSource) {
    const { url, method, params } = metadata.apiSource;
    parts.push(`<div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
      <div style="color: #10b981; font-weight: 600; margin-bottom: 4px;">API Source</div>
      <div style="color: #60a5fa; margin-bottom: 4px;">${method.toUpperCase()} ${escapeHtml(url)}</div>
      ${params ? `<div style="color: #9ca3af; font-size: 11px;">Params: ${JSON.stringify(params)}</div>` : ''}
    </div>`);
  }

  parts.push(`<div style="margin-bottom: 10px;">
    <div style="color: #10b981; font-weight: 600; margin-bottom: 4px;">JS Resource</div>
    <div style="color: #fbbf24; margin-bottom: 2px;">${escapeHtml(metadata.jsSource.component)}</div>
    <div style="color: #9ca3af; font-size: 11px;">${escapeHtml(metadata.jsSource.file)}</div>
  </div>`);

  if (metadata.componentStack && metadata.componentStack.length > 0) {
    parts.push(`<div>
      <div style="color: #10b981; font-weight: 600; margin-bottom: 4px;">Component Stack</div>
      <div style="color: #6b7280; font-size: 11px; word-break: break-all;">${metadata.componentStack.map(escapeHtml).join(' <span style="color: #9ca3af;">➤</span> ')}</div>
    </div>`);
  }

  return parts.join('');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '"')
    .replace(/'/g, '&apos;');
}

export function hideOverlay(): void {
  if (overlay) {
    overlay.style.display = 'none';
  }
}

export function removeOverlay(): void {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}
