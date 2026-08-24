import test from "node:test";
import assert from "node:assert/strict";
import { buildFriendRequestMessage, classifyEngagementSafety, firstContactReplyInstruction, selectInboundReaction } from "../src/personal_engagement.js";

test("personal engagement never reacts cheerfully to sensitive messages", () => {
  assert.equal(classifyEngagementSafety("Cảm ơn nhưng em đang rất buồn"), "sensitive");
  assert.equal(selectInboundReaction("Cảm ơn nhưng em đang rất buồn"), "");
});

test("personal engagement selects only contextual acknowledgement reactions", () => {
  assert.equal(selectInboundReaction("Cảm ơn Amon nhiều ❤️"), "heart");
  assert.equal(selectInboundReaction("Chào Amon"), "like");
  assert.equal(selectInboundReaction("Giúp mình sửa hợp đồng này"), "");
});

test("personal engagement offers bounded reusable copy", () => {
  assert.match(buildFriendRequestMessage("Amon"), /Amon/u);
  assert.match(firstContactReplyInstruction("Amon"), /lượt DM đầu tiên/u);
});
