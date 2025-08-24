// Standardized CORS headers for all Edge Functions
export const getCorsHeaders = (origin?: string | null) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    /^https?:\/\/preview--.*\.lovable\.app$/,
    /^https?:\/\/.*\.lovable\.dev$/
  ];

  let allowOrigin = '*';
  
  if (origin) {
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return allowed === origin;
      }
      return allowed.test(origin);
    });
    
    if (isAllowed) {
      allowOrigin = origin;
    }
  }

  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-max-age': '86400',
    'access-control-allow-credentials': allowOrigin !== '*' ? 'true' : 'false',
    'vary': 'origin'
  };
};

// Standard CORS headers for most use cases
export const corsHeaders = getCorsHeaders();

// JSON response helper with consistent headers
export function json(data: unknown, status = 200, requestId?: string) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...corsHeaders
  };
  
  if (requestId) {
    headers['x-request-id'] = requestId;
  }
  
  return new Response(JSON.stringify(data), { status, headers });
}