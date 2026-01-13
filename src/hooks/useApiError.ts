import { useToast } from "./useToast";
import { extractErrorMessage } from "@/api/http";

export function useApiError() {
  const { toast } = useToast();

  return {
    notify: (e: any, title = "Erreur") => {
      toast({ title, message: extractErrorMessage(e), variant: "error" });
    }
  };
}
