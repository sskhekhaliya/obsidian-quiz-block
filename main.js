"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => QuizBlockPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// src/editor-highlight.ts
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var keyDeco = import_view.Decoration.mark({ class: "qblock-cm-key cm-property" });
var valDeco = import_view.Decoration.mark({ class: "qblock-cm-val cm-string" });
var punctDeco = import_view.Decoration.mark({ class: "qblock-cm-punct cm-punctuation" });
var commentDeco = import_view.Decoration.mark({ class: "qblock-cm-comment cm-comment" });
var fenceTagDeco = import_view.Decoration.mark({ class: "qblock-cm-fence-tag cm-keyword" });
function findQBlocks(doc) {
  const blocks = [];
  let inBlock = false;
  let fenceChar = "";
  let fenceLen = 0;
  let contentFrom = 0;
  let tagFrom;
  let tagTo;
  let inTripleQuote = false;
  let tripleQuoteChar = "";
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    if (!inBlock) {
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
      let col = 0;
      while (col < text.length) {
        if (!inTripleQuote) {
          if (text[col] === "#") {
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
          tagFrom = void 0;
          tagTo = void 0;
        }
      }
    }
  }
  if (inBlock) {
    blocks.push({ contentFrom, contentTo: doc.length, tagFrom, tagTo });
  }
  return blocks;
}
function buildQBlockDecorations(view) {
  const doc = view.state.doc;
  const blocks = findQBlocks(doc);
  if (blocks.length === 0) {
    return import_view.Decoration.none;
  }
  const builder = new import_state.RangeSetBuilder();
  for (const block of blocks) {
    if (block.tagFrom !== void 0 && block.tagTo !== void 0 && block.tagFrom < block.tagTo) {
      builder.add(block.tagFrom, block.tagTo, fenceTagDeco);
    }
    if (block.contentTo <= block.contentFrom) {
      continue;
    }
    const blockText = doc.sliceString(block.contentFrom, block.contentTo);
    let i = 0;
    while (i < blockText.length) {
      const ch = blockText[i];
      if (ch === " " || ch === "	" || ch === "\n" || ch === "\r") {
        i++;
        continue;
      }
      if (ch === "#") {
        const start = i;
        while (i < blockText.length && blockText[i] !== "\n") {
          i++;
        }
        builder.add(block.contentFrom + start, block.contentFrom + i, commentDeco);
        continue;
      }
      if (ch === "{" || ch === "}" || ch === "[" || ch === "]" || ch === "," || ch === ":") {
        builder.add(block.contentFrom + i, block.contentFrom + i + 1, punctDeco);
        i++;
        continue;
      }
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
        let nextIdx = end;
        while (nextIdx < blockText.length && /\s/.test(blockText[nextIdx])) {
          nextIdx++;
        }
        const isKey = nextIdx < blockText.length && blockText[nextIdx] === ":";
        builder.add(block.contentFrom + start, block.contentFrom + end, isKey ? keyDeco : valDeco);
        continue;
      }
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
            break;
          }
          i++;
        }
        const end = i;
        let nextIdx = end;
        while (nextIdx < blockText.length && /\s/.test(blockText[nextIdx])) {
          nextIdx++;
        }
        const isKey = nextIdx < blockText.length && blockText[nextIdx] === ":";
        builder.add(block.contentFrom + start, block.contentFrom + end, isKey ? keyDeco : valDeco);
        continue;
      }
      const numMatch = blockText.slice(i).match(/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?/);
      if (numMatch && numMatch[0].length > 0) {
        const matchLen = numMatch[0].length;
        builder.add(block.contentFrom + i, block.contentFrom + i + matchLen, valDeco);
        i += matchLen;
        continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        const start = i;
        while (i < blockText.length && /[a-zA-Z0-9_-]/.test(blockText[i])) {
          i++;
        }
        const end = i;
        let nextIdx = end;
        while (nextIdx < blockText.length && /\s/.test(blockText[nextIdx])) {
          nextIdx++;
        }
        const isKey = nextIdx < blockText.length && blockText[nextIdx] === ":";
        builder.add(block.contentFrom + start, block.contentFrom + end, isKey ? keyDeco : valDeco);
        continue;
      }
      i++;
    }
  }
  return builder.finish();
}
var qblockHighlightPlugin = import_view.ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = buildQBlockDecorations(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildQBlockDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
);

// src/main.ts
var DEFAULT_SETTINGS = {
  shuffleByDefault: false,
  instantFeedback: true,
  oneBasedIndexing: false
};
var QuizBlockPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.registerMarkdownCodeBlockProcessor("qblock", (source, el, ctx) => {
      this.renderQuizBlock(source, el, ctx);
    });
    this.registerMarkdownCodeBlockProcessor("quizblock", (source, el, ctx) => {
      this.renderQuizBlock(source, el, ctx);
    });
    this.registerEditorExtension(qblockHighlightPlugin);
    this.addCommand({
      id: "insert-qblock-template",
      name: "Insert Quiz Block template",
      editorCallback: (editor) => {
        editor.replaceSelection(SAMPLE_QUIZ_TEMPLATE);
      }
    });
    this.addSettingTab(new QuizBlockSettingTab(this.app, this));
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async renderQuizBlock(sourceText, el, ctx) {
    el.empty();
    const container = el.createDiv("qblock-container");
    let rawData = null;
    try {
      rawData = this.parseSource(sourceText);
    } catch (e) {
      this.renderError(container, "Could not parse Quiz Block", String(e));
      return;
    }
    if (!rawData) {
      this.renderError(container, "Empty Quiz Block", "Add questions to your ```qblock fence.");
      return;
    }
    if (rawData.file) {
      const resolved = this.resolveVaultFile(rawData.file, ctx.sourcePath);
      if (!resolved) {
        this.renderError(container, "Referenced quiz file not found", `Could not locate file "${rawData.file}" in your vault.`);
        return;
      }
      try {
        const fileContent = await this.app.vault.cachedRead(resolved);
        rawData = this.parseSource(fileContent);
      } catch (err) {
        this.renderError(container, `Failed to read ${resolved.path}`, String(err));
        return;
      }
    }
    const parsed = this.parseQuizData(rawData);
    if (!parsed.questions.length) {
      this.renderError(container, "No valid questions found", "Ensure your questions array contains valid question texts and choices.");
      return;
    }
    const renderer = new QuizRenderer(container, parsed, this.settings, this.app, ctx.sourcePath, this);
    renderer.render();
  }
  dedentText(str) {
    const lines = str.split("\n");
    let minIndent = Infinity;
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      const match = line.match(/^[ \t]*/);
      const indentLength = match ? match[0].length : 0;
      if (indentLength < minIndent) {
        minIndent = indentLength;
      }
    }
    if (minIndent !== Infinity && minIndent > 0) {
      return lines.map((line) => line.trim().length === 0 ? "" : line.slice(minIndent)).join("\n").trim();
    }
    return str.trim();
  }
  preprocessPythonSource(source) {
    let text = source.replace(/"""([\s\S]*?)"""/g, (_, content) => JSON.stringify(this.dedentText(content)));
    text = text.replace(/'''([\s\S]*?)'''/g, (_, content) => JSON.stringify(this.dedentText(content)));
    const lines = text.split("\n");
    const cleanedLines = lines.map((line) => {
      let inDouble = false;
      let inSingle = false;
      let escape = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === "\\") {
          escape = true;
          continue;
        }
        if (char === '"' && !inSingle) {
          inDouble = !inDouble;
        } else if (char === "'" && !inDouble) {
          inSingle = !inSingle;
        } else if (char === "#" && !inDouble && !inSingle) {
          return line.slice(0, i);
        }
      }
      return line;
    });
    text = cleanedLines.join("\n");
    text = text.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null");
    return text.trim();
  }
  parseSource(sourceText) {
    const trimmed = sourceText.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const processed = this.preprocessPythonSource(trimmed);
        const fn = new Function('"use strict"; return (' + processed + ");");
        const evaluated = fn();
        if (evaluated && typeof evaluated === "object") {
          return evaluated;
        }
      } catch (e) {
      }
    }
    try {
      return (0, import_obsidian.parseYaml)(sourceText);
    } catch (yamlErr) {
      const processed = this.preprocessPythonSource(trimmed);
      const fn = new Function('"use strict"; return (' + processed + ");");
      const evaluated = fn();
      if (evaluated && typeof evaluated === "object") {
        return evaluated;
      }
      throw yamlErr;
    }
  }
  resolveVaultFile(filePath, sourcePath) {
    const clean = filePath.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
    const file = this.app.metadataCache.getFirstLinkpathDest(clean, sourcePath);
    if (file) return file;
    const direct = this.app.vault.getAbstractFileByPath(clean);
    return direct instanceof import_obsidian.TFile ? direct : null;
  }
  parseQuizData(raw) {
    let questionsRaw = [];
    if (Array.isArray(raw)) {
      questionsRaw = raw;
    } else if (Array.isArray(raw.questions)) {
      questionsRaw = raw.questions;
    } else if (raw.quiz) {
      if (Array.isArray(raw.quiz)) questionsRaw = raw.quiz;
      else if (Array.isArray(raw.quiz.questions)) questionsRaw = raw.quiz.questions;
    }
    const prefixes = ["A.", "B.", "C.", "D.", "E.", "F.", "G.", "H."];
    const parsedQuestions = [];
    questionsRaw.forEach((q, qIndex) => {
      const questionText = q.question || q.title || "";
      if (!questionText.trim()) return;
      let rawChoices = q.choices || q.options || [];
      if (!Array.isArray(rawChoices) && typeof rawChoices === "object" && rawChoices !== null) {
        const converted = [];
        Object.entries(rawChoices).forEach(([k, v]) => {
          if (typeof v === "boolean") converted.push({ text: k, correct: v });
          else converted.push({ text: String(v) });
        });
        rawChoices = converted;
      }
      if (!Array.isArray(rawChoices) || rawChoices.length < 2) return;
      const rawAnswer = q.answer !== void 0 ? q.answer : q.correct;
      const parsedChoices = [];
      const correctIndices = /* @__PURE__ */ new Set();
      const intermediateChoices = rawChoices.map((c) => {
        let text = "";
        let isInlineCorrect = false;
        if (typeof c === "string") {
          text = c.trim();
        } else if (typeof c === "number" || typeof c === "boolean") {
          text = String(c);
        } else if (typeof c === "object" && c !== null) {
          const rawVal = c.text !== void 0 ? c.text : c.choice !== void 0 ? c.choice : "";
          text = String(rawVal).trim();
          if (c.correct !== void 0) isInlineCorrect = Boolean(c.correct);
          if (c.isCorrect !== void 0) isInlineCorrect = Boolean(c.isCorrect);
        } else if (c !== void 0 && c !== null) {
          text = String(c).trim();
        }
        const taskMatch = text.match(/^\[([ xX])\]\s*(.*)$/);
        if (taskMatch) {
          if (taskMatch[1].toLowerCase() === "x") isInlineCorrect = true;
          text = taskMatch[2].trim();
        } else if (/^\*\s+/.test(text) || /^\*(?!\*)[^\s]/.test(text)) {
          isInlineCorrect = true;
          text = text.replace(/^\*\s*/, "").trim();
        } else if (/^\+\s+/.test(text)) {
          isInlineCorrect = true;
          text = text.replace(/^\+\s*/, "").trim();
        }
        const suffixMatch = text.match(/^(.*?)\s*[\(\[]correct[\)\]]$/i);
        if (suffixMatch) {
          isInlineCorrect = true;
          text = suffixMatch[1].trim();
        }
        return { text, isInlineCorrect };
      });
      intermediateChoices.forEach((c, idx) => {
        if (c.isInlineCorrect) {
          correctIndices.add(idx);
        }
      });
      const resolveToken = (val) => {
        if (val === void 0 || val === null) return;
        const trimmed = String(val).trim();
        if (!trimmed) return;
        if (typeof val === "string" && trimmed.includes(",")) {
          trimmed.split(",").forEach((sub) => resolveToken(sub.trim()));
          return;
        }
        const letterMatch = trimmed.match(/^([A-Ha-h])\.?$/);
        if (letterMatch) {
          const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
          if (idx >= 0 && idx < intermediateChoices.length) {
            correctIndices.add(idx);
            return;
          }
        }
        const numVal = typeof val === "number" ? val : parseInt(trimmed, 10);
        if (!isNaN(numVal) && (typeof val === "number" || String(numVal) === trimmed)) {
          const targetIndex = this.settings.oneBasedIndexing ? numVal - 1 : numVal;
          if (targetIndex >= 0 && targetIndex < intermediateChoices.length) {
            correctIndices.add(targetIndex);
          }
        }
      };
      if (Array.isArray(rawAnswer)) {
        rawAnswer.forEach((ans) => resolveToken(ans));
      } else if (rawAnswer !== void 0 && rawAnswer !== null) {
        resolveToken(rawAnswer);
      }
      intermediateChoices.forEach((c, cIndex) => {
        parsedChoices.push({
          id: `q${qIndex}_opt${cIndex}`,
          text: c.text,
          prefix: prefixes[cIndex % prefixes.length],
          isCorrect: correctIndices.has(cIndex)
        });
      });
      const correctCount = parsedChoices.filter((c) => c.isCorrect).length;
      const declaredType = q.type ? q.type.toLowerCase() : "";
      const isMulti = declaredType === "multi" || declaredType === "multiple" || correctCount > 1;
      parsedQuestions.push({
        id: `q_${qIndex}`,
        question: questionText.trim(),
        type: isMulti ? "multi" : "single",
        hint: q.hint ? q.hint.trim() : void 0,
        explanation: q.explanation ? q.explanation.trim() : void 0,
        choices: parsedChoices
      });
    });
    return {
      title: raw.title || "Interactive Quiz",
      shuffle: raw.shuffle === true,
      questions: parsedQuestions
    };
  }
  renderError(container, title, detail) {
    const errorBox = container.createDiv("qblock-error");
    errorBox.createDiv({ text: title, cls: "qblock-error-title" });
    if (detail) {
      errorBox.createDiv({ text: detail, cls: "qblock-error-detail" });
    }
  }
};
var QuizRenderer = class {
  constructor(container, quiz, settings, app, sourcePath, plugin) {
    this.currentIndex = 0;
    this.viewMode = "quiz";
    this.isHintOpen = false;
    // Question index -> Array of chosen choice indices
    this.responses = /* @__PURE__ */ new Map();
    // Question indices that have been submitted/evaluated
    this.submittedQuestions = /* @__PURE__ */ new Set();
    this.container = container;
    this.quiz = quiz;
    this.settings = settings;
    this.app = app;
    this.sourcePath = sourcePath;
    this.plugin = plugin;
    const shouldShuffle = quiz.shuffle || settings.shuffleByDefault;
    this.questions = shouldShuffle ? this.shuffleArray([...quiz.questions]) : [...quiz.questions];
  }
  async renderMarkdown(markdown, el) {
    try {
      await import_obsidian.MarkdownRenderer.render(this.app, markdown, el, this.sourcePath, this.plugin);
    } catch {
      el.setText(markdown);
    }
    this.enhanceCodeBlocks(el);
  }
  enhanceCodeBlocks(container) {
    const LANG_MAP = {
      python: "Python",
      py: "Python",
      javascript: "JavaScript",
      js: "JavaScript",
      typescript: "TypeScript",
      ts: "TypeScript",
      java: "Java",
      cpp: "C++",
      c: "C",
      csharp: "C#",
      cs: "C#",
      html: "HTML",
      css: "CSS",
      json: "JSON",
      yaml: "YAML",
      yml: "YAML",
      sql: "SQL",
      bash: "Bash",
      sh: "Shell",
      rust: "Rust",
      rs: "Rust",
      go: "Go",
      kotlin: "Kotlin",
      kt: "Kotlin",
      ruby: "Ruby",
      rb: "Ruby",
      php: "PHP",
      swift: "Swift",
      dart: "Dart",
      lua: "Lua",
      r: "R"
    };
    const preEls = container.querySelectorAll("pre");
    preEls.forEach((pre) => {
      container.querySelectorAll(".code-block-flair").forEach((b) => b.remove());
      pre.querySelectorAll(".code-block-flair, .copy-code-button, .qblock-lang-pill-wrap, .qblock-icon-copy-btn").forEach((b) => b.remove());
      const codeEl = pre.querySelector("code");
      let lang = "";
      const classList = (codeEl?.className || pre.className || "").split(/\s+/);
      for (const cls of classList) {
        if (cls.startsWith("language-")) {
          const extracted = cls.replace("language-", "").trim().toLowerCase();
          if (extracted && extracted !== "none" && extracted !== "text" && extracted !== "undefined") {
            lang = extracted;
            break;
          }
        }
      }
      const doubleSquareSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
      const checkIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      if (lang) {
        const displayName = LANG_MAP[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
        const wrap = document.createElement("div");
        wrap.className = "qblock-lang-pill-wrap";
        const pill = document.createElement("div");
        pill.className = "qblock-lang-pill";
        pill.innerHTML = `<span class="qblock-lang-name">${displayName}</span><div class="qblock-copy-popup"><div class="qblock-popup-arrow"></div><div class="qblock-popup-bubble">Copy</div></div>`;
        const bubble = pill.querySelector(".qblock-popup-bubble");
        pill.onclick = async (e) => {
          e.stopPropagation();
          e.preventDefault();
          const codeText = codeEl ? codeEl.innerText : pre.innerText;
          try {
            await navigator.clipboard.writeText(codeText.trimEnd());
            if (bubble) bubble.textContent = "Copied!";
            setTimeout(() => {
              if (bubble) bubble.textContent = "Copy";
            }, 1500);
          } catch (err) {
            console.error("Failed to copy code to clipboard", err);
          }
        };
        wrap.appendChild(pill);
        pre.appendChild(wrap);
      } else {
        const btn = document.createElement("button");
        btn.className = "qblock-icon-copy-btn";
        btn.setAttribute("type", "button");
        btn.setAttribute("aria-label", "Copy code");
        btn.title = "Copy code";
        btn.innerHTML = doubleSquareSvg;
        btn.onclick = async (e) => {
          e.stopPropagation();
          e.preventDefault();
          const codeText = codeEl ? codeEl.innerText : pre.innerText;
          try {
            await navigator.clipboard.writeText(codeText.trimEnd());
            btn.classList.add("is-copied");
            btn.innerHTML = checkIcon;
            setTimeout(() => {
              btn.classList.remove("is-copied");
              btn.innerHTML = doubleSquareSvg;
            }, 1500);
          } catch (err) {
            console.error("Failed to copy code to clipboard", err);
          }
        };
        pre.appendChild(btn);
      }
    });
  }
  shuffleArray(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  get isCurrentSubmitted() {
    return this.submittedQuestions.has(this.currentIndex);
  }
  get currentResponses() {
    return this.responses.get(this.currentIndex) || [];
  }
  get score() {
    let correct = 0;
    this.questions.forEach((q, idx) => {
      const userAnswers = this.responses.get(idx) || [];
      const correctIndices = q.choices.map((c, i) => c.isCorrect ? i : -1).filter((i) => i !== -1);
      if (userAnswers.length === correctIndices.length && userAnswers.every((val) => correctIndices.includes(val))) {
        correct++;
      }
    });
    return correct;
  }
  render() {
    this.container.empty();
    this.renderHeader();
    if (this.viewMode === "score") {
      this.renderScoreView();
    } else {
      this.renderQuestionView();
    }
  }
  renderHeader() {
    const header = this.container.createDiv("qblock-header");
    header.createDiv({ text: this.quiz.title, cls: "qblock-title" });
  }
  renderQuestionView() {
    const q = this.questions[this.currentIndex];
    if (!q) return;
    const wrap = this.container.createDiv("qblock-question-wrap");
    const topBar = wrap.createDiv("qblock-question-top");
    topBar.createSpan({
      text: `${this.currentIndex + 1} / ${this.questions.length}`,
      cls: "qblock-counter"
    });
    const questionEl = wrap.createDiv("qblock-question-text");
    this.renderMarkdown(q.question, questionEl);
    const optionsList = wrap.createDiv("qblock-options");
    q.choices.forEach((choice, choiceIdx) => {
      this.renderOptionItem(optionsList, q, choice, choiceIdx);
    });
    this.renderControls(wrap, q);
    const belowControls = wrap.createDiv("qblock-below-controls");
    if (q.hint && this.isHintOpen) {
      const hintCard = belowControls.createDiv("qblock-hint-card");
      const icon = hintCard.createDiv("qblock-card-icon");
      icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`;
      const hintText = hintCard.createDiv("qblock-card-text");
      this.renderMarkdown(q.hint, hintText);
    }
    if (this.isCurrentSubmitted && q.explanation) {
      const expCard = belowControls.createDiv("qblock-explanation-card");
      const icon = expCard.createDiv("qblock-card-icon");
      icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;
      const expText = expCard.createDiv("qblock-card-text");
      this.renderMarkdown(q.explanation, expText);
    }
  }
  renderOptionItem(container, q, choice, choiceIdx) {
    const isSubmitted = this.isCurrentSubmitted;
    const isChosen = this.currentResponses.includes(choiceIdx);
    const hasCode = choice.text.includes("```");
    let optionCls = "qblock-option";
    if (hasCode) {
      optionCls += " has-code";
    }
    if (isChosen && !isSubmitted) {
      optionCls += " is-selected";
    }
    if (isSubmitted) {
      if (choice.isCorrect) optionCls += " is-correct";
      else if (isChosen) optionCls += " is-incorrect";
    }
    const item = container.createDiv(optionCls);
    item.onclick = (e) => {
      const target = e.target;
      if (target && (target.closest(".copy-code-button") || target.closest(".qblock-lang-pill-wrap") || target.closest(".qblock-icon-copy-btn") || target.closest("button") || target.closest(".code-block-flair"))) {
        return;
      }
      this.handleOptionClick(q, choiceIdx);
    };
    const row = item.createDiv("qblock-option-row");
    if (isSubmitted) {
      const statusIcon = row.createDiv(`qblock-status-icon ${choice.isCorrect ? "is-correct" : "is-incorrect"}`);
      if (choice.isCorrect) {
        statusIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
      } else if (isChosen) {
        statusIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
      } else {
        row.createSpan({ text: choice.prefix, cls: "qblock-option-prefix" });
      }
    } else if (q.type === "multi") {
      const checkbox = row.createDiv("qblock-checkbox");
      if (isChosen) {
        checkbox.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
      }
    } else {
      row.createSpan({ text: choice.prefix, cls: "qblock-option-prefix" });
    }
    const textEl = row.createDiv("qblock-option-text");
    this.renderMarkdown(choice.text, textEl);
    if (isSubmitted && isChosen) {
      row.createSpan({ text: "\xB7 Your answer", cls: "qblock-user-answer-badge" });
    }
  }
  handleOptionClick(q, choiceIdx) {
    if (this.isCurrentSubmitted) return;
    if (q.type === "multi") {
      const current = [...this.currentResponses];
      const idx = current.indexOf(choiceIdx);
      if (idx > -1) current.splice(idx, 1);
      else current.push(choiceIdx);
      this.responses.set(this.currentIndex, current.sort((a, b) => a - b));
      this.render();
    } else {
      this.responses.set(this.currentIndex, [choiceIdx]);
      if (this.settings.instantFeedback) {
        this.submittedQuestions.add(this.currentIndex);
      }
      this.render();
    }
  }
  renderControls(container, q) {
    const controls = container.createDiv("qblock-controls");
    const left = controls.createDiv("qblock-controls-left");
    const right = controls.createDiv("qblock-controls-right");
    if (q.hint) {
      const hintBtn = left.createEl("button", { cls: "qblock-hint-btn" });
      hintBtn.innerHTML = `<span>Hint</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transform:${this.isHintOpen ? "rotate(180deg)" : "rotate(0)"};transition:transform 0.2s"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>`;
      hintBtn.onclick = () => {
        this.isHintOpen = !this.isHintOpen;
        this.render();
      };
    }
    const prevBtn = right.createEl("button", { text: "Previous", cls: "qblock-btn" });
    prevBtn.disabled = this.currentIndex === 0;
    prevBtn.onclick = () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.isHintOpen = false;
        this.render();
      }
    };
    const isLast = this.currentIndex === this.questions.length - 1;
    const hasSelection = this.currentResponses.length > 0;
    const shouldSubmitFirst = !this.isCurrentSubmitted && (q.type === "multi" || !this.settings.instantFeedback);
    const isSubmitMode = shouldSubmitFirst && hasSelection;
    let primaryText = isLast ? "Finish & See Score" : "Next";
    if (isSubmitMode) {
      primaryText = "Submit";
    }
    const primaryBtn = right.createEl("button", {
      text: primaryText,
      cls: "qblock-btn mod-cta"
    });
    primaryBtn.onclick = () => {
      if (isSubmitMode) {
        this.submittedQuestions.add(this.currentIndex);
        this.render();
      } else if (isLast) {
        this.viewMode = "score";
        this.render();
      } else {
        this.currentIndex++;
        this.isHintOpen = false;
        this.render();
      }
    };
  }
  renderScoreView() {
    const wrap = this.container.createDiv("qblock-summary-view");
    const total = this.questions.length;
    const correctCount = this.score;
    const percent = Math.round(correctCount / total * 100);
    const missedQuestions = [];
    let answeredCount = 0;
    this.questions.forEach((q, idx) => {
      const userAnswers = this.responses.get(idx) || [];
      if (userAnswers.length > 0) answeredCount++;
      const correctIndices = q.choices.map((c, i) => c.isCorrect ? i : -1).filter((i) => i !== -1);
      const isRight = userAnswers.length === correctIndices.length && userAnswers.every((val) => correctIndices.includes(val));
      if (!isRight) {
        missedQuestions.push({ question: q, index: idx });
      }
    });
    const missedCount = missedQuestions.length;
    const skippedCount = total - answeredCount;
    const scoreCard = wrap.createDiv("qblock-score-card");
    const scoreHeader = scoreCard.createDiv("qblock-score-header");
    const scoreInfo = scoreHeader.createDiv();
    scoreInfo.createDiv({ text: "Your score", cls: "qblock-score-label" });
    const digits = scoreInfo.createDiv("qblock-score-digits");
    digits.createSpan({ text: `${correctCount}/${total}`, cls: "qblock-score-big" });
    digits.createSpan({ text: `(${percent}%)`, cls: "qblock-score-percent" });
    if (missedCount > 0) {
      const reviewBtn = scoreHeader.createEl("button", { text: "Review", cls: "qblock-btn" });
      reviewBtn.onclick = () => {
        this.currentIndex = missedQuestions[0].index;
        this.viewMode = "quiz";
        this.render();
      };
    }
    const progressBar = scoreCard.createDiv("qblock-segmented-bar");
    const gotWidth = total > 0 ? correctCount / total * 100 : 0;
    const missedWidth = total > 0 ? (answeredCount - correctCount) / total * 100 : 0;
    const gotSegment = progressBar.createDiv("qblock-progress-got");
    gotSegment.style.width = `${gotWidth}%`;
    const missedSegment = progressBar.createDiv("qblock-progress-missed");
    missedSegment.style.width = `${missedWidth}%`;
    progressBar.createDiv("qblock-progress-skipped");
    const legend = scoreCard.createDiv("qblock-legend");
    const gotItem = legend.createDiv("qblock-legend-item");
    const gotDot = gotItem.createSpan("qblock-legend-dot");
    gotDot.style.background = "var(--qb-accent)";
    gotItem.createSpan({ text: `Got it (${correctCount})` });
    const missedItem = legend.createDiv("qblock-legend-item");
    const missedDot = missedItem.createSpan("qblock-legend-dot");
    missedDot.style.background = "color-mix(in srgb, var(--qb-accent) 40%, var(--background-modifier-border))";
    missedItem.createSpan({ text: `Missed it (${answeredCount - correctCount})` });
    const skippedItem = legend.createDiv("qblock-legend-item");
    const skippedDot = skippedItem.createSpan("qblock-legend-dot");
    skippedDot.style.background = "var(--background-modifier-border)";
    skippedItem.createSpan({ text: `Skipped (${skippedCount})` });
    if (missedQuestions.length > 0) {
      const missedSection = scoreCard.createDiv("qblock-missed-section");
      missedSection.createDiv({ text: `Missed it (${missedQuestions.length})`, cls: "qblock-missed-title" });
      missedQuestions.forEach(({ question, index }) => {
        const item = missedSection.createDiv("qblock-missed-item");
        item.onclick = () => {
          this.currentIndex = index;
          this.viewMode = "quiz";
          this.render();
        };
        item.createSpan({ text: `${index + 1}.`, cls: "qblock-missed-num" });
        const textSpan = item.createSpan("qblock-missed-text");
        this.renderMarkdown(question.question, textSpan);
      });
    }
    const action1 = wrap.createDiv("qblock-action-card");
    action1.createSpan({ text: "Try it again", cls: "qblock-action-label" });
    const retakeBtn = action1.createEl("button", { cls: "qblock-btn" });
    retakeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg><span>Retake quiz</span>`;
    retakeBtn.onclick = () => {
      this.responses.clear();
      this.submittedQuestions.clear();
      this.currentIndex = 0;
      this.viewMode = "quiz";
      this.render();
    };
    const action2 = wrap.createDiv("qblock-action-card");
    action2.createSpan({ text: "Shuffle questions and retry", cls: "qblock-action-label" });
    const shuffleBtn = action2.createEl("button", { cls: "qblock-btn" });
    shuffleBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4h4l4 6 4-6h4M4 20h4l4-6 4 6h4M17 4l4 4-4 4M17 16l4 4-4 4"/></svg><span>Shuffle & retake</span>`;
    shuffleBtn.onclick = () => {
      this.responses.clear();
      this.submittedQuestions.clear();
      this.questions = this.shuffleArray([...this.quiz.questions]);
      this.currentIndex = 0;
      this.viewMode = "quiz";
      this.render();
    };
  }
};
var QuizBlockSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Quiz Block Settings" });
    new import_obsidian.Setting(containerEl).setName("Shuffle questions by default").setDesc("Automatically randomize question order whenever a quiz block is opened.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.shuffleByDefault).onChange(async (val) => {
        this.plugin.settings.shuffleByDefault = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Instant feedback").setDesc("Immediately evaluate single-choice questions upon clicking an option.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.instantFeedback).onChange(async (val) => {
        this.plugin.settings.instantFeedback = val;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("1-based indexing for numerical answers").setDesc("When enabled, numerical answers start at 1 (1 = Option A, 2 = Option B, etc.). When disabled (default), numerical answers start at 0 (0 = Option A, 1 = Option B, etc.), matching Python and JavaScript.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.oneBasedIndexing).onChange(async (val) => {
        this.plugin.settings.oneBasedIndexing = val;
        await this.plugin.saveSettings();
      })
    );
  }
};
var SAMPLE_QUIZ_TEMPLATE = `\`\`\`qblock
{
  'title': 'Python & Programming Mastery',
  'questions': [
    {
      'question': """What is the output of the following Python code?
\`\`\`python
def append_item(val, items=[]):
    items.append(val)
    return items

print(append_item(1))
print(append_item(2))
\`\`\`""",
      'hint': "Default argument expressions in Python are evaluated once when the function is defined.",
      'choices': [
        "\`[1]\` then \`[2]\`",
        "\`[1]\` then \`[1, 2]\`",
        "\`[1, 1]\` then \`[2, 2]\`",
        "Raises TypeError"
      ],
      'answer': 'B',
      'explanation': """Default list parameter \`[]\` is mutable and retained across calls:
\`\`\`python
# Call 1: items is [1]
# Call 2: items is [1, 2]
\`\`\`"""
    },
    {
      'question': "Which of the following methods return a new list without modifying the original list?",
      'choices': [
        "\`sorted(my_list)\`",
        "\`my_list.sort()\`",
        "\`my_list.copy()\`",
        "\`my_list.reverse()\`"
      ],
      'answer': ['A', 'C'], # Multi-select question
      'explanation': "\`sorted()\` and \`.copy()\` return new lists, while \`.sort()\` and \`.reverse()\` modify the list in place."
    }
  ]
}
\`\`\`
`;
