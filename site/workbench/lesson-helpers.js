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
