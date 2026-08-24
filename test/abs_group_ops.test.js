import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createApp } from "../src/server.js";
import { loadConfig } from "../src/config.js";
import { Store } from "../src/store.js";
import { PolicyGuard } from "../src/policy.js";
import { BridgeHub } from "../src/zalo_runtime.js";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "abs-group-ops-test-"));
}

async function listen(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const address = server.address();
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test("ABS Zalo Runtime methods & Server endpoints for group management and polls", async (t) => {
  const dir = tempDir();
  const configPath = path.join(dir, "config.toml");
  fs.writeFileSync(configPath, 'default_account_id="default"\nretention_days=30\n');
  const config = loadConfig(configPath);
  const store = new Store(dir);
  store.seedFromConfig(config);
  const policy = new PolicyGuard({ config, store });

  const mockApi = {
    removeUserFromGroup: async (members, grid) => ({ error: 0, message: "ok", grid, members }),
    changeGroupOwner: async (newAdminId, grid) => ({ error: 0, message: "ok", grid, newAdminId }),
    addGroupDeputy: async (members, grid) => ({ error: 0, message: "ok", grid, members }),
    removeGroupDeputy: async (members, grid) => ({ error: 0, message: "ok", grid, members }),
    addUserToGroup: async (members, grid) => ({ error: 0, message: "ok", grid, members }),
    createPoll: async (opts, grid) => ({ error: 0, message: "ok", grid, poll_id: "p123", ...opts }),
    lockPoll: async (pollId) => ({ error: 0, message: "ok", pollId }),
    addReaction: async (icon, dest) => ({ error: 0, message: "ok", icon, dest }),
    undo: async (dest, threadId, threadType) => ({ error: 0, message: "ok", dest, threadId, threadType }),
    getUserInfo: async (userId) => ({ error: 0, data: { userId, displayName: "Test User" } }),
    getGroupInfo: async (groupId) => ({ error: 0, data: { groupId, groupName: "Test Group" } }),
    findUser: async (phone) => ({ error: 0, data: { phone, userId: "u123" } }),
    getAllFriends: async () => ({ error: 0, data: [{ userId: "u1" }] }),
    getAllGroups: async () => ({ error: 0, data: [{ groupId: "g1" }] }),
    sendMessage: async (message, threadId, type) => ({ message, threadId, type }),
    sendSticker: async (sticker, threadId, type) => ({ sticker, threadId, type }),
    sendTypingEvent: async (threadId, type) => ({ threadId, type }),
    createGroup: async (options) => ({ groupId: "new-group", ...options }),
    changeGroupName: async (name, groupId) => ({ name, groupId }),
    leaveGroup: async (groupId, silent) => ({ groupId, silent }),
    acceptFriendRequest: async (userId) => ({ accepted: userId }),
    sendFriendRequest: async (message, userId) => ({ message, userId }),
  };

  const hub = new BridgeHub({ config, store, policy, clientFactory: {} });
  const runtime = hub.getRuntime("default");
  runtime.api = mockApi;

  const app = createApp({ config, store, policy, hub });
  const { server, base } = await listen(app);

  t.after(() => {
    server.close();
  });

  // Test Direct Runtime Methods
  await t.test("Runtime direct method invocations", async () => {
    const kickRes = await runtime.removeUserFromGroup("group1", "user1");
    assert.equal(kickRes.error, 0);
    assert.deepEqual(kickRes.members, ["user1"]);

    const transferRes = await runtime.changeGroupOwner("group1", "user2");
    assert.equal(transferRes.newAdminId, "user2");

    const deputyAddRes = await runtime.addGroupDeputy("group1", ["user3"]);
    assert.deepEqual(deputyAddRes.members, ["user3"]);

    const pollRes = await runtime.createPoll("group1", { question: "Q?", options: ["A", "B"] });
    assert.equal(pollRes.poll_id, "p123");
    assert.equal(pollRes.question, "Q?");

    const reply = await runtime.performPersonalAction("send_message", {
      text: "Xin chào", thread_id: "u1", thread_type: 0,
      quote: { msgId: "m1" }, mentions: [{ uid: "u1", pos: 0, len: 2 }]
    });
    assert.equal(reply.threadId, "u1");
    assert.equal(reply.type, 0);
    assert.equal(reply.message.quote.msgId, "m1");
    assert.equal((await runtime.performPersonalAction("friend_request", { user_id: "u2", message: "Kết bạn nhé" })).userId, "u2");
    assert.equal((await runtime.performPersonalAction("rename_group", { group_id: "g1", group_name: "Nhóm mới" })).name, "Nhóm mới");
  });

  // Test Express REST Endpoints
  await t.test("REST API endpoints for group ops", async () => {
    // 1. Kick
    const kickRes = await fetch(`${base}/api/groups/group1/kick`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: "u99" }),
    });
    const kickData = await kickRes.json();
    assert.equal(kickData.ok, true);
    assert.deepEqual(kickData.result.members, ["u99"]);

    // 2. Transfer Owner
    const transferRes = await fetch(`${base}/api/groups/group1/transfer-owner`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ new_owner_id: "u88" }),
    });
    const transferData = await transferRes.json();
    assert.equal(transferData.ok, true);
    assert.equal(transferData.result.newAdminId, "u88");

    // 3. Add Deputy
    const deputyRes = await fetch(`${base}/api/groups/group1/deputies/add`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: "u77" }),
    });
    const deputyData = await deputyRes.json();
    assert.equal(deputyData.ok, true);
    assert.deepEqual(deputyData.result.members, ["u77"]);

    // 4. Create Poll
    const pollRes = await fetch(`${base}/api/groups/group1/polls`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "Vote?", options: ["Yes", "No"] }),
    });
    const pollData = await pollRes.json();
    assert.equal(pollData.ok, true);
    assert.equal(pollData.result.question, "Vote?");

    // 5. User & Group Info
    const userRes = await fetch(`${base}/api/user-info/u123`);
    const userData = await userRes.json();
    assert.equal(userData.ok, true);
    assert.equal(userData.result.data.userId, "u123");

    const groupRes = await fetch(`${base}/api/group-info/g123`);
    const groupData = await groupRes.json();
    assert.equal(groupData.ok, true);
    assert.equal(groupData.result.data.groupId, "g123");

    const denied = await fetch(`${base}/api/personal/actions`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "typing", payload: { thread_id: "u1", thread_type: 0 } })
    });
    assert.equal(denied.status, 400);

    const actionRes = await fetch(`${base}/api/personal/actions`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true, action: "typing", payload: { thread_id: "u1", thread_type: 0 } })
    });
    const actionData = await actionRes.json();
    assert.equal(actionData.ok, true);
    assert.equal(actionData.result.threadId, "u1");
  });

  await t.test("Hermes bridge v1 is cursor-safe and allowlist-gated", async () => {
    const prior = process.env.HERMES_ZALO_ALLOWED_THREADS;
    process.env.HERMES_ZALO_ALLOWED_THREADS = "dm-hermes";
    t.after(() => {
      if (prior == null) delete process.env.HERMES_ZALO_ALLOWED_THREADS;
      else process.env.HERMES_ZALO_ALLOWED_THREADS = prior;
    });
    store.upsertSource({ accountId: "default", sourceId: "dm-hermes", sourceType: "dm", sourceName: "Hermes test", mode: "reply_enabled", isAllowed: true });
    store.putEvent({
      event_id: "event-hermes-1", account_id: "default", source_id: "dm-hermes", source_type: "dm",
      source_name: "Hermes test", sender_id: "user-hermes", sender_name: "Tester", message_id: "msg-hermes-1",
      message_type: "text", text: "xin chào", created_at: "2026-08-24T05:00:00.000Z",
    });
    const health = await fetch(`${base}/v1/hermes/health`);
    assert.equal((await health.json()).protocol, "zalo-bridge/v1");
    const events = await fetch(`${base}/v1/hermes/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ limit: 10 }) });
    const eventData = await events.json();
    assert.equal(eventData.events.length, 1);
    assert.equal(eventData.events[0].thread.id, "dm-hermes");
    const sent = await fetch(`${base}/v1/hermes/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ thread_id: "dm-hermes", text: "đã nhận", reply_to: "msg-hermes-1" }) });
    assert.equal((await sent.json()).ok, true);
    const blocked = await fetch(`${base}/v1/hermes/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ thread_id: "not-allowed", text: "không gửi" }) });
    assert.equal(blocked.status, 400);
    assert.equal((await blocked.json()).error, "thread_not_allowlisted");
  });
});
