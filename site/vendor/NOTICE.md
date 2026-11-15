# Runtime and guest provenance

- Emulator: [takahirox/riscv-rust](https://github.com/takahirox/riscv-rust), commit `8ee69d7a5dc7ef6d8b2bda96bf86d2923f2cf176`. The precompiled `wasm/web/riscv_emu_rust_wasm.js` and `_bg.wasm` remain unchanged. [MIT license](LICENSE-riscv-rust).
- Guest: MIT [xv6-riscv](https://github.com/mit-pdos/xv6-riscv) at `d7c0a1b7a703f7366942092f9cf421b6cd111a36`. [MIT license](LICENSE-xv6). The matching source is vendored in `guest/` in this lab repository.
- Lab changes: add `user/lab.c` and its build entry, explicit RV64GC/LP64D/O3 flags, and 16 MiB managed guest RAM for debugger compatibility. See the repository README for the upstream debugger bounds-check limitation.

Guest images are built from those sources by `tools/build-guest.sh`; they no longer use the legacy images bundled in the emulator repository. The packaging script generates source associations, symbols, layout offsets and the asset manifest used by tests and inspectors. The course is functional, not a hardware-performance benchmark. The interface, scaffolds, worker harness and experiment programs are MIT-licensed lab code.

## Interface fonts

Source Sans 3 (Adobe) and IBM Plex Mono (IBM) are self-hosted in `site/fonts/`. Their SIL Open Font License notices are bundled alongside the font files.
