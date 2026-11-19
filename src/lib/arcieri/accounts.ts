const KEY = "aa-accounts";

export type SavedAccount = { email: string; name: string };

export function savedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      const row = item as { email?: unknown; name?: unknown };
      const email = String(row.email ?? "").trim().toLowerCase();
      const name = String(row.name ?? "").trim();
      return email ? [{ email, name: name || email }] : [];
    });
  } catch {
    return [];
  }
}

export function rememberAccount(account: SavedAccount) {
  if (typeof window === "undefined") return;
  const email = account.email.trim().toLowerCase();
  if (!email) return;
  const next = [{ email, name: account.name.trim() || email }, ...savedAccounts().filter((row) => row.email !== email)].slice(0, 8);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function forgetAccount(email: string) {
  if (typeof window === "undefined") return;
  const key = email.trim().toLowerCase();
  const next = savedAccounts().filter((row) => row.email !== key);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}
