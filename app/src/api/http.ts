import type { ErreurDto } from "../types/monatis";

export class ApiError extends Error {
  status: number;
  payload: ErreurDto | null;

  constructor(message: string, status: number, payload: ErreurDto | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8082";
const rawBasePath = import.meta.env.VITE_API_BASE_PATH ?? "/monatis";

const normalizedBaseUrl = rawBaseUrl.replace(/\/$/, "");
const normalizedBasePath = rawBasePath.startsWith("/") ? rawBasePath : `/${rawBasePath}`;

export const API_BASE_URL = `${normalizedBaseUrl}${normalizedBasePath}`;

function buildUrl(path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}

export async function fetchJson<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      "Accept-Language": "fr-FR",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const payload = data && typeof data === "object" ? (data as ErreurDto) : null;
    const message = payload?.libelle ?? `Erreur ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return data as T;
}

export async function fetchBlob(path: string, options: RequestInit = {}) {
  const response = await fetch(buildUrl(path), {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/pdf",
      "Accept-Language": "fr-FR",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    const data = text ? safeJsonParse(text) : null;
    const payload = data && typeof data === "object" ? (data as ErreurDto) : null;
    const message = payload?.libelle ?? `Erreur ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return response.blob();
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
