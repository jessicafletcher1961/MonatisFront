import { createContext } from "react";

export type Toast = {
  id: string;
  message: string;
};

export type ToastContextValue = {
  push: (message: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);
