import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { setDomMetadata, getDomMetadata } from './metadataStore';
import type { ApiDataSource, JsResourceSource } from './types';

let requestId = 0;
const requestMap = new Map<number, { config: AxiosRequestConfig; element: Element }>();

// Export for testing purposes
export function resetInterceptorState() {
  requestId = 0;
  requestMap.clear();
}

export function setupAxiosInterceptor() {
  const requestInterceptor = (config: AxiosRequestConfig): AxiosRequestConfig => {
    const id = requestId++;
    (config as any).requestId = id;
    requestMap.set(id, { config, element: getCurrentElement() });
    return config;
  };

  const responseInterceptor = (response: AxiosResponse): AxiosResponse => {
    const id = (response.config as any)?.requestId;
    const stored = requestMap.get(id);
    if (stored) {
      attachDataSource(stored.element, response.config, response);
      requestMap.delete(id);
    }
    return response;
  };

  const requestErrorInterceptor = (error: any): Promise<any> => {
    const id = error.config?.requestId;
    const stored = requestMap.get(id);
    if (stored) {
      attachDataSource(stored.element, error.config, null, error);
      requestMap.delete(id);
    }
    return Promise.reject(error);
  };

  const id = axios.interceptors.request.use(requestInterceptor);
  const responseId = axios.interceptors.response.use(
    responseInterceptor,
    requestErrorInterceptor
  );

  return () => {
    axios.interceptors.request.eject(id);
    axios.interceptors.response.eject(responseId);
  };
}

function getCurrentElement(): Element {
  const stack = new Error().stack || '';
  // Walk up the stack to find the calling element context
  // Skip: Error, getCurrentElement, setupAxiosInterceptor requestInterceptor
  const frames = stack.split('\n').slice(4);

  for (const frame of frames) {
    // Look for DOM-related function calls like "at HTMLButtonElement.<anonymous>"
    // or component function calls
    if (frame.includes('at ') && !frame.includes('Error')) {
      // Try to find element in the call stack by looking for DOM element context
      const elementMatch = frame.match(/at (\w+Element)\./);
      if (elementMatch) {
        // We found a DOM element context
        const selector = elementMatch[1];
        // Try to find element by tag name (case-insensitive)
        const tagName = selector.replace('HTML', '').replace('Element', '').toLowerCase();
        const found = document.querySelector(tagName);
        if (found) return found;
      }
    }
  }

  // Fallback: return document.documentElement if no specific element found
  return document.documentElement;
}

function attachDataSource(
  element: Element,
  config: AxiosRequestConfig,
  response: AxiosResponse | null,
  error?: any
): void {
  const apiSource: ApiDataSource = {
    url: config.url || '',
    method: (config.method || 'get').toLowerCase() as string,
    params: config.params,
    timestamp: Date.now(),
  };

  const jsSource = getJsResourceInfo();

  setDomMetadata(element, {
    apiSource,
    jsSource,
    componentStack: getComponentStack(error),
  });
}

function getJsResourceInfo(): JsResourceSource {
  const stack = new Error().stack || '';
  // Parse the stack frame for the caller
  // Frame 0: getJsResourceInfo
  // Frame 1: attachDataSource
  // Frame 2: responseInterceptor/requestErrorInterceptor
  // Frame 3: the actual calling code
  const frames = stack.split('\n');
  const frame = frames[3] || frames[2] || frames[1] || '';

  // Try to extract file info from the stack frame
  // Format: "at ComponentName (file.tsx:line:column)" or "at file.tsx:line:column"
  const match = frame.match(/at\s+(?:\w+\s+)?\(?([^:]+):(\d+):(\d+)\)?/);

  if (match) {
    // Extract component name from the frame (before the parenthesis or colon)
    const componentMatch = frame.match(/at\s+([A-Za-z0-9_]+)\s+\(/);
    return {
      component: componentMatch ? componentMatch[1] : 'UnknownComponent',
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
    };
  }

  // Fallback - return current position info
  return {
    component: 'UnknownComponent',
    file: 'unknown',
    line: 0,
    column: 0,
  };
}

function getComponentStack(error?: any): string[] {
  // Use provided error's stack if available, otherwise create a new error
  const stack = error?.stack || new Error().stack || '';

  // Split and clean up stack frames
  // Skip the first few frames that are internal to our interceptor
  return stack.split('\n').slice(4, 13).map(line => {
    // Clean up stack frames
    // Remove "at " prefix and everything after file location
    return line.trim()
      .replace(/^[^@]*@/, '')
      .replace(/\(.*$/, '')
      .trim();
  }).filter(Boolean);
}
