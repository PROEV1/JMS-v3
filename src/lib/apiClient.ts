import { supabase } from '@/integrations/supabase/client';

type ApiError = { 
  status: number; 
  code?: string; 
  message: string; 
  requestId?: string; 
  details?: unknown; 
  url: string 
};

const backoff = [300, 900, 2000];
const failures: Record<string, { count: number; ts: number }> = {};

function sleep(ms: number) { 
  return new Promise(r => setTimeout(r, ms)); 
}

function shouldTrip(key: string) { 
  const w = failures[key]; 
  return w && w.count >= 5 && Date.now() - w.ts < 60_000; 
}

function markFail(key: string) { 
  const now = Date.now(); 
  failures[key] = { count: (failures[key]?.count || 0) + 1, ts: now }; 
}

export async function headersWithAuth(extra?: Record<string, string>) {
  const h: Record<string, string> = {
    'content-type': 'application/json',
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2cHB2c3RnY29ubXp6anNyeW5hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyNTYxNjEsImV4cCI6MjA3MDgzMjE2MX0.3hJXqRe_xTpIhdIIEDBgG-8qc23UCRMwpLaf2zV0Se8'
  };
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      h['authorization'] = `Bearer ${session.access_token}`;
    }
  } catch (error) {
    console.warn('Failed to get auth session:', error);
  }
  
  return { ...h, ...(extra || {}) };
}

async function doFetch(
  url: string, 
  init: RequestInit & { retries?: number; timeoutMs?: number } = {}
) {
  const { retries = 3, timeoutMs = 15000, ...opts } = init;
  const key = new URL(url, window.location.origin).pathname;
  
  if (shouldTrip(key)) {
    throw {
      status: 503,
      code: 'CircuitOpen',
      message: 'Temporarily unavailable',
      url
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    
    const ct = res.headers.get('content-type') || '';
    const body = ct.includes('json') 
      ? await res.json().catch(() => ({})) 
      : await res.text().catch(() => '');
    
    if (!res.ok) {
      const err: ApiError = {
        status: res.status,
        code: (body as any)?.code,
        message: (body as any)?.message || String(body),
        requestId: res.headers.get('x-request-id') || undefined,
        details: body,
        url,
      };
      
      if (res.status >= 500 && retries > 0) {
        await sleep(backoff[3 - retries]);
        return doFetch(url, { ...init, retries: retries - 1 });
      }
      
      markFail(key);
      throw err;
    }
    
    return body;
  } catch (e: any) {
    clearTimeout(timer);
    
    if (retries > 0) {
      await sleep(backoff[3 - retries]);
      return doFetch(url, { ...init, retries: retries - 1 });
    }
    
    markFail(key);
    throw {
      status: 0,
      code: e?.name,
      message: e?.message || 'Network error',
      details: e,
      url
    };
  }
}

// Helper to build function URLs
export function buildFunctionUrl(functionName: string, params?: Record<string, string | number>) {
  const baseUrl = 'https://qvppvstgconmzzjsryna.supabase.co/functions/v1';
  const url = new URL(`${baseUrl}/${functionName}`);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }
  
  return url.toString();
}

export const apiClient = {
  get: async (url: string, opts: RequestInit = {}) => {
    const headers = await headersWithAuth(opts.headers as any);
    return doFetch(url, { ...opts, method: 'GET', headers });
  },
  
  post: async (url: string, body?: unknown, opts: RequestInit = {}) => {
    const headers = await headersWithAuth(opts.headers as any);
    return doFetch(url, {
      ...opts,
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  },
  
  put: async (url: string, body?: unknown, opts: RequestInit = {}) => {
    const headers = await headersWithAuth(opts.headers as any);
    return doFetch(url, {
      ...opts,
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  },
  
  del: async (url: string, opts: RequestInit = {}) => {
    const headers = await headersWithAuth(opts.headers as any);
    return doFetch(url, { ...opts, method: 'DELETE', headers });
  },
};