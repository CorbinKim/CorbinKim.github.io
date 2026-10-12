// Medium-style WYSIWYG body editor: Milkdown's Crepe (ProseMirror + KaTeX +
// CodeMirror), framework-agnostic, so the site's React 16 is irrelevant.
// Loaded lazily (dynamic import) because it is the bulk of the admin bundle.
//
// Every workaround below was found and verified while evaluating Crepe against
// this site's Markdown pipeline (remark-math / remark-gfm / @mdx-js); the
// reasons are spelled out next to each one.
import {Crepe, CrepeFeature} from "@milkdown/crepe";
import {imageBlockSchema} from "@milkdown/kit/component/image-block";
import {toggleLinkCommand} from "@milkdown/kit/component/link-tooltip";
import {
  commandsCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx
} from "@milkdown/kit/core";
import {
  addBlockTypeCommand,
  blockquoteSchema,
  bulletListSchema,
  codeBlockSchema,
  emphasisSchema,
  headingSchema,
  hrSchema,
  inlineCodeSchema,
  isMarkSelectedCommand,
  linkSchema,
  listItemSchema,
  orderedListSchema,
  paragraphSchema,
  selectTextNearPosCommand,
  setBlockTypeCommand,
  strongSchema,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleStrongCommand,
  wrapInBlockTypeCommand
} from "@milkdown/kit/preset/commonmark";
import {
  createTable,
  strikethroughSchema,
  toggleStrikethroughCommand
} from "@milkdown/kit/preset/gfm";
import {Plugin, TextSelection} from "@milkdown/kit/prose/state";
import {lift, wrapIn} from "@milkdown/kit/prose/commands";
import {Decoration, DecorationSet} from "@milkdown/kit/prose/view";
import {$prose, replaceAll} from "@milkdown/kit/utils";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame.css";
import {blockPlugins, calloutSchema, toggleSchema} from "./blocks.js";
import {footnotePlugin, insertFootnote} from "./footnotes.js";
import {pictureResize} from "./imageresize.js";
import {editorStyle, joinImageSrc, splitImageSrc} from "./imageopts.js";
import "./editor.css";

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * @param {object} o
 * @param {HTMLElement} o.root
 * @param {string} o.markdown            initial body
 * @param {(md: string) => void} o.onChange        debounced ~200 ms by Crepe
 * @param {(file: File) => Promise<string>} o.onUploadImage  returns the src to
 *        store in the Markdown (a placeholder path, see config.js)
 * @param {(src: string) => string} o.previewUrl  display-only src -> blob: URL
 */
export async function createEditor({
  root,
  markdown,
  onChange,
  onUploadImage,
  previewUrl
}) {
  const crepe = new Crepe({
    root,
    defaultValue: markdown || "",
    features: {
      // Crepe's own list items restore a selection captured at mount inside a
      // requestAnimationFrame; typing quickly right after Enter in a list then
      // scrambles the first character. Plain <li> (styled in editor.css, with
      // the checkbox toggle plugin below) does not have the race.
      [CrepeFeature.ListItem]: false
    },
    featureConfigs: {
      [CrepeFeature.Placeholder]: {
        text: "Tell your story… (add pictures with the Image button, or paste / drop them)",
        mode: "block"
      },
      [CrepeFeature.ImageBlock]: {
        // fires for the slash-menu upload button, clipboard paste and drag-drop
        onUpload: onUploadImage,
        // the Markdown keeps the placeholder path; only the <img> shows a blob:
        proxyDomURL: previewUrl,
        blockCaptionPlaceholderText: "Write a caption (optional)",
        blockUploadPlaceholderText: "or paste an image link",
        blockUploadButton: "Upload image"
      },
      [CrepeFeature.LinkTooltip]: {inputPlaceholder: "Paste a link…"},
      // the virtual cursor makes the list-typing race above much worse
      [CrepeFeature.Cursor]: {virtual: false}
    }
  });

  // Serializer options (mdast-util-to-markdown). Must be set before create().
  crepe.editor.config(ctx => {
    ctx.update(remarkStringifyOptionsCtx, prev => ({
      ...prev,
      bullet: "-", // "- item", like the existing posts
      rule: "-",
      emphasis: "*",
      strong: "*",
      fences: true,
      listItemIndent: "one",
      resourceLink: true, // [t](url), never <url> autolinks (invalid in MDX)
      handlers: {
        ...prev.handlers,
        // Milkdown's text handler skips escaping for text that ends in
        // whitespace (the text right before **bold** / `code` / a link), so
        // "a { b **x**" would leak a raw "{". Same handler, but that fast path
        // also escapes the characters MDX treats as syntax.
        text: (node, _parent, state, info) => {
          const value = node.value;
          if (/^[^*_\\]*\s+$/.test(value))
            return value.replace(/[{}<$]/g, "\\$&");
          return state.safe(value, {...info, encode: []});
        }
      },
      // { } < are MDX syntax even in prose (a bare "{" breaks a .mdx build).
      // Backslash-escaping them is harmless in plain .md too.
      unsafe: [
        ...(prev.unsafe || []),
        {character: "{", inConstruct: "phrasing"},
        {character: "}", inConstruct: "phrasing"},
        {character: "<", inConstruct: "phrasing"}
      ]
    }));
  });

  // Task-list checkbox toggle for the plain-<li> fallback.
  crepe.editor.use(
    $prose(
      () =>
        new Plugin({
          props: {
            handleClickOn(view, _pos, node, nodePos, event) {
              if (node.type.name !== "list_item" || node.attrs.checked == null)
                return false;
              const li = event.target.closest && event.target.closest("li");
              if (!li || event.clientX - li.getBoundingClientRect().left > 28)
                return false; // only the checkbox gutter
              view.dispatch(
                view.state.tr.setNodeAttribute(
                  nodePos,
                  "checked",
                  !node.attrs.checked
                )
              );
              return true;
            }
          }
        })
    )
  );

  // The sticky top bar (56 px) and the formatting toolbar (~46 px) cover the top
  // of the screen: keep the caret clear of them (and of the bottom edge) when
  // ProseMirror scrolls it into view.
  crepe.editor.use(
    $prose(
      () =>
        new Plugin({
          props: {
            scrollMargin: {top: 170, right: 5, bottom: 96, left: 5},
            scrollThreshold: {top: 170, right: 0, bottom: 96, left: 0}
          }
        })
    )
  );

  // callout boxes and collapsible blocks (blocks.js), footnote numbering (footnotes.js)
  crepe.editor.use(blockPlugins);
  crepe.editor.use(footnotePlugin);

  // Show a picture's size/alignment (kept in its src fragment) in the editor too.
  crepe.editor.use(
    $prose(
      () =>
        new Plugin({
          props: {
            decorations(state) {
              const decorations = [];
              state.doc.descendants((node, pos) => {
                if (node.type.name !== "image-block") return;
                const opts = splitImageSrc(node.attrs.src);
                if (opts.w || opts.align)
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      style: editorStyle(opts),
                      "data-sized": "1",
                      // which corners can be dragged (imageresize.js)
                      ...(opts.align ? {"data-align": opts.align} : {})
                    })
                  );
              });
              return decorations.length
                ? DecorationSet.create(state.doc, decorations)
                : null;
            }
          }
        })
    )
  );

  // drag a corner of a picture to resize it
  crepe.editor.use(pictureResize);

  // Tell the toolbar whenever the document or selection changes, so it can show
  // which formatting is active at the caret.
  const selectionListeners = new Set();
  crepe.editor.use(
    $prose(
      () =>
        new Plugin({
          view: () => ({
            update: () => selectionListeners.forEach(fn => fn())
          })
        })
    )
  );

  crepe.on(listener => {
    listener.markdownUpdated((_ctx, md) => onChange?.(md));
  });

  await crepe.create();

  const run = fn => crepe.editor.action(fn);
  const enclosing = ($pos, type) => {
    for (let d = $pos.depth; d > 0; d--)
      if ($pos.node(d).type === type) return $pos.node(d);
    return null;
  };
  const call = (key, payload) =>
    run(ctx => ctx.get(commandsCtx).call(key, payload));

  function markActive(ctx, markType) {
    if (ctx.get(commandsCtx).call(isMarkSelectedCommand.key, markType))
      return true;
    const {state} = ctx.get(editorViewCtx);
    if (state.storedMarks)
      return state.storedMarks.some(m => m.type === markType);
    if (state.selection instanceof TextSelection && state.selection.$cursor)
      return state.selection.$cursor.marks().some(m => m.type === markType);
    return false;
  }

  // Formatting commands the toolbar buttons call. Each one is the same
  // ProseMirror/Milkdown command the slash menu and the keyboard shortcuts use,
  // so the Markdown that comes out is identical to typing the syntax by hand.
  const commands = {
    bold: () => call(toggleStrongCommand.key),
    italic: () => call(toggleEmphasisCommand.key),
    strike: () => call(toggleStrikethroughCommand.key),
    inlineCode: () =>
      run(ctx => {
        const view = ctx.get(editorViewCtx);
        const {state} = view;
        if (state.selection.empty) {
          // the command needs a selection: toggle the pending mark instead
          const mark = inlineCodeSchema.type(ctx);
          view.dispatch(
            markActive(ctx, mark)
              ? state.tr.removeStoredMark(mark)
              : state.tr.addStoredMark(mark.create())
          );
        } else ctx.get(commandsCtx).call(toggleInlineCodeCommand.key);
      }),
    /** level 1-6, or null for a normal paragraph */
    heading: level =>
      run(ctx => {
        const commands = ctx.get(commandsCtx);
        if (level == null)
          commands.call(setBlockTypeCommand.key, {
            nodeType: paragraphSchema.type(ctx)
          });
        else
          commands.call(setBlockTypeCommand.key, {
            nodeType: headingSchema.type(ctx),
            attrs: {level}
          });
      }),
    bulletList: () =>
      run(ctx =>
        ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, {
          nodeType: bulletListSchema.type(ctx)
        })
      ),
    orderedList: () =>
      run(ctx =>
        ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, {
          nodeType: orderedListSchema.type(ctx)
        })
      ),
    taskList: () =>
      run(ctx =>
        ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, {
          nodeType: listItemSchema.type(ctx),
          attrs: {checked: false}
        })
      ),
    quote: () =>
      run(ctx =>
        ctx.get(commandsCtx).call(wrapInBlockTypeCommand.key, {
          nodeType: blockquoteSchema.type(ctx)
        })
      ),
    codeBlock: () =>
      run(ctx =>
        ctx.get(commandsCtx).call(setBlockTypeCommand.key, {
          nodeType: codeBlockSchema.type(ctx)
        })
      ),
    mathBlock: () =>
      run(ctx =>
        ctx.get(commandsCtx).call(addBlockTypeCommand.key, {
          nodeType: codeBlockSchema.type(ctx),
          attrs: {language: "LaTeX"}
        })
      ),
    mathInline: () => call("ToggleLatex"),
    divider: () =>
      run(ctx =>
        ctx.get(commandsCtx).call(addBlockTypeCommand.key, {
          nodeType: hrSchema.type(ctx)
        })
      ),
    /** opens the link editor on the selection (Crepe's link tooltip) */
    link: () =>
      run(ctx => {
        const view = ctx.get(editorViewCtx);
        const {state} = view;
        const mark = linkSchema.type(ctx);
        if (state.selection.empty && markActive(ctx, mark))
          view.dispatch(state.tr.removeStoredMark(mark));
        else ctx.get(commandsCtx).call(toggleLinkCommand.key);
      }),
    /** an empty rows x cols table (first row is the header) */
    table: (rows, cols) =>
      run(ctx => {
        const commands = ctx.get(commandsCtx);
        const {from} = ctx.get(editorViewCtx).state.selection;
        commands.call(addBlockTypeCommand.key, {
          nodeType: createTable(ctx, rows, cols)
        });
        commands.call(selectTextNearPosCommand.key, {pos: from});
      }),
    /** A callout box of `kind` around the selection; inside one of the same kind
     *  it removes the box, inside another kind it changes the kind. */
    callout: kind =>
      run(ctx => {
        const view = ctx.get(editorViewCtx);
        const {state} = view;
        const type = calloutSchema.type(ctx);
        const {$from} = state.selection;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type !== type) continue;
          if (node.attrs.kind === kind) lift(state, view.dispatch);
          else
            view.dispatch(
              state.tr.setNodeMarkup($from.before(d), undefined, {kind})
            );
          return;
        }
        wrapIn(type, {kind})(state, view.dispatch);
      }),

    /** A collapsible block: the selected paragraph becomes its title. Inside one
     *  it removes the block. */
    toggle: () =>
      run(ctx => {
        const view = ctx.get(editorViewCtx);
        const {state} = view;
        const type = toggleSchema.type(ctx);
        const {$from} = state.selection;
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type === type) {
            lift(state, view.dispatch);
            return;
          }
        }
        wrapIn(type)(state, view.dispatch);
      }),

    /** A footnote marker at the caret and an empty note at the end of the story,
     *  with the caret in the note. */
    footnote: () => run(ctx => insertFootnote(ctx.get(editorViewCtx))),

    /** Size / alignment of the selected picture: {w: 33|50|75|100|0, align:
     *  "left"|"center"|"right"|""}; keys you leave out are kept. */
    imageOptions: opts =>
      run(ctx => {
        const view = ctx.get(editorViewCtx);
        const {selection} = view.state;
        if (selection.node?.type.name !== "image-block") return;
        const {base, ...current} = splitImageSrc(selection.node.attrs.src);
        view.dispatch(
          view.state.tr.setNodeAttribute(
            selection.from,
            "src",
            joinImageSrc(base, {...current, ...opts})
          )
        );
      }),

    /** an image block for `src` (a placeholder path, see config.js); the caret
     *  moves to a paragraph below it */
    image: src =>
      run(ctx => {
        const view = ctx.get(editorViewCtx);
        ctx.get(commandsCtx).call(addBlockTypeCommand.key, {
          nodeType: imageBlockSchema.type(ctx),
          attrs: {src}
        });
        // The new image is the selected node. Another insert (several files at
        // once) or typing would replace it, so continue in a paragraph after it.
        const {state} = view;
        const {$to} = state.selection;
        const paragraph = paragraphSchema.type(ctx);
        let tr = state.tr;
        if (!($to.nodeAfter && $to.nodeAfter.type === paragraph))
          tr = tr.insert($to.pos, paragraph.create());
        tr = tr.setSelection(TextSelection.near(tr.doc.resolve($to.pos + 1)));
        view.dispatch(tr.scrollIntoView());
      })
  };

  return {
    commands,

    /** Which formatting applies at the caret (for the toolbar's pressed states). */
    formatState: () =>
      run(ctx => {
        const {selection} = ctx.get(editorViewCtx).state;
        const parent = selection.$from.parent;
        return {
          bold: markActive(ctx, strongSchema.type(ctx)),
          italic: markActive(ctx, emphasisSchema.type(ctx)),
          strike: markActive(ctx, strikethroughSchema.type(ctx)),
          code: markActive(ctx, inlineCodeSchema.type(ctx)),
          link: markActive(ctx, linkSchema.type(ctx)),
          heading:
            parent.type === headingSchema.type(ctx) ? parent.attrs.level : 0,
          // the callout kind / toggle the caret is inside, if any
          callout: enclosing(selection.$from, calloutSchema.type(ctx))?.attrs
            .kind,
          toggle: !!enclosing(selection.$from, toggleSchema.type(ctx)),
          // the selected picture's options, or null when no picture is selected
          image:
            selection.node?.type.name === "image-block"
              ? (({w, align}) => ({w, align}))(
                  splitImageSrc(selection.node.attrs.src)
                )
              : null
        };
      }),

    /** @returns {() => void} unsubscribe */
    onSelection(fn) {
      selectionListeners.add(fn);
      return () => selectionListeners.delete(fn);
    },

    getMarkdown: () => crepe.getMarkdown(),

    /** Replace the whole document. flush=true resets undo history (loading a
     *  draft must not leave an undo step back to an empty doc) and fires no
     *  onChange for the load itself. */
    setMarkdown: md => crepe.editor.action(replaceAll(md, true)),

    /** Commit input that is still being typed. An image caption is an <input>
     *  that only writes to the document on blur or after a 1 s debounce. */
    async flush() {
      if (root.contains(document.activeElement)) document.activeElement.blur();
      await sleep(60);
    },

    focus: () => root.querySelector(".ProseMirror")?.focus(),
    destroy: () => crepe.destroy()
  };
}
