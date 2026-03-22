type QueryPrimitive = string | number | boolean | null | undefined;
type QueryValue = QueryPrimitive | QueryPrimitive[];

export interface RequestOptions extends Omit<RequestInit, "body"> {
  query?: Record<string, QueryValue> | undefined;
  body?: BodyInit | object | null | undefined;
  timeoutMs?: number | undefined;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof URLSearchParams) &&
    !(value instanceof FormData) &&
    !(value instanceof Blob) &&
    !(value instanceof ArrayBuffer)
  );
}

function buildHeaders(headers: HeadersInit | undefined): Headers {
  return new Headers(headers);
}

function setDefaultHeader(headers: Headers, key: string, value: string): void {
  if (!headers.has(key)) {
    headers.set(key, value);
  }
}

function buildUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, QueryValue>,
): URL {
  const url = new URL(path, baseUrl);

  if (!query) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null) {
          url.searchParams.append(key, String(item));
        }
      }
      continue;
    }

    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

function buildBody(
  body: RequestOptions["body"],
  headers: Headers,
): BodyInit | null {
  if (body === undefined) {
    return null;
  }

  if (
    typeof body === "string" ||
    body instanceof URLSearchParams ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer
  ) {
    return body;
  }

  if (isPlainObject(body) || Array.isArray(body)) {
    setDefaultHeader(headers, "Content-Type", "application/json");
    return JSON.stringify(body);
  }

  return body as BodyInit;
}

export async function requestRaw(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<Response> {
  const headers = buildHeaders(options.headers);
  const url = buildUrl(baseUrl, path, options.query);
  const body = buildBody(options.body, headers);
  const timeoutMs = options.timeoutMs ?? 10_000;
  const signal = options.signal ?? AbortSignal.timeout(timeoutMs);

  const response = await fetch(url, {
    ...options,
    headers,
    body,
    signal,
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new HttpError(
      `${response.status} ${response.statusText} while requesting ${url}`,
      response.status,
      url.toString(),
      responseBody,
    );
  }

  return response;
}

export async function requestJsonWithResponse<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<{ body: T; response: Response }> {
  const response = await requestRaw(baseUrl, path, options);

  if (response.status === 204) {
    return { body: undefined as T, response };
  }

  const body = (await response.json()) as T;
  return { body, response };
}

export async function requestJson<T>(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body } = await requestJsonWithResponse<T>(baseUrl, path, options);
  return body;
}

export async function requestText(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<string> {
  const response = await requestRaw(baseUrl, path, options);
  return response.text();
}

export function nextLinkFromHeader(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  const parts = linkHeader.split(",");

  for (const part of parts) {
    const [urlPart, relPart] = part.split(";").map((value) => value.trim());

    if (
      relPart === 'rel="next"' &&
      urlPart?.startsWith("<") &&
      urlPart.endsWith(">")
    ) {
      return urlPart.slice(1, -1);
    }
  }

  return null;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
