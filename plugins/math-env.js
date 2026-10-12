// Overleaf-style LaTeX equations, as they are written in a paper:
//
//   \begin{equation}
//     C_U(u) = P(U_1 \le u_1, \ldots, U_d \le u_d) \label{eq:copula}
//   \end{equation}
//
// KaTeX renders these environments (and numbers them with its CSS counters), but
// only as display math. In Markdown that means a $$ block, so three things make
// the LaTeX work exactly as typed:
//
//  * wrapRawEnvironments(): a \begin{equation} ... \end{equation} that stands on
//    its own lines, with no $$ around it, is wrapped in a $$ block before the
//    Markdown is parsed (Markdown would otherwise garble `\\`, `_`, `*` ...);
//  * remarkMathEnvironments(): a paragraph that holds nothing but one inline
//    $...$ environment (what you get from `$$\begin{equation}...$$` on one line)
//    becomes a display block, where the environment is allowed;
//  * katexMacros: \label{...} is accepted and ignored (the number is automatic).
//
// Dependency-free ESM, used by the site build (vite.config.js), the editor and
// its live preview. Unit-tested in test/math-env.test.js.

// Environments KaTeX only allows in display mode (each also exists as `name*`).
const NAMES = "(?:equation|align|gather|alignat)\\*?";
const BEGIN_AT_LINE_START = new RegExp(
  String.raw`^[ \t]{0,3}\\begin\{(${NAMES})\}`
);
const WHOLE = new RegExp(
  String.raw`^\s*\\begin\{(${NAMES})\}[\s\S]*\\end\{\1\}\s*$`
);

/** Is `text` one complete display environment, \begin{x} ... \end{x}, and nothing else? */
export function isMathEnvironment(text) {
  return WHOLE.test(String(text ?? ""));
}

/** KaTeX macros shared by the site, the live preview and the editor. */
export const katexMacros = {
  // \label{eq:foo}: equations are numbered automatically, the label is not shown
  "\\label": context => {
    context.consumeArgs(1);
    return "";
  }
};

/** KaTeX options (also valid as rehype-katex options). */
export const katexOptions = {macros: katexMacros};

/**
 * Wrap \begin{equation|align|gather|alignat}[*] ... \end{...} blocks that are
 * written on their own lines in a $$ block. Fenced code, existing $$ blocks and
 * text that merely mentions \begin{equation} mid-sentence are left alone. Returns
 * the very same string when there is nothing to wrap.
 */
export function wrapRawEnvironments(markdown) {
  const text = String(markdown ?? "");
  if (!text.includes("\\begin{")) return text;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const out = [];
  let fence = ""; // the marker of the code fence we are inside
  let inMath = false; // inside a multi-line $$ block
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const marker = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      out.push(line);
      if (
        marker &&
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        /^[ \t]*$/.test(line.slice(marker[0].length))
      )
        fence = "";
      continue;
    }
    if (marker) {
      fence = marker[1];
      out.push(line);
      continue;
    }
    if (inMath) {
      out.push(line);
      if (/^[ \t]*\$\$[ \t]*$/.test(line)) inMath = false;
      continue;
    }
    if (/^[ \t]*\$\$/.test(line)) {
      out.push(line);
      if (/^[ \t]*\$\$[ \t]*$/.test(line)) inMath = true; // "$$x$$" closes itself
      continue;
    }

    const begin = BEGIN_AT_LINE_START.exec(line);
    if (begin) {
      const end = `\\end{${begin[1]}}`;
      let last = -1;
      let endsAt = 0;
      for (let j = i; j < lines.length; j++) {
        const k = lines[j].indexOf(end, j === i ? begin[0].length : 0);
        if (k >= 0) {
          last = j;
          endsAt = k + end.length;
          break;
        }
        if (j > i && /^[ \t]*$/.test(lines[j])) break; // LaTeX has no blank lines inside
      }
      if (last >= 0 && /^[ \t]*$/.test(lines[last].slice(endsAt))) {
        if (out.length && !/^[ \t]*$/.test(out[out.length - 1])) out.push("");
        out.push("$$", ...lines.slice(i, last + 1), "$$");
        if (last + 1 < lines.length && !/^[ \t]*$/.test(lines[last + 1]))
          out.push("");
        i = last;
        changed = true;
        continue;
      }
    }
    out.push(line);
  }
  return changed ? out.join(eol) : text;
}

const isBlank = node => node.type === "text" && !node.value.trim();

/** The display math node (as remark-math makes it) for `value`. */
function displayMath(value, asCode) {
  if (asCode) return {type: "code", lang: "LaTeX", value}; // the editor's math block
  return {
    type: "math",
    meta: null,
    value,
    data: {
      hName: "pre",
      hChildren: [
        {
          type: "element",
          tagName: "code",
          properties: {className: ["language-math", "math-display"]},
          children: [{type: "text", value}]
        }
      ]
    }
  };
}

/**
 * remark plugin (run after remark-math): a paragraph holding only one inline math
 * node that is a complete \begin{equation}...\end{equation} (or align, gather ...)
 * becomes a display math block, so it renders (and is numbered) like in LaTeX.
 * `asCode` produces the editor's representation (a code block "LaTeX") instead.
 */
export function remarkMathEnvironments({asCode = false} = {}) {
  const walk = node => {
    if (!node.children) return;
    node.children = node.children.map(child => {
      if (child.type === "paragraph") {
        const kids = child.children.filter(c => !isBlank(c));
        if (
          kids.length === 1 &&
          kids[0].type === "inlineMath" &&
          isMathEnvironment(kids[0].value)
        )
          return displayMath(kids[0].value.trim(), asCode);
      }
      walk(child);
      return child;
    });
  };
  return tree => walk(tree);
}
