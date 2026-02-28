const BASE_URL = '/api';

let csrfToken: string | null = null;

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public errorType = 'Error',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setCsrfToken(token: string) {
  csrfToken = token;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const existingHeaders = (options.headers ?? {}) as Record<string, string>;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...existingHeaders,
  };

  // Add CSRF token for state-changing requests
  if (csrfToken && options.method && !['GET', 'HEAD'].includes(options.method)) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    // On 403, it might be CSRF token expiry — clear it
    if (response.status === 403) {
      csrfToken = null;
    }

    let errorData: { message?: string; error?: string };
    try {
      errorData = await response.json() as { message?: string; error?: string };
    } catch {
      errorData = { message: response.statusText };
    }

    throw new ApiError(
      response.status,
      errorData.message ?? 'An error occurred',
      errorData.error ?? 'Error',
    );
  }

  return response.json() as Promise<T>;
}

export function get<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' });
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}
