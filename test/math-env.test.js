// Run: node --test test/math-env.test.js
import {test} from "node:test";
import assert from "node:assert/strict";
import katex from "katex";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import {unified} from "unified";
import {
  isMathEnvironment,
  katexOptions,
  remarkMathEnvironments,
  wrapRawEnvironments
} from "../plugins/math-env.js";

// KaTeX keeps the TeX source in a hidden MathML <annotation>; only the visible part matters
const visible = html => html.replace(/<annotation[\s\S]*?<\/annotation>/g, "");

const EQ = String.raw`\begin{equation}C_{U}(u) = P(U_1 \le u_1, \ldots, U_d \le u_d)\end{equation}`;

test("isMathEnvironment: one complete display environment", () => {
  assert.equal(isMathEnvironment(EQ), true);
  assert.equal(isMathEnvironment(`  ${EQ}\n`), true);
  assert.equal(
    isMathEnvironment(String.raw`\begin{align*}a&=b\\c&=d\end{align*}`),
    true
  );
  assert.equal(
    isMathEnvironment(String.raw`\begin{gather}a\end{gather}`),
    true
  );
  assert.equal(
    isMathEnvironment(String.raw`\begin{equation}a\end{align}`),
    false
  ); // mismatched
  assert.equal(
    isMathEnvironment(String.raw`x \begin{equation}a\end{equation}`),
    false
  ); // text before
  assert.equal(
    isMathEnvironment(String.raw`\begin{equation}a\end{equation} y`),
    false
  ); // text after
  assert.equal(isMathEnvironment("a = b"), false);
  assert.equal(isMathEnvironment(undefined), false);
});

test("katexOptions: \\label is accepted and not shown, the equation stays numbered", () => {
  const html = katex.renderToString(
    String.raw`\begin{equation}x = y \label{eq:my_label}\end{equation}`,
    {
      ...katexOptions,
      displayMode: true,
      throwOnError: true
    }
  );
  assert.match(html, /eqn-num/);
  assert.ok(!visible(html).includes("eq:my_label"));
});

test("wrapRawEnvironments: a bare environment gets a $$ block, content untouched", () => {
  const md = ["Intro text.", EQ, "", "Next."].join("\n");
  assert.equal(
    wrapRawEnvironments(md),
    ["Intro text.", "", "$$", EQ, "$$", "", "Next."].join("\n")
  );
});

test("wrapRawEnvironments: multi-line align with \\\\ and & is kept exactly", () => {
  const body = [
    String.raw`\begin{align}`,
    String.raw`  a &= b \\`,
    String.raw`  c_d &= e_f`,
    String.raw`\end{align}`
  ];
  const md = ["Before", "", ...body, "", "After"].join("\n");
  assert.equal(
    wrapRawEnvironments(md),
    ["Before", "", "$$", ...body, "$$", "", "After"].join("\n")
  );
});

test("wrapRawEnvironments: leaves code, existing $$ blocks and mid-sentence mentions alone", () => {
  const code = ["```latex", EQ, "```"].join("\n");
  assert.equal(wrapRawEnvironments(code), code);
  const tilde = ["~~~", EQ, "~~~"].join("\n");
  assert.equal(wrapRawEnvironments(tilde), tilde);
  const already = ["$$", EQ, "$$"].join("\n");
  assert.equal(wrapRawEnvironments(already), already);
  const oneLine = `$$${EQ}$$`;
  assert.equal(wrapRawEnvironments(oneLine), oneLine);
  const mention = `Use ${EQ} in your text.`;
  assert.equal(wrapRawEnvironments(mention), mention);
  const trailing = `${EQ} and more`;
  assert.equal(wrapRawEnvironments(trailing), trailing);
});

test("wrapRawEnvironments: a blank line, a missing \\end or an unknown name means no wrapping", () => {
  const broken = [
    String.raw`\begin{equation}`,
    "",
    String.raw`a\end{equation}`
  ].join("\n");
  assert.equal(wrapRawEnvironments(broken), broken);
  const open = [String.raw`\begin{equation}`, "a = b"].join("\n");
  assert.equal(wrapRawEnvironments(open), open);
  const other = String.raw`\begin{itemize}\item a\end{itemize}`;
  assert.equal(wrapRawEnvironments(other), other);
});

test("wrapRawEnvironments: several blocks, CRLF kept, same string when nothing to do", () => {
  const two = [EQ, "", String.raw`\begin{gather*}x\end{gather*}`].join("\r\n");
  assert.equal(
    wrapRawEnvironments(two),
    [
      "$$",
      EQ,
      "$$",
      "",
      "$$",
      String.raw`\begin{gather*}x\end{gather*}`,
      "$$"
    ].join("\r\n")
  );
  const plain = "no math here\n\n$x$ and $$y$$\n";
  assert.equal(wrapRawEnvironments(plain), plain);
  assert.equal(wrapRawEnvironments(""), "");
  assert.equal(wrapRawEnvironments(undefined), "");
});

const toHtml = (md, opts = {}) =>
  String(
    unified()
      .use(remarkParse)
      .use(remarkMath)
      .use(remarkMathEnvironments, opts)
      .use(remarkRehype)
      .use(rehypeKatex, katexOptions)
      .use(rehypeStringify)
      .processSync(wrapRawEnvironments(md))
  );

test("remarkMathEnvironments: $$\\begin{equation}...$$ on one line becomes a numbered display equation", () => {
  const html = toHtml(`$$${EQ}$$`);
  assert.match(html, /katex-display/);
  assert.match(html, /eqn-num/);
  assert.ok(!html.includes("katex-error"));
  const single = toHtml(`$${EQ}$`);
  assert.match(single, /katex-display/);
  assert.ok(!single.includes("katex-error"));
});

test("a bare \\begin{equation} paragraph, align rows and \\label all render, numbered, without errors", () => {
  const html = toHtml(
    [
      "Text before.",
      EQ,
      "",
      String.raw`\begin{align}a &= b \label{eq:a}\\ c &= d\end{align}`,
      ""
    ].join("\n")
  );
  assert.equal((html.match(/katex-display/g) || []).length, 2);
  assert.ok(!html.includes("katex-error"));
  assert.ok(!visible(html).includes("eq:a"));
  assert.match(html, /<p>Text before\.<\/p>/);
});

test("remarkMathEnvironments leaves other inline math and mixed paragraphs alone", () => {
  const html = toHtml(`Inline $x^2$ and $${EQ}$ in a sentence.`);
  assert.ok(!html.includes("katex-display")); // still inline (and an error there: not our case to fix)
  const plain = toHtml("Just $a=b$ here.");
  assert.ok(!plain.includes("katex-display"));
  assert.ok(!plain.includes("katex-error"));
});

test("asCode gives the editor's math block: a code node with language LaTeX", () => {
  const tree = unified().use(remarkParse).use(remarkMath).parse(`$$${EQ}$$`);
  remarkMathEnvironments({asCode: true})(tree);
  assert.deepEqual(tree.children[0], {type: "code", lang: "LaTeX", value: EQ});
});
