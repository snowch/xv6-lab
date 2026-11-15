#!/bin/sh
# Rebuild the permission-corrected emulator from the complete bundled source.
# Requires Rust 1.85.0 with wasm32-unknown-unknown and wasm-bindgen-cli 0.2.100.
set -eu
cd "$(dirname "$0")/.."
if [ "$(wasm-bindgen --version)" != "wasm-bindgen 0.2.100" ]; then
  echo "Install wasm-bindgen-cli 0.2.100 to match the pinned bindings." >&2
  exit 1
fi
runtime_build_dir=$(mktemp -d)
trap 'rm -rf "$runtime_build_dir"' EXIT
tar -xzf site/vendor/riscv-rust-source.tar.gz -C "$runtime_build_dir"
cargo test --locked --manifest-path "$runtime_build_dir/Cargo.toml" --target-dir "$runtime_build_dir/target" -p riscv_emu_rust
cargo build --locked --manifest-path "$runtime_build_dir/Cargo.toml" --target-dir "$runtime_build_dir/target" -p riscv_emu_rust_wasm --release --target wasm32-unknown-unknown
wasm-bindgen "$runtime_build_dir/target/wasm32-unknown-unknown/release/riscv_emu_rust_wasm.wasm" --target web --out-dir "$runtime_build_dir/web"
cp "$runtime_build_dir/web/riscv_emu_rust_wasm.js" site/vendor/
cp "$runtime_build_dir/web/riscv_emu_rust_wasm_bg.wasm" site/vendor/
python3 - <<'PY'
import hashlib,json,pathlib
path=pathlib.Path('docs/assets.json')
manifest=json.loads(path.read_text())
for asset in manifest['assets']:
    data=pathlib.Path(asset['path']).read_bytes()
    asset.update(bytes=len(data),sha256=hashlib.sha256(data).hexdigest())
path.write_text(json.dumps(manifest,indent=2)+'\n')
PY
