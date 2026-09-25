import assert from "node:assert/strict";
import { needsFollowUp } from "../src/legal-delivery.js";

const now = new Date("2026-09-16T12:00:00Z");
assert.equal(needsFollowUp({ status: "delivered" }, now), false);
assert.equal(needsFollowUp({ status: "queued" }, now), true);
assert.equal(needsFollowUp({ status: "sent", deliveredAt: "2026-09-16T11:30:00Z" }, now), true);
assert.equal(needsFollowUp({ status: "sent", deliveredAt: "2026-09-16T11:55:00Z" }, now), false);
console.log("delivery decision test passed");
