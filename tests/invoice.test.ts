import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  effectiveInvoiceStatus,
  invoiceTotals,
  isOutstanding,
  lineTotalCents,
  nextInvoiceNumber,
} from "../src/lib/invoice";
import { centsToInput, formatMoney, parseMoneyToCents } from "../src/lib/format";

const DAY = 24 * 60 * 60 * 1000;

describe("money conversion", () => {
  it("parses human input into integer cents", () => {
    assert.equal(parseMoneyToCents("1250.50"), 125050);
    assert.equal(parseMoneyToCents("$1,250.50"), 125050);
    assert.equal(parseMoneyToCents(""), 0);
    assert.equal(parseMoneyToCents(null), 0);
    assert.equal(parseMoneyToCents("not a number"), 0);
  });

  it("round-trips through the input format", () => {
    assert.equal(centsToInput(parseMoneyToCents("99.99")), "99.99");
    assert.equal(centsToInput(0), "0.00");
  });

  it("formats cents as currency", () => {
    assert.equal(formatMoney(605275), "$6,052.75");
    assert.equal(formatMoney(0), "$0.00");
  });
});

describe("invoice totals", () => {
  it("sums lines and applies tax", () => {
    const totals = invoiceTotals(
      [
        { quantity: 2, unitPriceCents: 150000 },
        { quantity: 10, unitPriceCents: 25025 },
      ],
      10,
    );
    assert.equal(totals.subtotalCents, 550250);
    assert.equal(totals.taxCents, 55025);
    assert.equal(totals.totalCents, 605275);
  });

  it("handles a zero tax rate and no lines", () => {
    assert.deepEqual(invoiceTotals([], 0), {
      subtotalCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it("rounds fractional quantities per line", () => {
    assert.equal(lineTotalCents({ quantity: 1.5, unitPriceCents: 3333 }), 5000);
  });
});

describe("effective invoice status", () => {
  const past = new Date(Date.now() - 5 * DAY);
  const future = new Date(Date.now() + 5 * DAY);

  it("marks a sent invoice overdue once the due date passes", () => {
    assert.equal(effectiveInvoiceStatus({ status: "SENT", dueDate: past }), "OVERDUE");
    assert.equal(effectiveInvoiceStatus({ status: "SENT", dueDate: future }), "SENT");
  });

  it("never overrides a terminal status", () => {
    assert.equal(effectiveInvoiceStatus({ status: "PAID", dueDate: past }), "PAID");
    assert.equal(effectiveInvoiceStatus({ status: "VOID", dueDate: past }), "VOID");
    assert.equal(effectiveInvoiceStatus({ status: "DRAFT", dueDate: past }), "DRAFT");
  });

  it("counts only unpaid sent work as outstanding", () => {
    assert.equal(isOutstanding("SENT"), true);
    assert.equal(isOutstanding("OVERDUE"), true);
    assert.equal(isOutstanding("PAID"), false);
    assert.equal(isOutstanding("DRAFT"), false);
    assert.equal(isOutstanding("VOID"), false);
  });
});

describe("invoice numbering", () => {
  it("increments the trailing number", () => {
    assert.equal(nextInvoiceNumber("INV-1008"), "INV-1009");
    assert.equal(nextInvoiceNumber("2024-07"), "INV-8");
  });

  it("starts a fresh sequence when there is nothing to follow", () => {
    assert.equal(nextInvoiceNumber(null), "INV-1001");
    assert.equal(nextInvoiceNumber("DRAFT"), "INV-1001");
  });
});
