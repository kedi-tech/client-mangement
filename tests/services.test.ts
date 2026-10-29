import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renewalStatus } from "../src/lib/services";

const NOW = new Date("2026-10-29T12:00:00Z");
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

describe("renewalStatus", () => {
  it("says when there is no renewal date", () => {
    assert.deepEqual(renewalStatus(null, NOW), { label: "No renewal date", state: "none" });
  });

  it("flags a lapsed domain as expired", () => {
    const status = renewalStatus(daysFromNow(-2), NOW);
    assert.equal(status.state, "expired");
    assert.match(status.label, /^Expired /);
  });

  it("warns within 30 days, counting the days left", () => {
    assert.equal(renewalStatus(daysFromNow(5), NOW).state, "soon");
    assert.match(renewalStatus(daysFromNow(5), NOW).label, /in 5 days$/);
    assert.match(renewalStatus(daysFromNow(1), NOW).label, /tomorrow$/);
    assert.equal(renewalStatus(daysFromNow(30), NOW).state, "soon");
  });

  it("is quiet further out", () => {
    assert.equal(renewalStatus(daysFromNow(31), NOW).state, "ok");
  });
});
