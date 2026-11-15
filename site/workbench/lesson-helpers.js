export const program = (body, { headers = [], exitStatus = 0 } = {}) =>
  '#include "kernel/types.h"\n' +
  headers.map((path) => '#include "' + path + '"\n').join("") +
  '#include "user/user.h"\n\nint\nmain(void)\n{\n' +
  body +
  "\n  exit(" +
  exitStatus +
  ");\n}\n";
export const lesson = (details) => ({
  mode: "user",
  observePid: false,
  file: "user/workbench.c",
  offset: 1,
  editorHeight: 560,
  ...details,
});
export const forkCheck =
  '  int child = fork();\n  if (child < 0) { printf("fork failed\\n"); exit(1); }\n';
export const allocation = (count = "4096") =>
  "  char *p = sbrk(" +
  count +
  ');\n  if (p == (char*)-1) { printf("allocation failed\\n"); exit(1); }\n';

// Keep edited kernel functions tied to the exact native source in this build.
export function kernelFunction(files, file, name) {
  const lines = files[file].split("\n");
  const at = lines.findIndex((line) =>
    new RegExp("^" + name + "\\s*\\(").test(line),
  );
  const end = lines.findIndex((line, i) => i > at && line === "}");
  if (at < 1 || end < at)
    throw new Error("Kernel function unavailable: " + name);
  return lines.slice(at - 1, end + 1).join("\n") + "\n";
}
