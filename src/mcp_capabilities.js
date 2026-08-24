// MCP exposure is deliberately narrow by default. This is defense in depth;
// bridge-side PolicyGuard and explicit confirmation remain authoritative.

const RANK = { reader: 0, operator: 1, admin: 2 };

export function normalizeToolPack(value) {
  const pack = String(value || "reader").trim().toLowerCase();
  if (!(pack in RANK)) throw new Error("ABS_ZALO_TOOL_PACK must be reader, operator, or admin");
  return pack;
}

export function canUseToolPack(activePack, requiredPack) {
  return RANK[normalizeToolPack(activePack)] >= RANK[normalizeToolPack(requiredPack)];
}

export function requiredToolPackForBridgeRequest(path, method = "GET") {
  if (String(method).toUpperCase() === "GET") return "reader";
  if (path === "/api/corpus/backfill") return "reader";
  if (
    path === "/api/reactions" ||
    path === "/api/messages/undo" ||
    /^\/api\/groups\/[^/]+\/polls$/.test(path) ||
    /^\/api\/polls\/[^/]+\/lock$/.test(path)
  ) return "operator";
  return "admin";
}

export function capabilityPackSummary(activePack) {
  const pack = normalizeToolPack(activePack);
  return {
    active_pack: pack,
    levels: {
      reader: "status, discovery, corpus and read-only backfill",
      operator: "reader plus reactions, polls and message recall",
      admin: "operator plus personal lifecycle and group administration",
    },
    note: "This MCP pack is an additional guard. Personal lifecycle actions still require confirm: true at the bridge.",
  };
}
