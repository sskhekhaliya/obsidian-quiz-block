import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

// Theme-adaptive Mark decorations
const keyDeco = Decoration.mark({ class: "qblock-cm-key cm-property" });
const valDeco = Decoration.mark({ class: "qblock-cm-val cm-string" });
const punctDeco = Decoration.mark({ class: "qblock-cm-punct cm-punctuation" });
const commentDeco = Decoration.mark({ class: "qblock-cm-comment cm-comment" });
const fenceTagDeco = Decoration.mark({ class: "qblock-cm-fence-tag cm-keyword" });

interface QBlockSpan {
  contentFrom: number;
  contentTo: number;
  tagFrom?: number;
  tagTo?: number;
}

/**
 * Finds all qblock / quizblock code fences in the document.
 */
function findQBlocks(doc: EditorView["state"]["doc"]): QBlockSpan[] {
  const blocks: QBlockSpan[] = [];
  let inBlock = false;
  let fenceChar = "";
  let fenceLen = 0;
  let contentFrom = 0;
  let tagFrom: number | undefined;
  let tagTo: number | undefined;
  let inTripleQuote = false;
  let tripleQuoteChar = "";

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;

    if (!inBlock) {
      // Look for opening fence: ```qblock or ~~~quizblock
      const match = text.match(/^([ \t]*)(`{3,}|~{3,})([ \t]*)(qblock|quizblock)\b/i);
      if (match) {
        inBlock = true;
        fenceChar = match[2][0];
        fenceLen = match[2].length;
        contentFrom = line.to < doc.length ? line.to + 1 : doc.length;
        inTripleQuote = false;

        const tagStart = line.from + match[1].length + match[2].length + match[3].length;
        tagFrom = tagStart;
        tagTo = tagStart + match[4].length;
      }
    } else {
      // Inside a qblock: track if we are currently inside a multi-line triple quote
      // To prevent inner ``` lines inside strings from prematurely closing the block
      let col = 0;
      while (col < text.length) {
        if (!inTripleQuote) {
          if (text[col] === "#") {
            // Comment extends to end of line
            break;
          }
          if (text.startsWith('"""', col)) {
            inTripleQuote = true;
            tripleQuoteChar = '"""';
            col += 3;
            continue;
          }
          if (text.startsWith("'''", col)) {
            inTripleQuote = true;
            tripleQuoteChar = "'''";
            col += 3;
            continue;
          }
          if (text[col] === '"' || text[col] === "'") {
            const q = text[col];
            col++;
            while (col < text.length) {
              if (text[col] === "\\") {
                col += 2;
                continue;
              }
              if (text[col] === q) {
                col++;
                break;
              }
              col++;
            }
            continue;
          }
        } else {
          // Inside triple quote
          if (text[col] === "\\") {
            col += 2;
            continue;
          }
          if (text.startsWith(tripleQuoteChar, col)) {
            inTripleQuote = false;
            col += 3;
            continue;
          }
        }
        col++;
      }

      // If not inside triple quote, check for closing fence
      if (!inTripleQuote) {
        const closeMatch = text.match(/^([ \t]*)(`{3,}|~{3,})[ \t]*$/);
        if (closeMatch && closeMatch[2][0] === fenceChar && closeMatch[2].length >= fenceLen) {
          inBlock = false;
          const contentTo = line.from > 0 ? line.from - 1 : line.from;
          if (contentTo >= contentFrom) {
            blocks.push({ contentFrom, contentTo, tagFrom, tagTo });
          } else {
            blocks.push({ contentFrom, contentTo: contentFrom, tagFrom, tagTo });
          }
          tagFrom = undefined;
          tagTo = undefined;
        }
      }
    }
  }

  // If EOF reached while still in block
  if (inBlock) {
    blocks.push({ contentFrom, contentTo: doc.length, tagFrom, tagTo });
  }

  return blocks;
}

/**
 * Builds CodeMirror decorations for all qblocks in the document.
 */
export function buildQBlockDecorations(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const blocks = findQBlocks(doc);
  if (blocks.length === 0) {
    return Decoration.none;
  }

  const builder = new RangeSetBuilder<Decoration>();

  for (const block of blocks) {
    // Optionally decorate the fence tag (e.g. "qblock")
    if (block.tagFrom !== undefined && block.tagTo !== undefined && block.tagFrom < block.tagTo) {
      builder.add(block.tagFrom, block.tagTo, fenceTagDeco);
    }

    if (block.contentTo <= block.contentFrom) {
      continue;
    }

    const blockText = doc.sliceString(block.contentFrom, block.contentTo);
    let i = 0;

    while (i < blockText.length) {
      const ch = blockText[i];

      // 1. Whitespace
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        i++;
        continue;
      }

      // 2. Comments
      if (ch === "#") {
        const start = i;
        while (i < blockText.length && blockText[i] !== "\n") {
          i++;
        }
        builder.add(block.contentFrom + start, block.contentFrom + i, commentDeco);
        continue;
      }

      // 3. Punctuation
      if (ch === "{" || ch === "}" || ch === "[" || ch === "]" || ch === "," || ch === ":") {
        builder.add(block.contentFrom + i, block.contentFrom + i + 1, punctDeco);
        i++;
        continue;
      }

      // 4. Triple-quoted strings (""" or ''')
      if (blockText.startsWith('"""', i) || blockText.startsWith("'''", i)) {
        const quote = blockText.slice(i, i + 3);
        const start = i;
        i += 3;
        while (i < blockText.length) {
          if (blockText[i] === "\\") {
            i += 2;
            continue;
          }
          if (blockText.startsWith(quote, i)) {
            i += 3;
            break;
          }
          i++;
        }
        const end = i;

        // Check if followed by colon ':' (making it a key)
        let nextIdx = end;
        while (nextIdx < blockText.length && /\s/.test(blockText[nextIdx])) {
          nextIdx++;
        }
        const isKey = nextIdx < blockText.length && blockText[nextIdx] === ":";

        builder.add(block.contentFrom + start, block.contentFrom + end, isKey ? keyDeco : valDeco);
        continue;
      }

      // 5. Single / Double quoted strings ("..." or '...')
      if (ch === '"' || ch === "'") {
        const quote = ch;
        const start = i;
        i++;
        while (i < blockText.length) {
          if (blockText[i] === "\\") {
            i += 2;
            continue;
          }
          if (blockText[i] === quote) {
            i++;
            break;
          }
          if (blockText[i] === "\n") {
            // Unclosed on this line
            break;
          }
          i++;
        }
        const end = i;

        // Check if followed by colon ':' (making it a key)
        let nextIdx = end;
        while (nextIdx < blockText.length && /\s/.test(blockText[nextIdx])) {
          nextIdx++;
        }
        const isKey = nextIdx < blockText.length && blockText[nextIdx] === ":";

        builder.add(block.contentFrom + start, block.contentFrom + end, isKey ? keyDeco : valDeco);
        continue;
      }

      // 6. Numbers
      const numMatch = blockText.slice(i).match(/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?/);
      if (numMatch && numMatch[0].length > 0) {
        const matchLen = numMatch[0].length;
        builder.add(block.contentFrom + i, block.contentFrom + i + matchLen, valDeco);
        i += matchLen;
        continue;
      }

      // 7. Words / Identifiers (e.g. unquoted keys like title: or values like True/False/None)
      if (/[a-zA-Z_]/.test(ch)) {
        const start = i;
        while (i < blockText.length && /[a-zA-Z0-9_-]/.test(blockText[i])) {
          i++;
        }
        const end = i;

        // Check if followed by colon ':'
        let nextIdx = end;
        while (nextIdx < blockText.length && /\s/.test(blockText[nextIdx])) {
          nextIdx++;
        }
        const isKey = nextIdx < blockText.length && blockText[nextIdx] === ":";

        builder.add(block.contentFrom + start, block.contentFrom + end, isKey ? keyDeco : valDeco);
        continue;
      }

      // Fallback
      i++;
    }
  }

  return builder.finish();
}

/**
 * ViewPlugin providing syntax highlighting inside qblock code blocks.
 */
export const qblockHighlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildQBlockDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildQBlockDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
);
