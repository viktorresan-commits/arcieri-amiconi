export function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

/**
 * Workspace preview vs deployed app. The deployer writes GROK_PROJECT_ID on
 * every publish; the sandbox preview never has it. Single source of truth for
 * the split — gate audience, gate endpoints and connector-token semantics all
 * key off this predicate.
 */
export function isWorkspacePreview(): boolean {
  return !env("GROK_PROJECT_ID") && !env("VERCEL");
}

/** L'app gira sulla piattaforma Grok (pubblicata o in anteprima)? Fuori da Grok niente gate né login Grok. */
export function onGrokPlatform(): boolean {
  return Boolean(env("GROK_PROJECT_ID")) || isWorkspacePreview();
}
