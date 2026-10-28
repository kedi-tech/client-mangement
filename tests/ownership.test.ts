import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ACTIVITY_CATEGORIES, oversightMessage } from "../src/lib/constants";

describe("oversight never names a client", () => {
  it("replaces every client-related message with generic text", () => {
    const clientTypes = [
      ...ACTIVITY_CATEGORIES.WORK.types,
      ...ACTIVITY_CATEGORIES.FILES.types,
      ...ACTIVITY_CATEGORIES.DELETION.types,
      "PORTAL_ACCESS_GRANTED",
      "PORTAL_ACCESS_REVOKED",
      "PORTAL_PASSWORD_RESET",
    ];
    for (const type of clientTypes) {
      const shown = oversightMessage({ type, message: "Northwind Logistics secret", clientId: "c1" });
      assert.ok(!shown.includes("Northwind"), `${type} leaked the client name`);
    }
  });

  it("hides client deletions even though they carry no client id", () => {
    const shown = oversightMessage({ type: "CLIENT_DELETED", message: "Northwind was deleted", clientId: null });
    assert.equal(shown, "Deleted a client");
  });

  it("hides unknown activity types that point at a client", () => {
    const shown = oversightMessage({ type: "SOMETHING_NEW", message: "Northwind did a thing", clientId: "c1" });
    assert.equal(shown, "Worked on a client");
  });

  it("keeps team administration messages as logged", () => {
    const message = "dana@example.com is now admin";
    assert.equal(oversightMessage({ type: "TEAM_ROLE_CHANGED", message, clientId: null }), message);
  });
});
