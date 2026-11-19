import { useEffect, useState } from "react";

export function messageOf(e: unknown) {
  if (e instanceof Error) {
    if (e.message === "Unauthorized") return "Sessione scaduta. Entra di nuovo.";
    return e.message;
  }
  return "Qualcosa non ha funzionato.";
}

export function useLoad<T>(key: string, fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError("");
    fn()
      .then((value) => {
        if (!cancel) setData(value);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(messageOf(err));
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
    // The key is the contract: callers change it to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, error, loading };
}
