# Runtime and guest provenance

- Emulator: [takahirox/riscv-rust](https://github.com/takahirox/riscv-rust), based on commit `8ee69d7a5dc7ef6d8b2bda96bf86d2923f2cf176`, rebuilt with the lab's page-permission correction. [MIT license](LICENSE-riscv-rust), [complete patched source and lockfile](riscv-rust-source.tar.gz), [dependency licenses](LICENSES-runtime-dependencies.txt).
- Guest: MIT [xv6-riscv](https://github.com/mit-pdos/xv6-riscv) at `d7c0a1b7a703f7366942092f9cf421b6cd111a36`. [MIT license](LICENSE-xv6). The matching source is vendored in `guest/` in this lab repository.
- Lab changes: add `user/lab.c` and its build entry, explicit RV64GC/LP64D/O3 flags, and 16 MiB managed guest RAM for debugger compatibility. See the repository README for the upstream debugger bounds-check limitation.

Guest images are built from those sources by `tools/build-guest.sh`; they no longer use the legacy images bundled in the emulator repository. The packaging script generates source associations, symbols, layout offsets and the asset manifest used by tests and inspectors. The course is functional, not a hardware-performance benchmark. The interface, scaffolds, worker harness and experiment programs are MIT-licensed lab code.

## Page-permission correction

The upstream MMU decoded PTE_U but ignored it. The patched MMU rejects user reads,
writes and instruction fetches from supervisor pages, enforces supervisor SUM
access to user data, excludes supervisor execution of user pages, and implements
MXR reads from execute-only pages. SUM/MXR changes invalidate cached translations.
Five focused Rust tests cover these cases, and the lab runs actual child-process
faults and successful edited accesses against the resulting Wasm binary.

The reviewed delta is `tools/runtime-permissions.patch` in the repository. The
source archive includes the exact Cargo lockfile. Build with Rust 1.85.0,
`wasm32-unknown-unknown`, and wasm-bindgen-cli 0.2.100 using
`tools/build-runtime.sh`; that command also runs the emulator's Rust tests. The
rebuilt JavaScript bindings use wasm-bindgen 0.2.100. The guest's 16 MiB managed
RAM limit remains in place for the separate upstream debugger bounds issue.

## Interface fonts

Source Sans 3 (Adobe) and IBM Plex Mono (IBM) are self-hosted in `site/fonts/`. Their SIL Open Font License notices are bundled alongside the font files.
