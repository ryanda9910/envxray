<p align="center">
  <img src="assets/logo.svg" alt="envxray" width="96" height="96" />
</p>

<h1 align="center">envxray</h1>

<p align="center"><b>Rontgen file .env kamu sebelum bikin prod jebol. Secret ke-commit, var dibaca tapi tak dideklarasi, config mati — ketahuan di browser.</b></p>

<p align="center">
  <a href="README.md">🇺🇸 English</a> · 🇮🇩 Bahasa Indonesia · <a href="README.zh-CN.md">🇨🇳 简体中文</a>
</p>

<p align="center"><a href="https://ryanda9910.github.io/envxray/"><b>→ buka tool-nya</b></a></p>

Dua bug env kejadian berulang: secret nyangkut di `.env` yang ke-commit, dan
`process.env.SESUATU` yang dibaca kode tapi tidak ada di `.env` — jadi prod boot
dengan `undefined` lalu tumbang di saat paling buruk. `.env.example` harusnya
mencegah yang kedua, tapi selalu ketinggalan update.

envxray ambil `.env` kamu dan kode yang membacanya, cek silang, lalu kasih tahu
persis apa yang salah: mana yang **secret asli ke-commit**, mana yang **dibaca tapi
tak dideklarasi**, mana yang **dideklarasi tapi tak dibaca** (config mati atau salah
ketik), dan mana secret yang **nilainya kosong**. Terus dia bikinkan `.env.example`
yang bersih dan sudah diredaksi. Semua jalan di browser — `.env` dan kode kamu tidak
pernah keluar tab, tidak pernah dikirim ke server.

## Yang ditangkap

- 🔴 **Secret ke-commit** — nilai yang kelihatan seperti key asli (`sk_live_…`, `ghp_…`, JWT, PEM, blob panjang) di `.env`
- 🔴 **Dibaca tapi tak dideklarasi** — `process.env.X` di kode tanpa `X` di `.env` → `undefined` di produksi
- 🟡 **Config mati** — dideklarasi, tak pernah dibaca (sisa lama / salah ketik)
- 🟡 **Secret kosong** — `*_SECRET`/`*_TOKEN`/`*_KEY` bernilai kosong → boot dengan kredensial blank
- ✅ **`.env.example` otomatis** — semua var, nilai diredaksi, siap di-commit

Baca akses env di JS/TS, Deno, Python, Ruby, PHP, dan shell/docker-compose.

## Sengaja rendah false-alarm

Nilai placeholder (`your-api-key`, `changeme`, `xxxx`, `<password>`) TIDAK ditandai
sebagai secret. `PORT=3000` bukan secret. Tanpa kode, cuma cek secret-ke-commit yang
jalan — tidak mengarang temuan drift yang tak bisa diverifikasi.

Buka **[tool-nya](https://ryanda9910.github.io/envxray/)** dan tempel. Tanpa build,
tanpa akun, tanpa upload. Jalan offline setelah dimuat.

## Lisensi

MIT.
