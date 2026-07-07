import assert from "node:assert";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const x = require("../envxray.js");

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log("  ok  " + name); }
  catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); }
}
const types = (r) => r.findings.map((f) => f.type + ":" + f.key);

// ---- parser ----
t("parses KEY=VALUE, export, quotes, inline comments", () => {
  const e = x.parseEnv(`# comment\nexport A=1\nB="two words"\nC=raw # trailing\nD=`);
  assert.equal(e.A.value, "1");
  assert.equal(e.B.value, "two words");
  assert.equal(e.B.quoted, true);
  assert.equal(e.C.value, "raw", "inline comment stripped on unquoted value");
  assert.equal(e.D.value, "");
});
t("does not strip a # inside a quoted value", () => {
  const e = x.parseEnv(`PW="a#b#c"`);
  assert.equal(e.PW.value, "a#b#c");
});

// ---- reads detection across languages ----
t("finds process.env, import.meta.env, Deno, python, ruby, php, shell", () => {
  const code = `
    const a = process.env.NODE_A;
    const b = process.env["NODE_B"];
    const v = import.meta.env.VITE_C;
    const d = Deno.env.get("DENO_D");
    os.environ["PY_E"]; os.getenv("PY_F");
    ENV["RUBY_G"]; $_ENV['PHP_H']; \${SHELL_I}`;
  const r = x.readsIn(code);
  ["NODE_A","NODE_B","VITE_C","DENO_D","PY_E","PY_F","RUBY_G","PHP_H","SHELL_I"]
    .forEach((k) => assert.ok(r.has(k), "missing " + k));
});

// ---- core findings ----
t("read-but-undeclared is HIGH", () => {
  const r = x.analyze({ env: `FOO=1`, code: `process.env.STRIPE_KEY; process.env.FOO;` });
  const f = r.findings.find((f) => f.type === "undeclared");
  assert.equal(f.key, "STRIPE_KEY");
  assert.equal(f.severity, "high");
});
t("declared-but-unread is MEDIUM (dead config)", () => {
  const r = x.analyze({ env: `USED=1\nDEAD=2`, code: `process.env.USED` });
  assert.deepEqual(types(r).filter((s) => s.startsWith("dead")), ["dead:DEAD"]);
});
t("committed real Stripe secret is HIGH", () => {
  const r = x.analyze({ env: `STRIPE_KEY=EXAMPLE9fK3xQ7pL2mN8vT4wZ1b0` });
  assert.ok(r.findings.some((f) => f.type === "committed-secret" && f.key === "STRIPE_KEY"));
});
t("committed GitHub token + JWT + PEM detected", () => {
  const r = x.analyze({ env:
    `GH=ghX_notARealToken0123456789abcdefXYZ\n` +
    `JWT=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc\n` });
  const keys = r.findings.filter((f) => f.type === "committed-secret").map((f) => f.key).sort();
  assert.deepEqual(keys, ["GH", "JWT"]);
});
t("empty secret-named var is MEDIUM", () => {
  const r = x.analyze({ env: `API_SECRET=` });
  assert.ok(r.findings.some((f) => f.type === "empty-secret" && f.key === "API_SECRET"));
});

// ---- FALSE-ALARM guards (the quality bar) ----
t("placeholder values are NOT flagged as committed secrets", () => {
  const r = x.analyze({ env:
    `API_KEY=your-api-key-here\nTOKEN=changeme\nSECRET=xxxxxxxx\nPW=<password>\nDB=example` });
  assert.equal(r.findings.filter((f) => f.type === "committed-secret").length, 0);
});
t("a short non-secret value is not a secret", () => {
  const r = x.analyze({ env: `PORT=3000\nNODE_ENV=production\nDEBUG=true` });
  assert.equal(r.stats.high, 0);
});
t("no code pasted => no drift findings (only committed-secret runs)", () => {
  const r = x.analyze({ env: `USED=1\nDEAD=2` });
  assert.equal(r.findings.filter((f) => f.type === "undeclared" || f.type === "dead").length, 0);
});
t("committed:false suppresses the committed-secret check", () => {
  const r = x.analyze({ env: `STRIPE_KEY=EXAMPLE9fK3xQ7pL2mN8vT4wZ1b0`, committed: false });
  assert.equal(r.findings.filter((f) => f.type === "committed-secret").length, 0);
});

// ---- example generation ----
t("generates a redacted .env.example covering reads + declares", () => {
  const r = x.analyze({ env: `STRIPE_KEY=EXAMPLEabc123def456ghi789xyz\nPORT=3000`, code: `process.env.STRIPE_KEY; process.env.NEW_ONE; process.env.PORT` });
  const ex = x.parseEnv(r.example);
  assert.ok("STRIPE_KEY" in ex && ex.STRIPE_KEY.value === "", "secret blanked");
  assert.ok("NEW_ONE" in ex, "undeclared read added to example");
  assert.ok("PORT" in ex, "plain var kept");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
