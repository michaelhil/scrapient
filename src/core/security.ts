import type { AppConfig } from './config';

export interface SecurityHeaders {
  'Content-Security-Policy': string;
  'X-Content-Type-Options': string;
  'X-Frame-Options': string;
  'X-XSS-Protection': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Strict-Transport-Security'?: string;
}

export interface CORSConfig {
  origins: string[];
  methods: string[];
  headers: string[];
  credentials: boolean;
}

export const createSecurityMiddleware = (config: AppConfig) => {
  const corsConfig: CORSConfig = {
    origins: config.server.corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false,
  };

  const securityHeaders: SecurityHeaders = {
    // Content Security Policy - restrictive for security
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for Mermaid
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "media-src 'none'",
      "object-src 'none'",
      "frame-src 'none'",
    ].join('; '),

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Prevent clickjacking
    'X-Frame-Options': 'DENY',

    // Enable XSS protection
    'X-XSS-Protection': '1; mode=block',

    // Control referrer information
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions policy
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'interest-cohort=()'
    ].join(', '),
  };

  // Add HSTS in production
  if (process.env.NODE_ENV === 'production') {
    securityHeaders['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  const isOriginAllowed = (origin: string | undefined): boolean => {
    if (!origin) return false;

    // Allow any origin in development
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // Check against configured origins
    return corsConfig.origins.includes('*') ||
           corsConfig.origins.includes(origin) ||
           corsConfig.origins.some(allowed => {
             // Support wildcard patterns like *.example.com
             if (allowed.includes('*')) {
               const pattern = allowed.replace(/\*/g, '.*');
               return new RegExp(`^${pattern}$`).test(origin);
             }
             return false;
           });
  };

  const addSecurityHeaders = (headers: Headers): void => {
    Object.entries(securityHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  };

  const addCORSHeaders = (headers: Headers, origin?: string): void => {
    if (isOriginAllowed(origin)) {
      headers.set('Access-Control-Allow-Origin', origin || '*');
    }

    headers.set('Access-Control-Allow-Methods', corsConfig.methods.join(', '));
    headers.set('Access-Control-Allow-Headers', corsConfig.headers.join(', '));

    if (corsConfig.credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }

    headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  };

  const handlePreflight = (request: Request): Response => {
    const origin = request.headers.get('Origin');
    const headers = new Headers();

    addCORSHeaders(headers, origin || undefined);
    addSecurityHeaders(headers);

    return new Response(null, {
      status: 204,
      headers
    });
  };

  const wrapResponse = (response: Response, request: Request): Response => {
    const origin = request.headers.get('Origin');
    const headers = new Headers(response.headers);

    addSecurityHeaders(headers);
    addCORSHeaders(headers, origin || undefined);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };

  return {
    isOriginAllowed,
    handlePreflight,
    wrapResponse,
    addSecurityHeaders,
    addCORSHeaders,
  };
};

// Rate limiting middleware
export const createRateLimiter = () => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const MAX_REQUESTS = 100; // per window

  const getClientId = (request: Request): string => {
    // Use IP address as client identifier
    return request.headers.get('CF-Connecting-IP') ||
           request.headers.get('X-Forwarded-For') ||
           request.headers.get('X-Real-IP') ||
           'unknown';
  };

  const isRateLimited = (request: Request): { limited: boolean; remainingRequests?: number } => {
    const clientId = getClientId(request);
    const now = Date.now();

    const clientData = requests.get(clientId);

    if (!clientData || now > clientData.resetTime) {
      // New window or first request
      requests.set(clientId, {
        count: 1,
        resetTime: now + WINDOW_MS
      });
      return { limited: false, remainingRequests: MAX_REQUESTS - 1 };
    }

    if (clientData.count >= MAX_REQUESTS) {
      return { limited: true };
    }

    // Increment count
    clientData.count++;
    requests.set(clientId, clientData);

    return {
      limited: false,
      remainingRequests: MAX_REQUESTS - clientData.count
    };
  };

  // Cleanup old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [clientId, data] of requests.entries()) {
      if (now > data.resetTime) {
        requests.delete(clientId);
      }
    }
  }, WINDOW_MS);

  return { isRateLimited };
};

// Input sanitization helpers
export const sanitizeInput = {
  // Remove potentially dangerous characters from user input
  text: (input: string): string => {
    return input
      .replace(/[<>\"'&]/g, '') // Remove HTML/XML characters
      .replace(/\0/g, '')       // Remove null bytes
      .trim()
      .substring(0, 1000);      // Limit length
  },

  // Sanitize file paths to prevent directory traversal
  filename: (input: string): string => {
    return input
      .replace(/[\\/\\\\:*?\"<>|]/g, '_') // Replace dangerous path characters
      .replace(/\0/g, '')                // Remove null bytes
      .replace(/^[\\.\\s]+|[\\.\\s]+$/g, '') // Remove leading/trailing dots and spaces
      .substring(0, 100)                 // Limit length
      || 'unnamed';                      // Fallback name
  },

  // Basic email validation
  email: (input: string): string | null => {
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    const cleaned = input.trim().toLowerCase();
    return emailRegex.test(cleaned) ? cleaned : null;
  }
};