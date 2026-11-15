export async function compileObject(wasmBytes, source, file = "edit.c") {
  const bytes = new TextEncoder().encode(source);
  if (bytes.length > 7500)
    throw new Error(
      "Prepared source exceeds this compiler adapter’s 7500-byte limit. Keep this exercise small.",
    );
  let instance,
    log = "",
    line = "";
  const decoder = new TextDecoder();
  const imports = {
    env: {
      jsConsoleLogWrite(p, n) {
        line += decoder.decode(
          new Uint8Array(instance.exports.memory.buffer, p, n),
        );
      },
      jsConsoleLogFlush() {
        log = (log + line + "\n").slice(-150000);
        line = "";
      },
    },
  };
  ({ instance } = await WebAssembly.instantiate(wasmBytes, imports));
  const str = (text) => {
    const b = new TextEncoder().encode(text + "\0"),
      p = instance.exports.allocUint8(b.length);
    new Uint8Array(instance.exports.memory.buffer, p, b.length).set(b);
    return p;
  };
  try {
    const p = instance.exports.compile_program(
      str(JSON.stringify(["-c", "-nostdinc", "-fno-common", file])),
      str(source),
    );
    const n = new DataView(instance.exports.memory.buffer).getUint32(p, true);
    if (n < 64 || n > 8192)
      throw new Error("The compiler produced no usable object.");
    return {
      bytes: new Uint8Array(instance.exports.memory.buffer, p + 4, n).slice(),
      diagnostics: [],
    };
  } catch (error) {
    const clean = (log + line).replaceAll("\0", "");
    const reports = clean
      .split("\n")
      .filter((s) => /^[^\n]*:\d+:.*(?:error|warning):/.test(s));
    throw new Error(
      reports.at(-1) ||
        "The compiler could not build this edit. " +
          error.message +
          ". Check the C syntax, keep the source small, or restore the starter.",
    );
  }
}
export function prepareSource(source, files, file) {
  const seen = new Set();
  function expand(code, path) {
    return code
      .split("\n")
      .map((line, index) => {
        const m = line.match(/^\s*#\s*include\s*["<]([^">]+)[">].*$/);
        if (!m) return line;
        const name = m[1],
          key = Object.hasOwn(files, name)
            ? name
            : path.startsWith("user/")
              ? "user/" + name
              : "kernel/" + name;
        if (!Object.hasOwn(files, key))
          throw new Error(
            path +
              ":" +
              (index + 1) +
              ": unsupported header " +
              name +
              ". Use the xv6 headers, not the host C library.",
          );
        if (seen.has(key)) return "";
        seen.add(key);
        return (
          '#line 1 "' +
          key +
          '"\n' +
          expand(files[key], key) +
          "\n#line " +
          (index + 2) +
          ' "' +
          path +
          '"'
        );
      })
      .join("\n");
  }
  return '#line 1 "' + file + '"\n' + expand(source, file);
}
