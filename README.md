# Quiz Block

A modern, interactive quiz plugin for **[Obsidian](https://obsidian.md)** developed by **[SSKhekhaliya](https://www.sskhekhaliya.in/)** that renders beautiful, interactive quiz cards directly inside your notes using ```` ```qblock ```` code fences.

[![Buy Me a Book](https://img.shields.io/badge/Buy%20Me%20a%20Book-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sskhekhaliya)

---

## ✨ Features

- **🎯 Simple & Clean Syntax**:
  - Write quizzes in clean YAML or JSON inside ```` ```qblock ```` code blocks.
  - Minimal syntax: just `title` and `questions`.
  - Optional single explanation per question displayed right after answering.
- **🎨 Adaptive Theme Aesthetic**:
  - Thin, clean title typography, dynamic native Obsidian accent colors (`var(--interactive-accent)`), rounded card containers, borderless hint button, and smooth transitions designed to automatically match any Obsidian Light or Dark theme.
- **🔘 Single-Choice & Multi-Select Questions**:
  - **Single-choice**: Radio-style selection with option prefixes (`A.`, `B.`, `C.`) and instant evaluation.
  - **Multi-select**: Modern checkboxes with a "Check answer" validation button.
- **💡 Hints & Explanations**:
  - **Hint Drawer**: Borderless hover-activated hint button that opens the hint card below the controls.
  - **Question Explanation**: Clean reasoning card displayed directly below the controls when answered.
- **📊 Comprehensive Score Summary**:
  - Displays final score and percentage (`8/12 (67%)`).
  - Color-coded segmented progress bar (Got it, Missed it, Skipped).
  - **Interactive Missed Questions Review**: Click any missed question in the score summary to jump straight back into that question in review mode.
- **🔄 Retake & Shuffle**:
  - One-click **Retake quiz** or **Shuffle questions and retry** to randomize question order for active recall practice.
- **🗂️ External File Support**:
  - Keep your quizzes organized! Reference external vault files with `file: "Quizzes/Grammar.yaml"` or `file: "[[Grammar]]"`.
- **📱 Cross-Platform**:
  - Works on both Desktop and Mobile Obsidian.

---

## 🚀 Getting Started

Writing quizzes is fast and unified. You don't need to change syntax or write `type: multi`—the format is **identical for both single-choice and multiple-choice questions**:

Simply list your `choices:`, and write `answer: [...]`:
- **1 item in `answer: [B]`** → automatically renders as a **single-choice** question.
- **Multiple items in `answer: [A, B]`** → automatically renders as a **multiple-choice** question.

---

### 1. Single-Choice Quiz Example

Quizzes naturally contain multiple questions. Here is a single-choice quiz with 2 questions:

````markdown
```qblock
title: "Solar System Quiz"
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

  - question: "Which planet is known as the Red Planet?"
    hint: "Named after the Roman god of war."
    explanation: "Mars appears reddish due to iron oxide (rust) covering its surface."
    choices:
      - "Venus"
      - "Mars"
      - "Mercury"
      - "Jupiter"
    answer: [B]
```
````

---

### 2. Multi-Select Quiz Example

When `answer: [...]` contains two or more items, it automatically enables multi-selection with checkboxes:

````markdown
```qblock
title: "Astronomy & Physics"
questions:
  - question: "Which of the following planets are gas giants?"
    explanation: "Jupiter and Saturn are the two gas giants of our Solar System."
    choices:
      - "Jupiter"
      - "Saturn"
      - "Earth"
      - "Mars"
    answer: [A, B]

  - question: "Which of these are terrestrial (rocky) planets?"
    explanation: "Mercury, Venus, Earth, and Mars are the four rocky terrestrial planets."
    choices:
      - "Mercury"
      - "Venus"
      - "Neptune"
      - "Uranus"
    answer: [A, B]
```
````

---

### 3. Mixed Quiz Example (Single & Multi-Select in One Quiz)

You can freely mix single-choice and multiple-choice questions within the same quiz:

````markdown
```qblock
title: "World Knowledge Check"
questions:
  - question: "What is the capital city of France?"
    hint: "Known as the City of Light."
    explanation: "Paris has been the capital of France since 987 AD."
    choices:
      - "London"
      - "Paris"
      - "Berlin"
      - "Madrid"
    answer: [B]   # Single choice

  - question: "Which of the following are official languages of Switzerland?"
    explanation: "Switzerland has four national languages: German, French, Italian, and Romansh."
    choices:
      - "German"
      - "French"
      - "Spanish"
      - "Italian"
    answer: [A, B, D]   # Multiple choice
```
````

---

### 4. Quick Tips & Flexibility

- **Answer by Letter or Text**: You can write letters (`[A]`, `[A, B]`), text (`["Saturn"]`), or numbers (`[1]`).
- **Inline Asterisk `*` (Optional)**: If you prefer, you can also mark correct answers inline directly in the list (e.g., `- "* Saturn"`).
- **No extra typing**: No need to write `text:`, `correct: false`, or `type: multi`. Quiz Block automatically detects single vs multiple choice based on your answers!

---

## ⚡ Commands

- **Insert Quiz Block template**: Press `Ctrl+P` (or `Cmd+P`) and choose `Quiz Block: Insert Quiz Block template` to quickly paste a ready-to-fill sample quiz into your note.

---

## ⚙️ Settings

- **Shuffle questions by default**: Automatically randomizes question order when loading a quiz block.
- **Instant feedback**: Immediately evaluate single-choice questions upon clicking an option.

---

## 🛠️ Development & Installation

### Manual Installation into Obsidian Vault

1. Build the production bundle:
   ```bash
   npm run build
   ```
2. Locate your vault's plugins folder:
   `<vault>/.obsidian/plugins/obsidian-quiz-block/`
3. Copy the following files into that folder:
   - `manifest.json`
   - `main.js`
   - `styles.css`
4. In Obsidian, go to **Settings > Community plugins**, reload, and enable **Quiz Block**.

---

## 📚 Support

If you find **Quiz Block** helpful for your studying and note-taking, consider buying me a book:

[![Buy Me a Book](https://img.shields.io/badge/Buy%20Me%20a%20Book-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sskhekhaliya)

---

## 📄 License & Credits

- **Author**: [SSKhekhaliya](https://www.sskhekhaliya.in/)
- **Support**: [buymeacoffee.com/sskhekhaliya](https://buymeacoffee.com/sskhekhaliya)
- Built for the [Obsidian](https://obsidian.md) community.
