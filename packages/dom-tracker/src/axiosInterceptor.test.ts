import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { setupAxiosInterceptor, resetInterceptorState } from './axiosInterceptor';
import { getDomMetadata } from './metadataStore';
import type { ApiDataSource } from './types';

// Mock axios
vi.mock('axios', () => {
  const mockRequestEject = vi.fn();
  const mockResponseEject = vi.fn();

  const originalAxios = vi.fn((config) => {
    return Promise.resolve({
      config,
      data: { mock: 'response' },
      status: 200,
      statusText: 'OK',
      headers: {},
      request: {},
    });
  });

  originalAxios.create = vi.fn(() => originalAxios);
  originalAxios.interceptors = {
    request: {
      use: vi.fn().mockImplementation(() => 1),
      eject: mockRequestEject,
    },
    response: {
      use: vi.fn().mockImplementation(() => 2),
      eject: mockResponseEject,
    },
  };

  return {
    default: originalAxios,
    __esModule: true,
    ...originalAxios,
  };
});

// Store original requestMap for testing
const originalRequestMap = new Map<number, { config: InternalAxiosRequestConfig; element: Element }>();

describe('axiosInterceptor', () => {
  let teardown: (() => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    resetInterceptorState();

    const div = document.createElement('div');
    div.id = 'test-button';
    div.textContent = 'Click me';
    document.body.appendChild(div);
  });

  afterEach(() => {
    if (teardown) {
      teardown();
      teardown = undefined;
    }
    document.body.innerHTML = '';
  });

  it('should set up request and response interceptors', () => {
    teardown = setupAxiosInterceptor();

    expect(axios.interceptors.request.use).toHaveBeenCalled();
    expect(axios.interceptors.response.use).toHaveBeenCalled();
  });

  it('should assign unique ID to each request config', async () => {
    teardown = setupAxiosInterceptor();

    const config: InternalAxiosRequestConfig = {
      url: '/api/test',
      method: 'get' as const,
    };

    const requestInterceptor = (axios.interceptors.request.use as vi.Mock).mock.calls[0][0];
    const result = requestInterceptor(config);

    expect(result.requestId).toBe(0);
  });

  it('should store element with request in map', async () => {
    teardown = setupAxiosInterceptor();

    const config: InternalAxiosRequestConfig = {
      url: '/api/test',
      method: 'get' as const,
    };

    const requestInterceptor = (axios.interceptors.request.use as vi.Mock).mock.calls[0][0];
    requestInterceptor(config);

    const responseInterceptor = (axios.interceptors.response.use as vi.Mock).mock.calls[0][0];

    const mockResponse: AxiosResponse = {
      config: { ...config, requestId: 0 } as any,
      data: { result: 'success' },
      status: 200,
      statusText: 'OK',
      headers: {},
      request: {},
    };

    const result = responseInterceptor(mockResponse);

    expect(result).toBe(mockResponse);
  });

  it('should attach API source data to DOM element on success', async () => {
    teardown = setupAxiosInterceptor();

    const config: InternalAxiosRequestConfig = {
      url: '/api/users',
      method: 'post' as const,
      params: { id: 1 },
      data: { name: 'Test' },
    };

    const requestInterceptor = (axios.interceptors.request.use as vi.Mock).mock.calls[0][0];
    requestInterceptor(config);

    const responseInterceptor = (axios.interceptors.response.use as vi.Mock).mock.calls[0][0];

    const mockResponse: AxiosResponse = {
      config: { ...config, requestId: 0 } as any,
      data: { id: 1, name: 'Test' },
      status: 201,
      statusText: 'Created',
      headers: {},
      request: {},
    };

    responseInterceptor(mockResponse);

    // The default element is document.documentElement
    const element = document.documentElement;
    const metadata = getDomMetadata(element);

    expect(metadata).toBeDefined();
    expect(metadata?.apiSource).toBeDefined();
    expect(metadata?.apiSource?.url).toBe('/api/users');
    expect(metadata?.apiSource?.method).toBe('post');
    expect(metadata?.apiSource?.params).toEqual({ id: 1 });
    expect(metadata?.apiSource?.timestamp).toBeDefined();
  });

  it('should handle request errors and attach data to element', async () => {
    teardown = setupAxiosInterceptor();

    const config: InternalAxiosRequestConfig = {
      url: '/api/fail',
      method: 'get' as const,
    };

    const requestInterceptor = (axios.interceptors.request.use as vi.Mock).mock.calls[0][0];
    requestInterceptor(config);

    const errorInterceptor = (axios.interceptors.response.use as vi.Mock).mock.calls[0][1];

    const mockError = {
      config: { ...config, requestId: 0 } as any,
      response: {
        status: 500,
        data: { error: 'Internal Server Error' },
      },
      message: 'Request failed with status code 500',
    };

    await expect(errorInterceptor(mockError)).rejects.toEqual(mockError);

    const element = document.documentElement;
    const metadata = getDomMetadata(element);

    expect(metadata).toBeDefined();
    expect(metadata?.apiSource).toBeDefined();
  });

  it('should return teardown function to remove interceptors', async () => {
    teardown = setupAxiosInterceptor();

    expect(axios.interceptors.request.use).toHaveBeenCalledTimes(1);
    expect(axios.interceptors.response.use).toHaveBeenCalledTimes(1);

    teardown?.();

    expect(axios.interceptors.request.eject).toHaveBeenCalledWith(1);
    expect(axios.interceptors.response.eject).toHaveBeenCalledWith(2);
  });

  it('should extract component stack from error', async () => {
    teardown = setupAxiosInterceptor();

    const config: InternalAxiosRequestConfig = {
      url: '/api/test',
      method: 'get' as const,
    };

    const requestInterceptor = (axios.interceptors.request.use as vi.Mock).mock.calls[0][0];
    requestInterceptor(config);

    const errorInterceptor = (axios.interceptors.response.use as vi.Mock).mock.calls[0][1];

    const mockError = {
      config: { ...config, requestId: 0 } as any,
      response: {
        status: 404,
        data: { error: 'Not Found' },
      },
      message: 'Request failed with status 404',
      stack: 'Error: Request failed with status 404\n' +
        '  at axiosInterceptor.ts:xx:xx\n' +
        '  at responseInterceptor (axiosInterceptor.ts:xx:xx)\n' +
        '  at MyComponent.tsx:15:30\n' +
        '  at App.tsx:8:5\n' +
        '  at index.tsx:5:1',
    };

    await expect(errorInterceptor(mockError)).rejects.toEqual(mockError);

    const element = document.documentElement;
    const metadata = getDomMetadata(element);

    expect(metadata?.componentStack).toBeDefined();
    expect(Array.isArray(metadata?.componentStack)).toBe(true);
  });

  it('should handle requests without stored map entries gracefully', async () => {
    teardown = setupAxiosInterceptor();

    const responseInterceptor = (axios.interceptors.response.use as vi.Mock).mock.calls[0][0];

    const mockResponse: AxiosResponse = {
      config: { url: '/api/test', requestId: 999 } as any,
      data: { result: 'success' },
      status: 200,
      statusText: 'OK',
      headers: {},
      request: {},
    };

    const result = responseInterceptor(mockResponse);
    expect(result).toBe(mockResponse);
  });
});