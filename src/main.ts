import { App, MarkdownPostProcessorContext, Plugin, PluginSettingTab, Setting, TFile, parseYaml } from "obsidian";

interface QuizSettings {
  shuffleByDefault: boolean;
  instantFeedback: boolean;
}

const DEFAULT_SETTINGS: QuizSettings = {
  shuffleByDefault: false,
  instantFeedback: true
};

interface RawChoice {
  text?: string | number | boolean;
  choice?: string | number | boolean;
  correct?: boolean;
  isCorrect?: boolean;
}

interface RawQuestion {
  question?: string;
  title?: string;
  type?: string;
  hint?: string;
  explanation?: string;
  choices?: (string | number | boolean | RawChoice)[];
  options?: (string | number | boolean | RawChoice)[];
  answer?: number | string | (number | string)[];
  correct?: number | string | (number | string)[];
}

interface RawQuiz {
  title?: string;
  shuffle?: boolean;
  file?: string;
  questions?: RawQuestion[];
  quiz?: RawQuestion[] | { questions?: RawQuestion[] };
}

interface QuizChoice {
  id: string;
  text: string;
  prefix: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  id: string;
  question: string;
  type: "single" | "multi";
  hint?: string;
  explanation?: string;
  choices: QuizChoice[];
}

interface ParsedQuiz {
  title: string;
  shuffle: boolean;
  questions: QuizQuestion[];
}

interface TempChoice {
  text: string;
  isInlineCorrect: boolean;
}

export default class QuizBlockPlugin extends Plugin {
  settings: QuizSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    // Register Markdown Code Block Processor for ```qblock
    this.registerMarkdownCodeBlockProcessor("qblock", (source, el, ctx) => {
      this.renderQuizBlock(source, el, ctx);
    });

    // Also register ```quizblock alias for convenience
    this.registerMarkdownCodeBlockProcessor("quizblock", (source, el, ctx) => {
      this.renderQuizBlock(source, el, ctx);
    });

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

  async renderQuizBlock(sourceText: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    el.empty();
    const container = el.createDiv("qblock-container");

    let rawData: RawQuiz | null = null;
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

    // Handle external quiz file reference: file: "path/to/quiz.yaml" or file: "[[Note]]"
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

    const renderer = new QuizRenderer(container, parsed, this.settings);
    renderer.render();
  }

  parseSource(sourceText: string): RawQuiz {
    try {
      return parseYaml(sourceText) as RawQuiz;
    } catch (yamlErr) {
      // Fallback: Support Python dictionary and relaxed JSON/JS object syntax
      const cleaned = sourceText
        .replace(/:\s*True\b/g, ": true")
        .replace(/:\s*False\b/g, ": false")
        .replace(/:\s*None\b/g, ": null");
      const fn = new Function('"use strict"; return (' + cleaned + ');');
      const evaluated = fn();
      if (evaluated && typeof evaluated === "object") {
        return evaluated as RawQuiz;
      }
      throw yamlErr;
    }
  }

  resolveVaultFile(filePath: string, sourcePath: string): TFile | null {
    const clean = filePath.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
    const file = this.app.metadataCache.getFirstLinkpathDest(clean, sourcePath);
    if (file) return file;
    const direct = this.app.vault.getAbstractFileByPath(clean);
    return direct instanceof TFile ? direct : null;
  }

  parseQuizData(raw: RawQuiz): ParsedQuiz {
    let questionsRaw: RawQuestion[] = [];
    if (Array.isArray(raw)) {
      questionsRaw = raw as RawQuestion[];
    } else if (Array.isArray(raw.questions)) {
      questionsRaw = raw.questions;
    } else if (raw.quiz) {
      if (Array.isArray(raw.quiz)) questionsRaw = raw.quiz;
      else if (Array.isArray(raw.quiz.questions)) questionsRaw = raw.quiz.questions;
    }

    const prefixes = ["A.", "B.", "C.", "D.", "E.", "F.", "G.", "H."];
    const parsedQuestions: QuizQuestion[] = [];

    questionsRaw.forEach((q, qIndex) => {
      const questionText = q.question || q.title || "";
      if (!questionText.trim()) return;

      let rawChoices = q.choices || q.options || [];
      // Support object format like { "Jupiter": false, "Saturn": true }
      if (!Array.isArray(rawChoices) && typeof rawChoices === "object" && rawChoices !== null) {
        const converted: any[] = [];
        Object.entries(rawChoices).forEach(([k, v]) => {
          if (typeof v === "boolean") converted.push({ text: k, correct: v });
          else converted.push({ text: String(v) });
        });
        rawChoices = converted;
      }

      if (!Array.isArray(rawChoices) || rawChoices.length < 2) return;

      const rawAnswer = q.answer !== undefined ? q.answer : q.correct;
      const parsedChoices: QuizChoice[] = [];
      const correctIndices: Set<number> = new Set();

      // 1. Extract choice texts and check inline markers (*, [x], (correct))
      const intermediateChoices: TempChoice[] = rawChoices.map((c) => {
        let text = "";
        let isInlineCorrect = false;

        if (typeof c === "string") {
          text = c.trim();
        } else if (typeof c === "number" || typeof c === "boolean") {
          text = String(c);
        } else if (typeof c === "object" && c !== null) {
          const rawVal = c.text !== undefined ? c.text : (c.choice !== undefined ? c.choice : "");
          text = String(rawVal).trim();
          if (c.correct !== undefined) isInlineCorrect = Boolean(c.correct);
          if (c.isCorrect !== undefined) isInlineCorrect = Boolean(c.isCorrect);
        } else if (c !== undefined && c !== null) {
          text = String(c).trim();
        }

        // Check Obsidian markdown task-list format: [x] or [X]
        const taskMatch = text.match(/^\[([ xX])\]\s*(.*)$/);
        if (taskMatch) {
          if (taskMatch[1].toLowerCase() === "x") isInlineCorrect = true;
          text = taskMatch[2].trim();
        }
        // Check inline asterisk: "* Saturn" or "*Saturn" (excluding markdown bold "**")
        else if (/^\*\s+/.test(text) || /^\*(?!\*)[^\s]/.test(text)) {
          isInlineCorrect = true;
          text = text.replace(/^\*\s*/, "").trim();
        }
        // Check inline plus: "+ Saturn"
        else if (/^\+\s+/.test(text)) {
          isInlineCorrect = true;
          text = text.replace(/^\+\s*/, "").trim();
        }

        // Check suffix "(correct)" or "[correct]"
        const suffixMatch = text.match(/^(.*?)\s*[\(\[]correct[\)\]]$/i);
        if (suffixMatch) {
          isInlineCorrect = true;
          text = suffixMatch[1].trim();
        }

        return { text, isInlineCorrect };
      });

      // Register any inline-marked correct answers
      intermediateChoices.forEach((c, idx) => {
        if (c.isInlineCorrect) {
          correctIndices.add(idx);
        }
      });

      // 2. Parse top-level `answer` or `correct` if provided
      const resolveToken = (val: any) => {
        if (val === undefined || val === null) return;

        const trimmed = String(val).trim();
        if (!trimmed) return;

        // Comma-separated list of answers like "A, B" or "Saturn, Jupiter"
        if (typeof val === "string" && trimmed.includes(",")) {
          trimmed.split(",").forEach((sub) => resolveToken(sub.trim()));
          return;
        }

        // 1. Direct text match with a choice (case-insensitive)
        const matchedIdx = intermediateChoices.findIndex(
          (c) => c.text.toLowerCase() === trimmed.toLowerCase()
        );
        if (matchedIdx !== -1) {
          correctIndices.add(matchedIdx);
          return;
        }

        // 2. Check if it's a letter (A, B, C, D, etc.)
        const letterMatch = trimmed.match(/^([A-Ha-h])\.?$/);
        if (letterMatch) {
          const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65; // A -> 0, B -> 1
          if (idx >= 0 && idx < intermediateChoices.length) {
            correctIndices.add(idx);
            return;
          }
        }

        // 3. Check if numeric value or numeric string (1, 2, "1", "2")
        const numVal = typeof val === "number" ? val : parseInt(trimmed, 10);
        if (!isNaN(numVal) && (typeof val === "number" || String(numVal) === trimmed)) {
          if (numVal === 0) {
            correctIndices.add(0);
          } else if (numVal >= 1 && numVal <= intermediateChoices.length) {
            correctIndices.add(numVal - 1);
          }
        }
      };

      if (Array.isArray(rawAnswer)) {
        rawAnswer.forEach((ans) => resolveToken(ans));
      } else if (rawAnswer !== undefined && rawAnswer !== null) {
        resolveToken(rawAnswer);
      }

      // Build parsed choices
      intermediateChoices.forEach((c, cIndex) => {
        parsedChoices.push({
          id: `q${qIndex}_opt${cIndex}`,
          text: c.text,
          prefix: prefixes[cIndex % prefixes.length],
          isCorrect: correctIndices.has(cIndex)
        });
      });

      // Infer question type: if more than 1 choice is marked correct, default to multi-select
      const correctCount = parsedChoices.filter((c) => c.isCorrect).length;
      const declaredType = q.type ? q.type.toLowerCase() : "";
      const isMulti = declaredType === "multi" || declaredType === "multiple" || correctCount > 1;

      parsedQuestions.push({
        id: `q_${qIndex}`,
        question: questionText.trim(),
        type: isMulti ? "multi" : "single",
        hint: q.hint ? q.hint.trim() : undefined,
        explanation: q.explanation ? q.explanation.trim() : undefined,
        choices: parsedChoices
      });
    });

    return {
      title: raw.title || "Interactive Quiz",
      shuffle: raw.shuffle === true,
      questions: parsedQuestions
    };
  }

  renderError(container: HTMLElement, title: string, detail?: string) {
    const errorBox = container.createDiv("qblock-error");
    errorBox.createDiv({ text: title, cls: "qblock-error-title" });
    if (detail) {
      errorBox.createDiv({ text: detail, cls: "qblock-error-detail" });
    }
  }
}

class QuizRenderer {
  container: HTMLElement;
  quiz: ParsedQuiz;
  settings: QuizSettings;

  questions: QuizQuestion[];
  currentIndex = 0;
  viewMode: "quiz" | "score" = "quiz";
  isHintOpen = false;

  // Question index -> Array of chosen choice indices
  responses: Map<number, number[]> = new Map();
  // Question indices that have been submitted/evaluated
  submittedQuestions: Set<number> = new Set();

  constructor(container: HTMLElement, quiz: ParsedQuiz, settings: QuizSettings) {
    this.container = container;
    this.quiz = quiz;
    this.settings = settings;
    const shouldShuffle = quiz.shuffle || settings.shuffleByDefault;
    this.questions = shouldShuffle ? this.shuffleArray([...quiz.questions]) : [...quiz.questions];
  }

  shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  get isCurrentSubmitted(): boolean {
    return this.submittedQuestions.has(this.currentIndex);
  }

  get currentResponses(): number[] {
    return this.responses.get(this.currentIndex) || [];
  }

  get score(): number {
    let correct = 0;
    this.questions.forEach((q, idx) => {
      const userAnswers = this.responses.get(idx) || [];
      const correctIndices = q.choices.map((c, i) => (c.isCorrect ? i : -1)).filter((i) => i !== -1);
      if (userAnswers.length === correctIndices.length && userAnswers.every((val) => correctIndices.includes(val))) {
        correct++;
      }
    });
    return correct;
  }

  render() {
    this.container.empty();

    // Render Header: Just Title
    this.renderHeader();

    if (this.viewMode === "score") {
      this.renderScoreView();
    } else {
      this.renderQuestionView();
    }
  }

  renderHeader() {
    const header = this.container.createDiv("qblock-header");
    header.createEl("h3", { text: this.quiz.title, cls: "qblock-title" });
  }

  renderQuestionView() {
    const q = this.questions[this.currentIndex];
    if (!q) return;

    const wrap = this.container.createDiv("qblock-question-wrap");

    // Top info: Counter (e.g. 4 / 12)
    const topBar = wrap.createDiv("qblock-question-top");
    topBar.createSpan({
      text: `${this.currentIndex + 1} / ${this.questions.length}`,
      cls: "qblock-counter"
    });

    // Question title
    wrap.createEl("div", { text: q.question, cls: "qblock-question-text" });

    // Options List (clean options without top feedback banner)
    const optionsList = wrap.createDiv("qblock-options");
    q.choices.forEach((choice, choiceIdx) => {
      this.renderOptionItem(optionsList, q, choice, choiceIdx);
    });

    // Controls Bar (Buttons)
    this.renderControls(wrap, q);

    // Below the buttons: Hint & Single Question Explanation
    const belowControls = wrap.createDiv("qblock-below-controls");

    // Hint Card (opens below buttons when toggled)
    if (q.hint && this.isHintOpen) {
      const hintCard = belowControls.createDiv("qblock-hint-card");
      const icon = hintCard.createDiv("qblock-card-icon");
      icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>`;
      hintCard.createDiv({ text: q.hint, cls: "qblock-card-text" });
    }

    // Single Question Explanation Card (shows below buttons when answered)
    if (this.isCurrentSubmitted && q.explanation) {
      const expCard = belowControls.createDiv("qblock-explanation-card");
      const icon = expCard.createDiv("qblock-card-icon");
      icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;
      expCard.createDiv({ text: q.explanation, cls: "qblock-card-text" });
    }
  }

  renderOptionItem(container: HTMLElement, q: QuizQuestion, choice: QuizChoice, choiceIdx: number) {
    const isSubmitted = this.isCurrentSubmitted;
    const isChosen = this.currentResponses.includes(choiceIdx);

    let optionCls = "qblock-option";
    if (isChosen && !isSubmitted) {
      optionCls += " is-selected";
    }
    if (isSubmitted) {
      if (choice.isCorrect) optionCls += " is-correct";
      else if (isChosen) optionCls += " is-incorrect";
    }

    const item = container.createDiv(optionCls);
    item.onclick = () => {
      this.handleOptionClick(q, choiceIdx);
    };

    const row = item.createDiv("qblock-option-row");

    if (isSubmitted) {
      // Status icon (green check or red cross)
      const statusIcon = row.createDiv(`qblock-status-icon ${choice.isCorrect ? "is-correct" : "is-incorrect"}`);
      if (choice.isCorrect) {
        statusIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
      } else if (isChosen) {
        statusIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
      } else {
        row.createSpan({ text: choice.prefix, cls: "qblock-option-prefix" });
      }
    } else if (q.type === "multi") {
      // Checkbox for multi-select
      const checkbox = row.createDiv("qblock-checkbox");
      if (isChosen) {
        checkbox.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
      }
    } else {
      // Prefix A., B., C. for single select
      row.createSpan({ text: choice.prefix, cls: "qblock-option-prefix" });
    }

    // Option text
    row.createSpan({ text: choice.text, cls: "qblock-option-text" });

    // 'Your answer' indicator badge
    if (isSubmitted && isChosen) {
      row.createSpan({ text: "· Your answer", cls: "qblock-user-answer-badge" });
    }
  }

  handleOptionClick(q: QuizQuestion, choiceIdx: number) {
    if (this.isCurrentSubmitted) return;

    if (q.type === "multi") {
      const current = [...this.currentResponses];
      const idx = current.indexOf(choiceIdx);
      if (idx > -1) current.splice(idx, 1);
      else current.push(choiceIdx);
      this.responses.set(this.currentIndex, current.sort((a, b) => a - b));
      this.render();
    } else {
      // Single choice
      this.responses.set(this.currentIndex, [choiceIdx]);
      if (this.settings.instantFeedback) {
        this.submittedQuestions.add(this.currentIndex);
      }
      this.render();
    }
  }

  renderControls(container: HTMLElement, q: QuizQuestion) {
    const controls = container.createDiv("qblock-controls");
    const left = controls.createDiv("qblock-controls-left");
    const right = controls.createDiv("qblock-controls-right");

    // Hint Button (Borderless, hover effect)
    if (q.hint) {
      const hintBtn = left.createEl("button", { cls: "qblock-hint-btn" });
      hintBtn.innerHTML = `<span>Hint</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transform:${this.isHintOpen ? "rotate(180deg)" : "rotate(0)"};transition:transform 0.2s"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>`;
      hintBtn.onclick = () => {
        this.isHintOpen = !this.isHintOpen;
        this.render();
      };
    }

    // Two navigation buttons on the right: Previous and Primary (Next/Submit)
    // 1. Previous Button: Transparent with thin border
    const prevBtn = right.createEl("button", { text: "Previous", cls: "qblock-btn" });
    prevBtn.disabled = this.currentIndex === 0;
    prevBtn.onclick = () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.isHintOpen = false;
        this.render();
      }
    };

    // 2. Primary Button: Always filled (mod-cta)
    // If multiple choice (or unsubmitted) and user selected an option -> "Submit"
    // Once submitted (or when navigating) -> "Next" (or "Finish & See Score" on last question)
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
    const percent = Math.round((correctCount / total) * 100);

    // Collect missed questions
    const missedQuestions: { question: QuizQuestion; index: number }[] = [];
    let answeredCount = 0;

    this.questions.forEach((q, idx) => {
      const userAnswers = this.responses.get(idx) || [];
      if (userAnswers.length > 0) answeredCount++;
      const correctIndices = q.choices.map((c, i) => (c.isCorrect ? i : -1)).filter((i) => i !== -1);
      const isRight = userAnswers.length === correctIndices.length && userAnswers.every((val) => correctIndices.includes(val));
      if (!isRight) {
        missedQuestions.push({ question: q, index: idx });
      }
    });

    const missedCount = missedQuestions.length;
    const skippedCount = total - answeredCount;

    // Main Score Card
    const scoreCard = wrap.createDiv("qblock-score-card");
    const scoreHeader = scoreCard.createDiv("qblock-score-header");
    const scoreInfo = scoreHeader.createDiv();
    scoreInfo.createDiv({ text: "Your score", cls: "qblock-score-label" });

    const digits = scoreInfo.createDiv("qblock-score-digits");
    digits.createSpan({ text: `${correctCount}/${total}`, cls: "qblock-score-big" });
    digits.createSpan({ text: `(${percent}%)`, cls: "qblock-score-percent" });

    // Review Button
    if (missedCount > 0) {
      const reviewBtn = scoreHeader.createEl("button", { text: "Review", cls: "qblock-btn" });
      reviewBtn.onclick = () => {
        this.currentIndex = missedQuestions[0].index;
        this.viewMode = "quiz";
        this.render();
      };
    }

    // Segmented Progress Bar
    const progressBar = scoreCard.createDiv("qblock-segmented-bar");
    const gotWidth = total > 0 ? (correctCount / total) * 100 : 0;
    const missedWidth = total > 0 ? ((answeredCount - correctCount) / total) * 100 : 0;

    const gotSegment = progressBar.createDiv("qblock-progress-got");
    gotSegment.style.width = `${gotWidth}%`;

    const missedSegment = progressBar.createDiv("qblock-progress-missed");
    missedSegment.style.width = `${missedWidth}%`;

    progressBar.createDiv("qblock-progress-skipped");

    // Legend
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

    // Missed Questions List
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
        item.createSpan({ text: question.question });
      });
    }

    // Action Cards: Try it again (Retake quiz)
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

    // Action Card: Shuffle questions and retry
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
}

class QuizBlockSettingTab extends PluginSettingTab {
  plugin: QuizBlockPlugin;

  constructor(app: App, plugin: QuizBlockPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Quiz Block Settings" });

    new Setting(containerEl)
      .setName("Shuffle questions by default")
      .setDesc("Automatically randomize question order whenever a quiz block is opened.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.shuffleByDefault)
          .onChange(async (val) => {
            this.plugin.settings.shuffleByDefault = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Instant feedback")
      .setDesc("Immediately evaluate single-choice questions upon clicking an option.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.instantFeedback)
          .onChange(async (val) => {
            this.plugin.settings.instantFeedback = val;
            await this.plugin.saveSettings();
          })
      );
  }
}

const SAMPLE_QUIZ_TEMPLATE = `\`\`\`qblock
title: "Sample Knowledge Check"
questions:
  - question: "Which planet is famous for its prominent ring system?"
    hint: "It is the sixth planet from the Sun."
    explanation: "Saturn has the most extensive and visible ring system in our Solar System."
    choices:
      - "Jupiter"
      - "Saturn"
      - "Neptune"
      - "Uranus"
    answer: [B]

  - question: "Which of the following colors are primary in additive light mixing (RGB)?"
    hint: "Think of digital display pixels."
    explanation: "Red, Green, and Blue are additive primary colors."
    choices:
      - "Red"
      - "Yellow"
      - "Green"
      - "Black"
    answer: [A, C]
\`\`\`
`;

