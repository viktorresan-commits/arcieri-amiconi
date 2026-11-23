import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { clearReadNotifications, deleteMessage, listMessages, listNotifications, markNotificationsRead, postMessage } from "@/lib/arcieri/members.api";
import { memberLabel } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { Button, Card, ErrorNote, Loading, PageHead, TextArea } from "@/components/kit";

export const Route = createFileRoute("/_app/bacheca")({ component: Page });

function Page() {
  const [nonce, setNonce] = useState(0);
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const notes = useLoad(`n-${nonce}`, () => listNotifications());
  const posts = useLoad(`m-${nonce}`, () => listMessages());
  return (
    <div className="grid gap-3">
      <PageHead title="Bacheca" lede="Avvisi del gruppo. Le notifiche arrivano solo per gare, sfide e medaglie, non a ogni messaggio." />
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-2xl">Avvisi {notes.data ? `(${notes.data.unread})` : ""}</h2>
          <div className="flex items-center gap-3">
            {notes.data?.unread ? <button type="button" className="text-sm font-semibold text-accent" onClick={() => markNotificationsRead().then(() => setNonce((n) => n + 1))}>Segna letti</button> : null}
            {notes.data?.items.some((n) => n.read) ? (
              <button type="button" className="text-sm font-semibold text-muted underline-offset-2 hover:underline" onClick={() => clearReadNotifications().then(() => setNonce((n) => n + 1))}>Svuota letti</button>
            ) : null}
          </div>
        </div>
        {(notes.data?.items ?? []).map((n) => {
          const [path, hash] = (n.href || "/bacheca").split("#");
          return (
            <Link key={n.id} to={path || "/bacheca"} hash={hash} className="flex items-start justify-between gap-3 border-t border-line py-3">
              <span>
                <span className="block font-semibold">{n.title}</span>
                {n.body ? <span className="text-sm text-muted">{n.body}</span> : null}
              </span>
              {n.read ? null : <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />}
            </Link>
          );
        })}
        {notes.data && notes.data.items.length === 0 ? <p className="text-sm text-muted">Niente in coda.</p> : null}
      </Card>
      <Card className="grid gap-2">
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Scrivi al gruppo" />
        {err ? <ErrorNote text={err} /> : null}
        <Button onClick={() => postMessage({ data: { body } }).then(() => { setBody(""); setNonce((n) => n + 1); }).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"))}>Pubblica</Button>
      </Card>
      {posts.loading ? <Loading /> : null}
      <div className="grid gap-2">
        {(posts.data ?? []).map((m) => (
          <Card key={m.id} className="p-3">
            <p className="text-xs text-muted">{memberLabel(m, posts.data ?? [])}</p>
            <p className="text-sm">{m.body}</p>
            {m.mine ? <button type="button" className="mt-1 text-xs text-danger" onClick={() => deleteMessage({ data: { id: m.id } }).then(() => setNonce((n) => n + 1))}>Elimina</button> : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
