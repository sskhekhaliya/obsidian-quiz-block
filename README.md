# Quiz Block

A modern, interactive quiz plugin for **[Obsidian](https://obsidian.md)** developed by **[SSKhekhaliya](https://www.sskhekhaliya.in/)** that renders beautiful, interactive quiz cards directly inside your notes using ```` ```qblock ```` code fences.

[![Buy Me a Book](https://img.shields.io/badge/Buy%20Me%20a%20Book-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sskhekhaliya)

---

## ✨ Features

- **🎯 Simple & Clean Syntax**:
  - Write quizzes in clean YAML, JSON, or Python dictionary format inside ```` ```qblock ```` code fences.
  - Minimal syntax: just `title`, `questions`, and `answer: [...]`.
  - Zero-indentation headaches: support for bracket-based syntax (`{}` and `[]`) means you never have to worry about spacing errors.
- **🎨 Adaptive Theme Aesthetic**:
  - Thin, clean title typography, dynamic native Obsidian accent colors (`var(--interactive-accent)`), stroke-free options, rounded card containers, borderless hint button, and smooth transitions designed to automatically match any Obsidian Light or Dark theme.
- **🔘 Single-Choice & Multi-Select Questions**:
  - **Single-choice**: Radio-style selection with option prefixes (`A.`, `B.`, `C.`) and instant evaluation.
  - **Multi-select**: Modern checkboxes with a dynamic filled "Submit" button that auto-converts to "Next" upon evaluation.
- **🖋️ Live Editor Syntax Highlighting**:
  - Real-time theme-adaptive syntax coloring while editing `qblock` code in Live Preview or Source mode.
  - Keys (`title`, `questions`, `choices`, `answer`, etc.) are highlighted in your theme's property/accent color.
  - Values (including multi-line triple-quoted strings containing code blocks or markdown) are highlighted in your theme's string/value color.
- **📄 Multi-Line & Code Block Questions**:
  - Full multiline support (`white-space: pre-wrap`) for questions, choices, hints, and explanations—perfect for code snippets, paragraphs, and scenarios.
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
  - Works on both Desktop and Mobile Obsidian (iOS & Android).

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

### 4. Clean Python Dictionary Format (Recommended)

Write quizzes in clean Python dictionary or JSON syntax using `{}` and `[]`. Indentation does not matter, eliminating spacing errors on mobile or desktop keyboards:

````markdown
```qblock
{
  'title': 'Python & Programming Mastery',
  'questions': [
    {
      'question': """What is the output of the following Python code?
```python
def append_item(val, items=[]):
    items.append(val)
    return items

print(append_item(1))
print(append_item(2))
```""",
      'hint': "Default argument expressions in Python are evaluated once when the function is defined.",
      'choices': [
        "`[1]` then `[2]`",
        "`[1]` then `[1, 2]`",
        "`[1, 1]` then `[2, 2]`",
        "Raises TypeError"
      ],
      'answer': 'B',
      'explanation': """Default list parameter `[]` is mutable and retained across calls:
```python
# Call 1: items is [1]
# Call 2: items is [1, 2]
```"""
    },
    {
      'question': "Which of the following methods return a new list without modifying the original list?",
      'choices': [
        "`sorted(my_list)`",
        "`my_list.sort()`",
        "`my_list.copy()`",
        "`my_list.reverse()`"
      ],
      'answer': ['A', 'C'], # Multi-select question
      'explanation': "`sorted()` and `.copy()` return new lists, while `.sort()` and `.reverse()` modify the list in place."
    }
  ]
}
```
````

---

### 5. Code Blocks, Inline Code & MathJax in Questions & Choices

With native Markdown rendering powered by Obsidian:
- **Syntax Highlighting**: Wrap multi-line code blocks in Python triple quotes (`"""```python ... ```"""`). All languages recognized by Obsidian (`python`, `javascript`, `cpp`, `sql`, `bash`, etc.) are rendered with full syntax highlighting.
- **Inline Code**: Use single backticks (e.g. `` `sorted(my_list)` ``) in questions, choices, hints, and explanations.
- **Code in Choices**: Choices can contain inline code chips or even full code block comparisons.
- **LaTeX Math Formulas**: Use `$E=mc^2$` or `$$\sum_{i=1}^n x_i$$` for math and science quizzes.

````markdown
```qblock
{
  'title': 'Algorithm Complexity Quiz',
  'questions': [
    {
      'question': """Which implementation has $O(1)$ time complexity for lookup?""",
      'choices': [
        """```python
# Choice A: Dictionary lookup
val = my_dict["key"]
```""",
        """```python
# Choice B: Linear list search
val = [x for x in my_list if x == "key"][0]
```"""
      ],
      'answer': 'A',
      'explanation': "Hash-table based dictionary lookups run in average $O(1)$ time."
    }
  ]
}
```
````

---

### 6. Quick Tips & Flexibility

- **Index or Letter Based Answers**: Specify answers by letter (`[A]`, `[A, B]`) or by index (`[0]`, `[0, 1]`). Starting at `0` matches Python, JavaScript, and standard programming conventions.
- **Zero Ambiguity with Numbers**: Answers are determined strictly by index or letter—never by option value. This guarantees that options containing numbers (such as `[1, 3, 2, 5]`) are completely unambiguous and predictable.
- **Zero-Indentation Freedom**: Choose YAML or Python dictionary / JSON syntax—both work seamlessly.
- **Inline Asterisk `*` (Optional)**: If you prefer, you can also mark correct answers inline directly in the list (e.g., `- "* Saturn"`).
- **No extra typing**: No need to write `text:`, `correct: false`, or `type: multi`. Quiz Block automatically detects single vs multiple choice based on your answers!

---

## ⚡ Commands

- **Insert Quiz Block template**: Press `Ctrl+P` (or `Cmd+P`) and choose `Quiz Block: Insert Quiz Block template` to quickly paste a ready-to-fill sample quiz into your note.

---

## ⚙️ Settings

- **Shuffle questions by default**: Automatically randomizes question order when loading a quiz block.
- **Instant feedback**: Immediately evaluate single-choice questions upon clicking an option.
- **1-based indexing for numerical answers**: When enabled, numerical answers start at 1 (`1` = Option A, `2` = Option B, etc.). When disabled (default), numerical answers start at 0 (`0` = Option A, `1` = Option B, etc.), matching Python and JavaScript conventions.

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
