# Source workbench: provenance and limits

All six chapters contain thirty-six source-led lessons, each with its own page; the 25 existing experiments remain in the separate kernel explorer. All compilation and guest execution happen locally; the static site has no compile server.

## Compiler

The unmodified `compiler/tcc.wasm` comes from [lupyuen/tcc-riscv32-wasm](https://github.com/lupyuen/tcc-riscv32-wasm) at commit `8cffa69ed303d80206b7cb6e6e3737506243777c`. Despite that repository name, this artifact targets 64-bit RISC-V. TCC is LGPL-2.1-or-later; [license](compiler/COPYING-LGPL-2.1.txt), [complete corresponding source archive](compiler/tcc-source.tar.gz), and [upstream Zig build instructions](https://github.com/lupyuen/tcc-riscv32-wasm/blob/8cffa69ed303d80206b7cb6e6e3737506243777c/zig/build.sh) are provided. The source archive includes the C compiler, Zig adapter, build scripts and notices from that pinned revision. The compiler binary is unchanged.

The upstream adapter has 8192-byte file buffers and a bounded allocator. The lab admits at most 7500 bytes of prepared C source and objects within the adapter’s buffer limit, runs compilation in a disposable worker, and retires it after 15 seconds of compilation/linking. Asset downloads have a separate two-minute timeout and can be cancelled. Unsupported headers, missing symbols and unsupported relocations produce build errors. This is a small freestanding-C exercise environment, not a general GCC/Clang replacement.

## Linking and running

The browser compiler emits an actual ELF64 RISC-V object. The JavaScript incremental linker resolves its relocations against a matching, native-built xv6 image and installs the edited code into reserved executable space. Kernel writable globals use a separate reserved writable region. The original function entry redirects to the new compiled function. The user program is installed as `workbench` in a fresh xv6 filesystem image; the kernel exercise uses a fixed user probe.

This is an incremental selected-unit build, not a full browser `make` build. The native baseline includes 64 KiB executable link slots and a 16 KiB writable kernel slot. Slot addresses and symbol values are read from the actual ELF. Existing xv6 libraries, startup assembly and all other functions remain native-built from the pinned source in the repository’s `guest/` tree. No source-text substitutions simulate guest output or PID values.

The evidence panel reads the actual process table at the first `sys_getpid` entry and at `sys_exit`, and parses the probe’s reported PID from actual UART output. Values are observations of this run, not an automatic grade. Programs that remove the probe, fork or exec can change what is observed. A stopped or faulting program can leave partial evidence.

A fresh machine is used for each run. Guest files are disposable. Source drafts save independently in browser storage with a tab-only fallback; the download action exports the current C source. Failed builds preserve the previous valid image and any existing run. A draft changed during compilation is not automatically run as though it were the built snapshot.

## Other components

xv6 and riscv-rust retain their MIT notices in [the main runtime notice](../vendor/NOTICE.md). CodeMirror and its dependencies are MIT licensed; bundled [editor notices](EDITOR-LICENSES.txt) accompany the browser editor. Interface fonts retain their bundled SIL Open Font License notices in `../fonts/`. New workbench code is MIT licensed.

The Scheduling wait lesson additionally captures actual workbench process rows and parent PIDs at its first getpid handler. The table is a saved snapshot, not a claim that those processes still exist after the run. Sleep experiments use guest tick conditions; they do not measure browser or hardware performance.
