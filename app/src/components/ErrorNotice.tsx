import type { ReactNode } from "react";
import { ApiError } from "../api/http";

interface ErrorNoticeProps {
  error: unknown;
  action?: ReactNode;
}

export function ErrorNotice({ error, action }: ErrorNoticeProps) {
  if (!error) return null;

  const message =
    error instanceof ApiError
      ? error.payload?.libelle ?? error.message
      : "Une erreur inattendue est survenue.";

  const code = error instanceof ApiError ? error.payload?.code : null;
  const typeErreur = error instanceof ApiError ? error.payload?.typeErreur : null;
  const typeDomaine = error instanceof ApiError ? error.payload?.typeDomaine : null;

  return (
    <div className="glass-card flex flex-col gap-2 border border-red-400/40 bg-[rgba(80,20,20,0.6)] px-5 py-4 rise-in-glam">
      <span className="badge-glam">Erreur</span>
      <p className="text-sm text-red-200">{message}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-red-200">
        {code ? <span className="badge-glam border-red-400/60 text-red-200">Code {code}</span> : null}
        {typeErreur ? (
          <span className="badge-glam border-red-400/60 text-red-200">{typeErreur}</span>
        ) : null}
        {typeDomaine ? (
          <span className="badge-glam border-red-400/60 text-red-200">{typeDomaine}</span>
        ) : null}
      </div>
      {action}
    </div>
  );
}
