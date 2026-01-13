import axios from "axios";
import type { ErreurDto } from "@/types/dto";

function normalizeBaseUrl(base: string): string {
  return base.replace(/\/$/, "");
}

function joinUrl(base: string, path: string): string {
  // Avoid double "/monatis" if base already includes it.
  const b = normalizeBaseUrl(base);
  const p = path.startsWith("/") ? path : `/${path}`;

  const baseHasMonatis = /\/monatis$/i.test(b);
  const pathHasMonatis = /^\/monatis(\/|$)/i.test(p);

  if (baseHasMonatis && pathHasMonatis) {
    return b + p.replace(/^\/monatis/i, "");
  }
  return b + p;
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8082",
  timeout: 20000
});

// We override request to use joinUrl, so consumers always pass the "catalog path" (often starting with /monatis)
http.interceptors.request.use((config) => {
  if (config.url) {
    const base = config.baseURL ?? "";
    config.baseURL = undefined; // prevent axios from re-joining
    config.url = joinUrl(base as string, config.url);
  }
  return config;
});

function formatErreurDto(err: ErreurDto, depth = 0): string {
  if (!err) return "";
  const base = `${err.typeDomaine ?? ""} ${err.code ?? ""}`.trim();
  const msg = err.libelle ?? "";
  const head = [base, msg].filter(Boolean).join(" - ");
  if (err.cause && depth < 3) return `${head}\nCause: ${formatErreurDto(err.cause, depth + 1)}`;
  return head;
}

export function extractErrorMessage(e: any): string {
  const data = e?.response?.data;
  if (data && typeof data === "object" && ("libelle" in data || "code" in data)) {
    try {
      return formatErreurDto(data as ErreurDto) || "Erreur serveur";
    } catch {
      // ignore
    }
  }
  if (typeof data === "string" && data.trim().length > 0) return data;
  return e?.message ?? "Erreur inconnue";
}
