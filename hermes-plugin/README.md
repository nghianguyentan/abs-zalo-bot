# ABS Zalo platform plugin for Hermes

This is a **Hermes platform plugin**, not a Zalo login client. The Node bridge
keeps QR/session material, raw provider payloads, media staging, outbound policy
and audit locally. The Python plugin receives only normalized, allowlisted events
over the authenticated `zalo-bridge/v1` endpoint.

## Install

Copy the `platforms/zalo` directory into the Hermes user plugin path:

```bash
mkdir -p ~/.hermes/plugins
cp -R node_modules/abs-zalo-bot/hermes-plugin/platforms/zalo ~/.hermes/plugins/zalo
hermes plugins enable abs-zalo-platform
```

Set these values in both private processes (never commit them):

```text
# ABS Zalo bridge host
DASHBOARD_TOKEN=<strong-private-token>
HERMES_ZALO_GATEWAY_ENABLED=true
HERMES_ZALO_ALLOW_AUTOREPLY=false
HERMES_ZALO_ALLOWED_THREADS=<approved-zalo-thread-id>
HERMES_ZALO_ALLOWED_USERS=<approved-sender-reference>
HERMES_ZALO_GROUP_MODE=mention

# Hermes gateway host
HERMES_ZALO_BRIDGE_URL=http://127.0.0.1:3871
HERMES_ZALO_BRIDGE_TOKEN=<same-strong-private-token>
HERMES_ZALO_ALLOWED_USERS=<same-approved-sender-reference>
```

Start with `HERMES_ZALO_ALLOW_AUTOREPLY=false`: Hermes may connect and receive
only already-approved inbound messages, while the bridge rejects all typing and
reply sends. Turn it on only after checking `/api/readiness`, a selected profile,
and one narrow destination allowlist.

`HERMES_ZALO_ALLOWED_USERS` contains the privacy-safe sender reference returned
by the bridge event feed/dashboard, not a display name. An empty list denies all
inbound events. In groups, `mention` (the default) requires a Zalo mention; use
`all` only for a deliberately approved, single-purpose group.

## Profiles and quality

The bridge selects an `[[agent_profiles]]` record by exact `account_id` +
`source_id`, then account default. Set its `gateway_skill` to the name of an
owner-authored Hermes skill (for example `sales-concierge`); Hermes auto-loads it
for that profile's turns. This makes identity, brand voice, operating rules,
knowledge and tools explicit instead of hoping that a generic model prompt will
infer them from chat history.

The plugin deliberately does not forward provider media URLs, QR/session data,
or generic Zalo SDK methods. Staged attachment metadata is visible only as an
opaque reference and normal bridge/MCP policy still controls any side effect.
