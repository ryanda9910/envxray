/**
 * envxray — cross-check a .env against the code that reads it, in the browser.
 * Dual export: browser (window.envxray) + node (module.exports) so the same engine
 * powers the tool and the tests. No network — everything runs on the pasted text.
 *
 * Inputs: the raw text of a .env file, and source code that reads env vars.
 * Output: a list of findings (undeclared reads, committed secrets, dead vars,
 * placeholder-looking values) + a generated .env.example.
 */
(function (root) {
  "use strict";

  // ---- parse a .env file into { key: {value, line, quoted} } ----
  function parseEnv(text) {
    const out = {};
    const lines = (text || "").split(/\r?\n/);
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith("#")) return;
      // optional `export ` prefix, KEY=VALUE
      const m = line.replace(/^export\s+/, "").match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) return;
      const key = m[1];
      let value = m[2];
      let quoted = false;
      // strip a trailing inline comment only when the value is unquoted
      if (!/^["']/.test(value)) {
        value = value.replace(/\s+#.*$/, "").trim();
      }
      const q = value.match(/^(['"])([\s\S]*)\1$/);
      if (q) { value = q[2]; quoted = true; }
      out[key] = { value, line: i + 1, quoted };
    });
    return out;
  }

  // ---- find every env var the code READS ----
  // Covers: process.env.X / process.env["X"], import.meta.env.X (Vite),
  // Deno.env.get("X"), os.environ["X"] / os.getenv("X") / getenv("X") (Python),
  // ENV["X"] (Ruby), $_ENV['X'] / getenv('X') (PHP), and ${X}/$X in shell/compose.
  const READ_PATTERNS = [
    /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
    /process\.env\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g,
    /import\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
    /Deno\.env\.get\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
    /os\.environ(?:\.get)?\(?\s*\[?\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
    /os\.getenv\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
    /\bgetenv\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g,
    /ENV\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g,
    /\$_ENV\[\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*\]/g,
    /\$\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}/g,
  ];

  function readsIn(code) {
    const found = new Map(); // key -> count
    const src = code || "";
    for (const re of READ_PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src))) {
        const k = m[1];
        found.set(k, (found.get(k) || 0) + 1);
      }
    }
    return found;
  }

  // ---- secret / placeholder heuristics on a value ----
  const PLACEHOLDER = /^(|x{2,}|your[-_ ]?\w*|changeme|change_me|todo|placeholder|<[^>]+>|\.\.\.|\*+|xxx+|example|dummy|test|secret|password|null|none)$/i;

  // value looks like a REAL secret (not a placeholder) — long/high-entropy or a known token shape
  function looksLikeRealSecret(key, value) {
    if (!value) return false;
    if (PLACEHOLDER.test(value.trim())) return false;
    const v = value.trim();
    // known token prefixes
    if (/^(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/.test(v)) return true;      // Stripe
    if (/^(gh[pousr]_[A-Za-z0-9]{20,})/.test(v)) return true;                 // GitHub
    if (/^(xox[baprs]-[A-Za-z0-9-]{10,})/.test(v)) return true;              // Slack
    if (/^AKIA[0-9A-Z]{16}$/.test(v)) return true;                            // AWS access key id
    if (/^AIza[0-9A-Za-z_-]{30,}$/.test(v)) return true;                      // Google API key
    if (/^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./.test(v)) return true; // JWT
    if (/-----BEGIN[ A-Z]*PRIVATE KEY-----/.test(value)) return true;         // PEM
    // secret-ish KEY name + a long non-placeholder value
    const secretName = /(secret|token|password|passwd|pwd|api[-_]?key|access[-_]?key|private[-_]?key|credential|auth)/i.test(key);
    if (secretName && v.length >= 12 && /[A-Za-z]/.test(v) && /[0-9]/.test(v)) return true;
    // long high-entropy blob regardless of name
    if (v.length >= 24 && /[A-Za-z]/.test(v) && /[0-9]/.test(v) && !/\s/.test(v)) return true;
    return false;
  }

  const isSecretName = (key) =>
    /(secret|token|password|passwd|pwd|api[-_]?key|access[-_]?key|private[-_]?key|credential|auth|dsn|conn|database_url|db_url)/i.test(key);

  /**
   * analyze({ env, code, committed })
   *  env       — raw .env text
   *  code      — source code that reads env (optional; enables drift checks)
   *  committed — is the .env file tracked by git? (default true = it's pasted, so treat committed)
   * returns { findings:[{severity,type,key,message,line}], example, stats }
   */
  function analyze(opts) {
    opts = opts || {};
    const env = parseEnv(opts.env || "");
    const reads = (opts.code && opts.code.trim()) ? readsIn(opts.code) : null;
    const committed = opts.committed !== false;
    const findings = [];

    const declared = Object.keys(env);
    const readKeys = reads ? [...reads.keys()] : [];

    // 1. committed real secret (HIGH) — the .env itself carries a live secret
    if (committed) {
      for (const key of declared) {
        const { value, line } = env[key];
        if (looksLikeRealSecret(key, value)) {
          findings.push({
            severity: "high", type: "committed-secret", key, line,
            message: `${key} holds what looks like a real secret. If this .env is committed, rotate it and move the value out of version control.`,
          });
        }
      }
    }

    // 2. read but not declared (HIGH) — prod boots with undefined
    if (reads) {
      for (const key of readKeys) {
        if (!(key in env)) {
          findings.push({
            severity: "high", type: "undeclared", key,
            message: `${key} is read by the code but not declared in .env — it will be undefined at runtime unless it's set elsewhere.`,
          });
        }
      }
    }

    // 3. secret-named var with an EMPTY value (MED) — will silently be blank.
    //    Runs first so a blank secret isn't ALSO reported as generic dead config.
    const emptySecret = new Set();
    for (const key of declared) {
      if (isSecretName(key) && env[key].value === "") {
        emptySecret.add(key);
        findings.push({
          severity: "medium", type: "empty-secret", key, line: env[key].line,
          message: `${key} is a secret-shaped name with an empty value — the app may boot with a blank credential instead of failing fast.`,
        });
      }
    }

    // 4. declared but never read (MED) — dead config / typo
    if (reads) {
      for (const key of declared) {
        if (!reads.has(key) && !emptySecret.has(key)) {
          findings.push({
            severity: "medium", type: "dead", key, line: env[key].line,
            message: `${key} is declared but the code never reads it — dead config, or a typo'd name that the code reads under a different spelling.`,
          });
        }
      }
    }

    // generate a .env.example: every key the code reads and/or the .env declares,
    // with the value redacted (secrets blanked, placeholders kept as hints).
    const exampleKeys = new Set([...declared, ...readKeys]);
    const example = [...exampleKeys].sort().map((key) => {
      const decl = env[key];
      if (decl && !looksLikeRealSecret(key, decl.value) && PLACEHOLDER.test((decl.value || "").trim())) {
        return `${key}=${decl.value}`; // keep the placeholder hint
      }
      if (isSecretName(key) || (decl && looksLikeRealSecret(key, decl.value))) return `${key}=`;
      return `${key}=`;
    }).join("\n");

    const order = { high: 0, medium: 1, low: 2 };
    findings.sort((a, b) => order[a.severity] - order[b.severity] || a.key.localeCompare(b.key));

    return {
      findings,
      example,
      stats: {
        declared: declared.length,
        read: readKeys.length,
        high: findings.filter((f) => f.severity === "high").length,
        medium: findings.filter((f) => f.severity === "medium").length,
      },
    };
  }

  const api = { analyze, parseEnv, readsIn, looksLikeRealSecret, isSecretName };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.envxray = api;
})(typeof window !== "undefined" ? window : this);
