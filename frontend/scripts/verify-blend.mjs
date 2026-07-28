#!/usr/bin/env node
// Checks the blend maths that Insights and the History rows read from.
//
// The project has no test runner, so this compiles src/lib/blend.ts on its own
// (its only import is a type, which tsc elides) and asserts against the real
// emitted module rather than a copy of the logic. Run with:
//
//   node scripts/verify-blend.mjs
//
// Exits non-zero on the first failure, so it can gate a build.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");
const outDir = mkdtempSync(path.join(tmpdir(), "avirlog-blend-"));

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failures += 1;
    console.log(`  FAIL  ${name}\n        ${e.message.split("\n")[0]}`);
  }
}

try {
  // tsc reports the unresolved "@/src/theme/theme" path but still emits, because
  // the import is type-only. Tolerate a non-zero exit and check the output.
  try {
    execFileSync(
      "npx",
      [
        "tsc",
        "src/lib/blend.ts",
        "--outDir",
        outDir,
        "--module",
        "commonjs",
        "--target",
        "es2020",
        "--skipLibCheck",
      ],
      { cwd: projectRoot, stdio: "pipe" },
    );
  } catch {
    // emit-with-errors is expected here
  }

  const mod = await import(path.join(outDir, "blend.js"));
  const { blendToState, stateToBlend, clampPct, formatBlendSplit, blendStats, blendByDay } =
    mod.default ?? mod;

  console.log("blend maths");

  check("thresholds match the widget and Live Activity presets", () => {
    assert.equal(blendToState(100), "right");
    assert.equal(blendToState(65), "right");
    assert.equal(blendToState(55), "right");
    assert.equal(blendToState(54), "both");
    assert.equal(blendToState(50), "both");
    assert.equal(blendToState(46), "both");
    assert.equal(blendToState(45), "left");
    assert.equal(blendToState(20), "left");
    assert.equal(blendToState(0), "left");
  });

  check("stateToBlend round-trips through blendToState", () => {
    for (const s of ["left", "right", "both"]) {
      assert.equal(blendToState(stateToBlend(s)), s);
    }
  });

  check("clampPct keeps percentages in range", () => {
    assert.equal(clampPct(-10), 0);
    assert.equal(clampPct(110), 100);
    assert.equal(clampPct(33.4), 33);
    assert.equal(clampPct(33.6), 34);
    assert.equal(clampPct(Number.NaN), 50);
    assert.equal(clampPct(Number.POSITIVE_INFINITY), 50);
  });

  check("formatBlendSplit reads as left/right and always totals 100", () => {
    assert.equal(formatBlendSplit(65), "35% left · 65% right");
    assert.equal(formatBlendSplit(0), "100% left · 0% right");
    assert.equal(formatBlendSplit(100), "0% left · 100% right");
    for (let r = 0; r <= 100; r += 7) {
      const [, l, rr] = formatBlendSplit(r).match(/^(\d+)% left · (\d+)% right$/);
      assert.equal(Number(l) + Number(rr), 100, `${r} did not total 100`);
    }
  });

  check("blendStats returns null for no blend logs", () => {
    assert.equal(blendStats([]), null);
    assert.equal(blendStats([Number.NaN].filter(() => false)), null);
  });

  check("blendStats averages, leans and measures swing", () => {
    const even = blendStats([20, 80]);
    assert.equal(even.count, 2);
    assert.equal(even.avgRight, 50);
    assert.equal(even.lean, "both");
    assert.equal(even.swing, 60);
    assert.equal(even.shares.left, 0.5);
    assert.equal(even.shares.right, 0.5);
    assert.equal(even.shares.both, 0);

    const right = blendStats([70, 80, 90]);
    assert.equal(right.avgRight, 80);
    assert.equal(right.lean, "right");
    assert.equal(right.swing, 20);
    assert.equal(right.shares.right, 1);
  });

  check("blendStats shares always sum to 1", () => {
    const s = blendStats([0, 50, 100, 30, 70]);
    const total = s.shares.left + s.shares.right + s.shares.both;
    assert.ok(Math.abs(total - 1) < 1e-9, `shares summed to ${total}`);
  });

  check("blendStats clamps stored junk instead of skewing the mean", () => {
    const s = blendStats([150, -50]);
    assert.equal(s.avgRight, 50); // 100 and 0
    assert.equal(s.swing, 100);
  });

  check("blendByDay ignores logs with no blend", () => {
    const rows = blendByDay(
      [
        { local_date: "2026-07-01", blend: 60 },
        { local_date: "2026-07-01", blend: null },
        { local_date: "2026-07-01" },
      ],
      ["2026-07-01"],
    );
    assert.deepEqual(rows, [{ date: "2026-07-01", avgRight: 60 }]);
  });

  check("blendByDay returns null for days with nothing, in the order given", () => {
    const rows = blendByDay(
      [
        { local_date: "2026-07-02", blend: 40 },
        { local_date: "2026-07-02", blend: 60 },
      ],
      ["2026-07-01", "2026-07-02", "2026-07-03"],
    );
    assert.deepEqual(rows, [
      { date: "2026-07-01", avgRight: null },
      { date: "2026-07-02", avgRight: 50 },
      { date: "2026-07-03", avgRight: null },
    ]);
  });

  check("blendByDay rounds to a whole percent", () => {
    const rows = blendByDay(
      [
        { local_date: "d", blend: 33 },
        { local_date: "d", blend: 34 },
      ],
      ["d"],
    );
    assert.equal(rows[0].avgRight, 34); // 33.5 rounds up
    assert.ok(Number.isInteger(rows[0].avgRight));
  });

  console.log(
    failures === 0
      ? `\nAll checks passed.`
      : `\n${failures} check(s) failed.`,
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

process.exit(failures === 0 ? 0 : 1);
