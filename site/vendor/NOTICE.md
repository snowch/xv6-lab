# Bundled runtime and guest images

- Emulator: [takahirox/riscv-rust](https://github.com/takahirox/riscv-rust), commit `8ee69d7a5dc7ef6d8b2bda96bf86d2923f2cf176` (MIT).
  - `wasm/web/riscv_emu_rust_wasm.js`
  - `wasm/web/riscv_emu_rust_wasm_bg.wasm`
  - License: [LICENSE-riscv-rust](LICENSE-riscv-rust)
- Guest: MIT [xv6-riscv](https://github.com/mit-pdos/xv6-riscv), kernel and disk images copied from `resources/xv6/` in that same riscv-rust commit.
  - License: [LICENSE-xv6](LICENSE-xv6)
  - Upstream [build notes](https://github.com/takahirox/riscv-rust/blob/8ee69d7a5dc7ef6d8b2bda96bf86d2923f2cf176/resources/xv6/Readme.md).

Upstream does not record the xv6 source revision used to produce these guest images. They are legacy, known-compatible artifacts, not a build of current xv6. Their exact hashes are recorded in `docs/assets.json` in the lab repository. Matching, reproducible guest-source builds are a next increment; source links in lessons explicitly identify this limitation.

No runtime assets have been modified from the pinned upstream versions. The lab interface and worker harness are new MIT-licensed code.
