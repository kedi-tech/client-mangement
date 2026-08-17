import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { homePathFor, isPortalRole } from "../src/lib/auth-token";
import { humanFileSize, plural } from "../src/lib/format";
import { projectProgress } from "../src/lib/progress";
import { isAllowedUpload, isInlineSafe, safeFilename } from "../src/lib/upload-rules";

describe("role routing", () => {
  it("treats only CLIENT as a portal role", () => {
    assert.equal(isPortalRole("CLIENT"), true);
    assert.equal(isPortalRole("ADMIN"), false);
    assert.equal(isPortalRole("MEMBER"), false);
  });

  it("sends each role to its own home", () => {
    assert.equal(homePathFor("CLIENT"), "/portal");
    assert.equal(homePathFor("ADMIN"), "/dashboard");
    assert.equal(homePathFor("MEMBER"), "/dashboard");
  });
});

describe("project progress", () => {
  it("counts done and in-progress tasks", () => {
    const progress = projectProgress([
      { status: "DONE" },
      { status: "DONE" },
      { status: "IN_PROGRESS" },
      { status: "TODO" },
    ]);
    assert.equal(progress.total, 4);
    assert.equal(progress.done, 2);
    assert.equal(progress.inProgress, 1);
    assert.equal(progress.percent, 50);
  });

  it("reports 0% rather than NaN for a project with no tasks", () => {
    assert.deepEqual(projectProgress([]), {
      total: 0,
      done: 0,
      inProgress: 0,
      percent: 0,
    });
  });

  it("reaches 100% only when every task is done", () => {
    assert.equal(projectProgress([{ status: "DONE" }]).percent, 100);
    assert.equal(projectProgress([{ status: "DONE" }, { status: "TODO" }]).percent, 50);
  });
});

describe("upload filename safety", () => {
  it("strips directory traversal", () => {
    assert.equal(safeFilename("../../etc/passwd"), "passwd");
    assert.equal(safeFilename("/absolute/path/report.pdf"), "report.pdf");
    assert.equal(safeFilename("C:\\Users\\me\\notes.txt"), "C_Users_me_notes.txt");
  });

  it("keeps ordinary names readable", () => {
    assert.equal(safeFilename("Q3 Report (final).pdf"), "Q3 Report (final).pdf");
    assert.equal(safeFilename("depot-list_2026.csv"), "depot-list_2026.csv");
  });

  it("replaces unsafe characters and never returns an empty name", () => {
    assert.equal(safeFilename('inv"oice;rm -rf.pdf'), "inv_oice_rm -rf.pdf");
    assert.equal(safeFilename(""), "file");
    assert.equal(safeFilename("///"), "file");
  });

  it("caps the length", () => {
    assert.ok(safeFilename(`${"a".repeat(500)}.pdf`).length <= 180);
  });
});

describe("upload policy", () => {
  it("accepts documents and images", () => {
    assert.equal(isAllowedUpload("report.pdf", "application/pdf"), true);
    assert.equal(isAllowedUpload("photo.png", "image/png"), true);
    assert.equal(isAllowedUpload("data.csv", "text/csv"), true);
  });

  it("rejects executables and scripts", () => {
    assert.equal(isAllowedUpload("payload.sh", "text/x-shellscript"), false);
    assert.equal(isAllowedUpload("app.exe", "application/octet-stream"), false);
    assert.equal(isAllowedUpload("script.js", "text/javascript"), false);
  });

  it("falls back to the extension when the browser sends a generic type", () => {
    assert.equal(isAllowedUpload("notes.txt", "application/octet-stream"), true);
    assert.equal(isAllowedUpload("notes.txt", ""), true);
  });

  it("rejects a mismatched type even with an allowed extension", () => {
    assert.equal(isAllowedUpload("invoice.pdf", "text/x-shellscript"), false);
  });

  it("never renders SVG inline", () => {
    assert.equal(isInlineSafe("image/svg+xml"), false);
    assert.equal(isInlineSafe("application/pdf"), true);
    assert.equal(isInlineSafe("image/png"), true);
    assert.equal(isInlineSafe("text/html"), false);
  });
});

describe("presentation helpers", () => {
  it("pluralises counts", () => {
    assert.equal(plural(1, "step"), "1 step");
    assert.equal(plural(0, "step"), "0 steps");
    assert.equal(plural(3, "step"), "3 steps");
    assert.equal(plural(2, "entry", "entries"), "2 entries");
  });

  it("formats file sizes", () => {
    assert.equal(humanFileSize(812), "812 B");
    assert.equal(humanFileSize(1024), "1 KB");
    assert.equal(humanFileSize(1.5 * 1024 * 1024), "1.5 MB");
    assert.equal(humanFileSize(25 * 1024 * 1024), "25 MB");
  });
});
