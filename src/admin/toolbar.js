// Formatting toolbar above the visual editor: buttons instead of Markdown
// syntax. Every button calls a command of the editor wrapper (editor.js), which
// is the same command the slash menu and the keyboard shortcuts run, so the
// Markdown that results is exactly what typing the syntax would produce.
import {h} from "./dom.js";
import {SIZES} from "./imageopts.js";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Small stroke icons, built with createElementNS (no innerHTML). */
function icon(shapes) {
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true"
  }))
    svg.setAttribute(k, v);
  for (const [tag, attrs] of shapes) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

const rule = ([x1, x2], i) => ["line", {x1, y1: 6 + i * 4, x2, y2: 6 + i * 4}];

const ICONS = {
  image: [
    ["rect", {x: 3, y: 3, width: 18, height: 18}],
    ["circle", {cx: 8.5, cy: 8.5, r: 1.5}],
    ["polyline", {points: "21 15 16 10 5 21"}]
  ],
  table: [
    ["rect", {x: 3, y: 4, width: 18, height: 16}],
    ["line", {x1: 3, y1: 10, x2: 21, y2: 10}],
    ["line", {x1: 3, y1: 15, x2: 21, y2: 15}],
    ["line", {x1: 9, y1: 4, x2: 9, y2: 20}],
    ["line", {x1: 15, y1: 4, x2: 15, y2: 20}]
  ],
  link: [
    ["path", {d: "M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"}],
    ["path", {d: "M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"}]
  ],
  bullet: [
    ["line", {x1: 9, y1: 6, x2: 21, y2: 6}],
    ["line", {x1: 9, y1: 12, x2: 21, y2: 12}],
    ["line", {x1: 9, y1: 18, x2: 21, y2: 18}],
    ["circle", {cx: 4, cy: 6, r: 1}],
    ["circle", {cx: 4, cy: 12, r: 1}],
    ["circle", {cx: 4, cy: 18, r: 1}]
  ],
  task: [
    ["rect", {x: 3, y: 4, width: 6, height: 6}],
    ["polyline", {points: "4.5 7 6 8.5 8 5.5"}],
    ["line", {x1: 13, y1: 7, x2: 21, y2: 7}],
    ["rect", {x: 3, y: 14, width: 6, height: 6}],
    ["line", {x1: 13, y1: 17, x2: 21, y2: 17}]
  ],
  code: [
    ["polyline", {points: "16 18 22 12 16 6"}],
    ["polyline", {points: "8 6 2 12 8 18"}]
  ],
  codeBlock: [
    ["rect", {x: 3, y: 4, width: 18, height: 16}],
    ["polyline", {points: "10 9 7 12 10 15"}],
    ["polyline", {points: "14 9 17 12 14 15"}]
  ],
  divider: [["line", {x1: 3, y1: 12, x2: 21, y2: 12}]],
  callout: [
    ["rect", {x: 3, y: 4, width: 18, height: 16}],
    ["line", {x1: 12, y1: 9, x2: 12, y2: 13}],
    ["line", {x1: 12, y1: 16, x2: 12.01, y2: 16}]
  ],
  toggle: [
    ["polyline", {points: "9 6 15 12 9 18"}],
    ["line", {x1: 3, y1: 6, x2: 4, y2: 6}],
    ["line", {x1: 3, y1: 12, x2: 4, y2: 12}],
    ["line", {x1: 3, y1: 18, x2: 4, y2: 18}]
  ],
  // paragraph-style lines: where the short lines sit shows the alignment
  alignLeft: [
    [3, 21],
    [3, 15],
    [3, 21],
    [3, 12]
  ].map(rule),
  alignCenter: [
    [3, 21],
    [7, 17],
    [3, 21],
    [9, 15]
  ].map(rule),
  alignRight: [
    [3, 21],
    [9, 21],
    [3, 21],
    [11, 21]
  ].map(rule)
};

const HEADINGS = [
  ["Paragraph", 0],
  ["Heading 1", 1],
  ["Heading 2", 2],
  ["Heading 3", 3],
  ["Heading 4", 4]
];

/**
 * @param {object} o
 * @param {(files: File[]) => Promise<void>} o.insertImages  uploads the files
 *        (see write.js addImage) and inserts one image block per file
 */
export function createToolbar({insertImages}) {
  let editor = null;
  let unsubscribe = null;
  let frame = 0;
  const pressable = new Map(); // state key -> button

  const act = fn => () => {
    if (!editor) return;
    fn(editor.commands);
    editor.focus();
  };

  // keep the caret and selection in the editor while a button is pressed
  const keepFocus = e => e.preventDefault();

  function button({key, title, content, className = "", run, label}) {
    const btn = h(
      "button",
      {
        class: `tb-btn ${className}`.trim(),
        type: "button",
        title,
        "aria-label": label || title,
        disabled: true,
        onmousedown: keepFocus,
        onclick: run
      },
      content
    );
    if (key) pressable.set(key, btn);
    return btn;
  }
  const glyph = (text, style) => h("span", {class: "tb-glyph", style}, text);

  // ---- heading select -----------------------------------------------------------
  const headingSelect = h(
    "select",
    {
      class: "tb-select",
      "aria-label": "Text style",
      title: "Text style",
      disabled: true,
      onchange: () => {
        const level = Number(headingSelect.value);
        if (editor) {
          editor.commands.heading(level || null);
          editor.focus();
        }
      }
    },
    HEADINGS.map(([label, level]) => h("option", {value: String(level)}, label))
  );

  // ---- table size picker ---------------------------------------------------------
  const COLS = 8;
  const ROWS = 6;
  const pickerLabel = h("div", {class: "tb-picker-label"}, "Choose a size");
  const cells = [];
  const grid = h("div", {class: "tb-grid", role: "grid"});
  function highlight(rows, cols) {
    for (const c of cells)
      c.el.classList.toggle("is-on", c.r <= rows && c.c <= cols);
    pickerLabel.textContent = rows ? `${cols} × ${rows}` : "Choose a size";
  }
  for (let r = 1; r <= ROWS; r++) {
    for (let c = 1; c <= COLS; c++) {
      const el = h("button", {
        class: "tb-cell",
        type: "button",
        "aria-label": `Insert a table with ${c} columns and ${r} rows`,
        onmousedown: keepFocus,
        onmouseenter: () => highlight(r, c),
        onfocus: () => highlight(r, c),
        onclick: () => {
          closePicker();
          if (editor) {
            editor.commands.table(r, c);
            editor.focus();
          }
        }
      });
      cells.push({el, r, c});
      grid.append(el);
    }
  }
  grid.addEventListener("mouseleave", () => highlight(0, 0));
  const picker = h(
    "div",
    {class: "tb-picker hidden", role: "dialog", "aria-label": "Table size"},
    grid,
    pickerLabel
  );
  const tableBtn = button({
    title: "Insert a table",
    label: "Insert a table",
    className: "tb-wide",
    content: [icon(ICONS.table), h("span", null, "Table")],
    run: () =>
      picker.classList.contains("hidden") ? openPicker() : closePicker()
  });
  const outside = e => {
    if (!picker.contains(e.target) && !tableBtn.contains(e.target))
      closePicker();
  };
  const onEsc = e => {
    if (e.key === "Escape") closePicker();
  };
  function openPicker() {
    highlight(0, 0);
    picker.classList.remove("hidden");
    tableBtn.setAttribute("aria-expanded", "true");
    document.addEventListener("mousedown", outside, true);
    document.addEventListener("keydown", onEsc, true);
  }
  function closePicker() {
    picker.classList.add("hidden");
    tableBtn.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", outside, true);
    document.removeEventListener("keydown", onEsc, true);
  }

  // ---- callout menu ----------------------------------------------------------------
  const CALLOUTS = [
    ["note", "Note"],
    ["tip", "Tip"],
    ["important", "Important"],
    ["warning", "Warning"],
    ["caution", "Caution"]
  ];
  const calloutMenu = h(
    "div",
    {class: "tb-picker tb-menu hidden", role: "menu", "aria-label": "Callout"},
    CALLOUTS.map(([kind, label]) =>
      h(
        "button",
        {
          class: "tb-menu-item",
          type: "button",
          role: "menuitem",
          onmousedown: keepFocus,
          onclick: () => {
            closeCalloutMenu();
            if (editor) {
              editor.commands.callout(kind);
              editor.focus();
            }
          }
        },
        h("span", {class: `tb-dot tb-dot-${kind}`, "aria-hidden": "true"}),
        label
      )
    )
  );
  const calloutBtn = button({
    key: "callout",
    title: "Callout box (note, tip, warning ...)",
    label: "Insert a callout box",
    className: "tb-wide",
    content: [icon(ICONS.callout), h("span", null, "Callout")],
    run: () =>
      calloutMenu.classList.contains("hidden")
        ? openCalloutMenu()
        : closeCalloutMenu()
  });
  const calloutOutside = e => {
    if (!calloutMenu.contains(e.target) && !calloutBtn.contains(e.target))
      closeCalloutMenu();
  };
  const calloutEsc = e => {
    if (e.key === "Escape") closeCalloutMenu();
  };
  function openCalloutMenu() {
    calloutMenu.classList.remove("hidden");
    calloutBtn.setAttribute("aria-expanded", "true");
    document.addEventListener("mousedown", calloutOutside, true);
    document.addEventListener("keydown", calloutEsc, true);
  }
  function closeCalloutMenu() {
    calloutMenu.classList.add("hidden");
    calloutBtn.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", calloutOutside, true);
    document.removeEventListener("keydown", calloutEsc, true);
  }

  // ---- image picker --------------------------------------------------------------
  const fileInput = h("input", {
    type: "file",
    class: "hidden",
    accept: "image/png,image/jpeg,image/gif,image/webp,image/avif",
    multiple: true,
    "aria-hidden": "true",
    tabIndex: -1,
    onchange: async () => {
      const files = [...fileInput.files];
      fileInput.value = ""; // the same file can be chosen again
      if (files.length) await insertImages(files);
    }
  });
  const imageBtn = button({
    title: "Insert an image (PNG, JPEG, GIF, WebP, AVIF)",
    label: "Insert an image",
    className: "tb-wide tb-feature",
    content: [icon(ICONS.image), h("span", null, "Image")],
    run: () => fileInput.click()
  });

  // ---- picture size / alignment (only while a picture is selected) --------------
  const sizeSelect = h(
    "select",
    {
      class: "tb-select",
      "aria-label": "Picture size",
      title: "Picture size",
      onchange: () => {
        if (!editor) return;
        editor.commands.imageOptions({w: Number(sizeSelect.value) || 0});
        editor.focus();
      }
    },
    h("option", {value: "0"}, "Auto size"),
    SIZES.map(w =>
      h("option", {value: String(w)}, w === 100 ? "Full width" : `${w}% width`)
    )
  );
  const ALIGN_BUTTONS = [
    ["left", "Align left", ICONS.alignLeft],
    ["center", "Align center", ICONS.alignCenter],
    ["right", "Align right", ICONS.alignRight]
  ].map(([value, title, shapes]) =>
    button({
      key: `align-${value}`,
      title,
      content: icon(shapes),
      // pressing the active alignment again clears it
      run: () => {
        if (!editor) return;
        const now = editor.formatState().image?.align;
        editor.commands.imageOptions({align: now === value ? "" : value});
        editor.focus();
      }
    })
  );
  const imageGroup = h(
    "span",
    {class: "tb-group hidden", "aria-label": "Selected picture"},
    h("span", {class: "tb-sep", "aria-hidden": "true"}),
    sizeSelect,
    ...ALIGN_BUTTONS,
    h("span", {class: "tb-hint"}, "or drag a corner of the picture")
  );
  // A width dragged by hand (62%) is not one of the presets: show it as its own
  // entry while it is the current one.
  const customSize = h("option", {value: ""});
  function showSize(w) {
    customSize.remove();
    if (w && !SIZES.includes(w)) {
      customSize.value = String(w);
      customSize.textContent = `${w}% width`;
      sizeSelect.append(customSize);
    }
    sizeSelect.value = String(w || 0);
  }

  // ---- the rest ---------------------------------------------------------------------
  const sep = () => h("span", {class: "tb-sep", "aria-hidden": "true"});
  const el = h(
    "div",
    {class: "toolbar", role: "toolbar", "aria-label": "Formatting"},
    headingSelect,
    sep(),
    button({
      key: "bold",
      title: "Bold (⌘B)",
      content: glyph("B", "font-weight:700"),
      run: act(c => c.bold())
    }),
    button({
      key: "italic",
      title: "Italic (⌘I)",
      content: glyph("I", "font-style:italic;font-family:serif"),
      run: act(c => c.italic())
    }),
    button({
      key: "strike",
      title: "Strikethrough",
      content: glyph("S", "text-decoration:line-through"),
      run: act(c => c.strike())
    }),
    button({
      key: "code",
      title: "Inline code",
      content: icon(ICONS.code),
      run: act(c => c.inlineCode())
    }),
    sep(),
    button({
      title: "Bulleted list",
      content: icon(ICONS.bullet),
      run: act(c => c.bulletList())
    }),
    button({
      title: "Numbered list",
      content: glyph("1.", "font-weight:600"),
      run: act(c => c.orderedList())
    }),
    button({
      title: "Checklist",
      content: icon(ICONS.task),
      run: act(c => c.taskList())
    }),
    sep(),
    button({
      key: "link",
      title: "Link",
      content: icon(ICONS.link),
      run: act(c => c.link())
    }),
    imageBtn,
    h("span", {class: "tb-anchor"}, tableBtn, picker),
    sep(),
    button({
      title: "Inline math (LaTeX)",
      content: glyph("x²", "font-style:italic;font-family:serif"),
      run: act(c => c.mathInline())
    }),
    button({
      title: "Math block (LaTeX)",
      content: glyph("∑", "font-size:17px"),
      run: act(c => c.mathBlock())
    }),
    button({
      title: "Code block",
      content: icon(ICONS.codeBlock),
      run: act(c => c.codeBlock())
    }),
    button({
      title: "Quote",
      content: glyph("❝", "font-size:16px"),
      run: act(c => c.quote())
    }),
    button({
      title: "Divider",
      content: icon(ICONS.divider),
      run: act(c => c.divider())
    }),
    h("span", {class: "tb-anchor"}, calloutBtn, calloutMenu),
    button({
      key: "toggle",
      title:
        "Collapsible block: the paragraph becomes the title, the rest hides",
      label: "Insert a collapsible block",
      className: "tb-wide",
      content: [icon(ICONS.toggle), h("span", null, "Toggle")],
      run: act(c => c.toggle())
    }),
    button({
      title: "Footnote: adds a numbered marker here and the note at the end",
      label: "Insert a footnote",
      className: "tb-wide",
      content: [glyph("¹", "font-size:16px"), h("span", null, "Footnote")],
      run: act(c => c.footnote())
    }),
    imageGroup,
    fileInput
  );

  function refresh() {
    frame = 0;
    if (!editor) return;
    let state;
    try {
      state = editor.formatState();
    } catch {
      return; // the editor is being torn down
    }
    for (const [key, btn] of pressable)
      btn.setAttribute("aria-pressed", String(!!state[key]));
    headingSelect.value = String(state.heading || 0);
    pressable
      .get("callout")
      .setAttribute("aria-pressed", String(!!state.callout));
    // the picture group exists only while a picture is selected
    imageGroup.classList.toggle("hidden", !state.image);
    if (state.image) {
      showSize(state.image.w);
      for (const a of ["left", "center", "right"])
        pressable
          .get(`align-${a}`)
          .setAttribute("aria-pressed", String(state.image.align === a));
    }
  }

  return {
    el,
    /** Enable the buttons for this editor instance. */
    attach(api) {
      editor = api;
      for (const b of el.querySelectorAll("button, select")) b.disabled = false;
      unsubscribe = api.onSelection(() => {
        if (!frame) frame = requestAnimationFrame(refresh);
      });
      refresh();
    },
    destroy() {
      closePicker();
      closeCalloutMenu();
      unsubscribe?.();
      if (frame) cancelAnimationFrame(frame);
      editor = null;
      el.remove();
    }
  };
}
