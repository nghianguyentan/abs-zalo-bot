// Versioned, profile-scoped adapter contract for external Hermes platform plugins.
// It deliberately exposes no QR/session/raw provider state.
import { sha256 } from "./schema.js";

function decodeCursor(value) {
  if (!value) return { createdAt: "", eventId: "" };
  try {
    const parsed = JSON.parse(Buffer.from(String(value), "base64url").toString("utf8"));
    return { createdAt: String(parsed.created_at || ""), eventId: String(parsed.event_id || "") };
  } catch {
    throw new Error("invalid_cursor");
  }
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({ created_at: row.created_at, event_id: row.event_id })).toString("base64url");
}

function allowedThreads() {
  return new Set(String(process.env.HERMES_ZALO_ALLOWED_THREADS || "").split(",").map((v) => v.trim()).filter(Boolean));
}

export function createHermesBridge({ config, store, hub }) {
  const accountId = () => String(process.env.HERMES_ZALO_ACCOUNT_ID || config.default_account_id);
  return {
    health() {
      const id = accountId();
      const account = store.getAccount(id);
      const runtime = hub.getRuntime(id);
      return {
        ok: true,
        protocol: "zalo-bridge/v1",
        connected: account?.status === "connected" && Boolean(runtime?.api),
        account_ref: `zalo:${sha256(id).slice(0, 16)}`,
        capabilities: ["text", "typing", "reply", "event-poll"],
      };
    },
    events({ cursor = "", limit = 50 } = {}) {
      const id = accountId();
      const after = decodeCursor(cursor);
      const rows = store.hermesEventsAfter({ accountId: id, ...after, limit });
      const last = rows.at(-1);
      return {
        ok: true,
        events: rows.map((row) => ({
          id: row.event_id,
          is_self: Boolean(row.is_self),
          thread: { id: row.source_id, kind: row.source_type === "group" ? "group" : "dm", name: row.source_name || "" },
          sender: { id: row.sender_id, display_name: row.sender_name || "" },
          message: { id: row.message_id || row.event_id, type: row.message_type, text: row.text || "" },
          occurred_at: row.created_at,
        })),
        next_cursor: last ? encodeCursor(last) : String(cursor || ""),
      };
    },
    async sendMessage({ threadId, text, replyTo = null, threadType = null } = {}) {
      const thread = String(threadId || "").trim();
      const body = String(text || "").trim();
      if (!thread || !body || body.length > 4000) throw new Error("invalid_message");
      if (!allowedThreads().has(thread)) throw new Error("thread_not_allowlisted");
      const runtime = hub.getRuntime(accountId());
      const source = store.listSources(accountId()).find((item) => String(item.source_id) === thread);
      const resolvedThreadType = Number(threadType) === 0 ? 0 : source?.source_type === "dm" ? 0 : 1;
      const result = await runtime.performPersonalAction("send_message", {
        thread_id: thread,
        thread_type: resolvedThreadType,
        text: body,
        quote: replyTo ? { msgId: String(replyTo) } : undefined,
      });
      store.audit({ accountId: accountId(), actorId: "hermes-zalo-plugin", action: "hermes_bridge_send", detail: `thread=${sha256(thread).slice(0, 12)}` });
      return { ok: true, message_id: String(result?.messageId || result?.msgId || "") };
    },
    async typing({ threadId, threadType = null } = {}) {
      const thread = String(threadId || "").trim();
      if (!thread || !allowedThreads().has(thread)) throw new Error("thread_not_allowlisted");
      const source = store.listSources(accountId()).find((item) => String(item.source_id) === thread);
      const resolvedThreadType = Number(threadType) === 0 ? 0 : source?.source_type === "dm" ? 0 : 1;
      await hub.getRuntime(accountId()).performPersonalAction("typing", { thread_id: thread, thread_type: resolvedThreadType });
      return { ok: true };
    },
  };
}
