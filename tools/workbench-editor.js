import { minimalSetup } from "codemirror";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { cpp } from "@codemirror/lang-cpp";
import { setDiagnostics } from "@codemirror/lint";
export function createEditor(
  host,
  { source, lineOffset = 1, file, onChange, onRun },
) {
  let destroyed = false;
  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: source,
      extensions: [
        minimalSetup,
        lineNumbers({ formatNumber: (n) => String(n + lineOffset - 1) }),
        cpp(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": "Editable C source: " + file,
          spellcheck: "false",
          autocorrect: "off",
          autocapitalize: "off",
        }),
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              onRun();
              return true;
            },
          },
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
      ],
    }),
  });
  return {
    destroy: () => {
      destroyed = true;
      view.destroy();
    },
    value: () => view.state.doc.toString(),
    replace: (source) =>
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: source },
      }),
    clearDiagnostics: () =>
      queueMicrotask(() => {
        if (!destroyed) view.dispatch(setDiagnostics(view.state, []));
      }),
    diagnostic(message) {
      const match = message.match(/:(\d+):/);
      if (!match) return;
      const number = Math.max(
          1,
          Math.min(view.state.doc.lines, Number(match[1]) - lineOffset + 1),
        ),
        line = view.state.doc.line(number);
      view.dispatch(
        setDiagnostics(view.state, [
          { from: line.from, to: line.to, severity: "error", message },
        ]),
      );
    },
    focusText(text) {
      const at = view.state.doc.toString().indexOf(text);
      if (at < 0) return false;
      view.dispatch({
        selection: { anchor: at, head: at + text.length },
        effects: EditorView.scrollIntoView(at, { y: "center" }),
      });
      view.focus();
      return true;
    },
  };
}
