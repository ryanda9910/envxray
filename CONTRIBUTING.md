# Contributing

n1lens is one HTML file (`index.html`) plus a detection engine (`n1.js`) and its tests.
Contributions that catch more real N+1s, or cut false alarms, are welcome.

## Good contributions

- **A miss** — an N+1 log n1lens didn't flag. Open an issue with the log and add a failing
  assertion to `test/n1.test.mjs`, then the fix in `n1.js`.
- **A false positive** — a log it flagged that's actually fine (e.g. an ORM dialect we don't
  normalize yet). Show the case; we'd rather tighten detection than train people to ignore it.
- **A dialect** — a log prefix or quoting style (`shape()` in `n1.js`) we don't strip yet.
- **A translation** — add a `README.<lang>.md` and link it in the language row.

## Style

- Every change to `n1.js` needs a test in `test/n1.test.mjs`. Run `npm test`.
- Keep it zero-dependency and framework-free. It's meant to stay one HTML + one JS file.

## Commits

[Conventional Commits](https://www.conventionalcommits.org): `<type>(<scope>)?: <subject>` —
`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
CI lints every PR. Enable the dep-free local hook once:

```bash
git config core.hooksPath .githooks
```

## License

By contributing you agree your work is MIT-licensed.
