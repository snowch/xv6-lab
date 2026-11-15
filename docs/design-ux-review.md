# xv6 Lab: design and UX pass

Skills applied:

- [Frontend Design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md), Anthropic: subject-specific visual direction, deliberate typography, restrained composition, readable line lengths and screenshot critique.
- [Web Interface Guidelines](https://github.com/vercel-labs/agent-skills/blob/main/skills/web-design-guidelines/SKILL.md), Vercel: reviewed against the [current guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md) for accessibility, forms, navigation/state, feedback, touch and responsive layout.

## Design plan and critique

The subject is a teaching kernel, the audience is a systems learner, and the primary job is moving between an experiment’s explanation and the real machine. The previous cream/serif/dark-sidebar treatment used too many small labels and competing surfaces. A coherent engineering workbook makes the running machine the strongest visual object and keeps the reading surface quiet.

Palette: paper `#f4f7fb`, white surface `#ffffff`, ink `#192d45`, action blue `#1b56b8`, explanatory teal `#086c68`, divider `#d8e1ee`. Local Source Sans 3 regular/semibold supplies readable humanist text; IBM Plex Mono is reserved for code and machine values. Reading stays at 18px or above. Secondary text is at least 14px. Text columns cap at 76ch.

Wide layout:

```text
Course + search | current lesson / machine link
                | compact introduction
                | lesson             | real console + inspectors
```

Tablet/phone layout:

```text
Brand + progress + collapsible course/search
Current lesson
Compact introduction
[Read the lesson] [Use the live machine]   <- sticky
One full-width workspace
```

The type scale and navigation structure carry hierarchy. Stage numbers remain because the learning activities are an actual sequence. The headline no longer accents an arbitrary single word. Tiny uppercase labels, decorative terminal dots, scattered overrides and the heavy dark sidebar were removed. The console retains a dark surface because it is a separate interactive machine output region.

Screenshot critique caught overlapping sidebar content and redundant scroll offsets on phones. The sidebar now uses normal flow with a bounded scrollable lesson list, and anchor scrolling uses one sticky-controls offset.

## UX changes

- Lesson search with a named input, result counts, useful empty state and URL query state.
- Read/Live machine views preserve shareable URL state and restore on load.
- Progress is above the long course list; chapter groups remain visible in an unfiltered list.
- Disabled experiments explain whether to wait for boot, wait for a command, or resume a paused machine.
- A reset confirmation protects session files; cancellation leaves the machine intact.
- Console paste forwards ASCII text to the running guest. Normal form paste is unchanged.
- Form names, autocomplete, invalid-state/error association, async announcements, code translation hints and source-loading recovery guidance were reviewed.
- Machine heading hierarchy, keyboard focus, reduced-motion scrolling, contrast and touch targets were retained or improved.
- Source text and guest assets remain local; fonts are self-hosted with bundled OFL licenses.

## Verification

`npm test` checks all 25 guided experiments against actual xv6/Wasm, including kernel inspection. `npm run test:browser` launches system Chromium and checks 1680, 1024, 390 and 320 pixel widths: font loading, readable type size, horizontal overflow, lesson filtering/empty state, guest boot/output, console paste, workspace state, pause, cancelled reset and deep links. A desktop geometry assertion prevents the lesson list from overlapping footer links.

Rendered screenshots of reading and machine views were inspected, including desktop, tablet and phone. CI repeats browser checks against its freshly built guest and retains screenshots as the `browser-previews` artifact.

This establishes Chromium rendering and the checked interactions at these viewport sizes. It does not establish physical-device, Safari, Firefox, screen-reader or beginner-learning outcomes.

## Guideline findings

The file/line entries below record the fixed findings and where to review their implementation.

- `site/app.js:83` - fixed: lesson search and URL filter state.

- `site/app.js:120` - fixed: workspace state is shareable in the URL.

- `site/app.js:490` - fixed: confirm before discarding guest-session files.

- `site/app.js:277` - fixed: disabled experiment explains recovery action.

- `site/app.js:616` - fixed: console accepts pasted text.

- `site/style.css:113` - fixed: bounded navigation and normal-flow footer.

- `site/index.html:155` - fixed: named form control and described input state.
