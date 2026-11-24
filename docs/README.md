# Mémo — French

One static web app with three sections, switched from the tab bar at the bottom:

| Tab | Folder | What it is |
|---|---|---|
| **Leçons** | `lecons/` | Grammar lessons with exercises, subjects 1–120 (A1–B2) |
| **Lecture** | `lecture/` | Graded reading modules with glossary and questions |
| **Cartes** | `cartes/` | Spaced-repetition flashcards, typed answers and quizzes |

`index.html` at the top is the home screen and tab bar (Accueil · Leçons · Lecture · Cartes). It keeps each section loaded in its own frame, so switching tabs keeps your place.

Inside a lesson, a reading module or a flashcard session, a **Leçon · Lecture · Cartes** bar switches to the same subject in another section. It is drawn by `shared/bridge.js` from `shared/links.json`, which records:

- `subjects`: for each Leçons subject number, its title, the Lecture modules that practise it and the Cartes decks for it.
- `modules`: for each Lecture module, the subject numbers it practises (the first is the main one).

When a new lesson, reading or deck should join a subject, add it to `links.json`.

Host the whole folder on GitHub Pages or any web server. It will not work when opened directly from disk.

## Adding content

Each section still reads its own `resources/index.json`:

- **Flashcard deck:** add a JSON file under `cartes/resources/` and its path to `cartes/resources/index.json`. The deck format is documented in the comments of `cartes/index.html`. Give it the same `subject` number as the lesson so the two link up.
- **Lesson:** add a file under `lecons/resources/` and an entry in that level's `subjects` list in `lecons/resources/index.json`.
- **Reading module:** add a file under `lecture/resources/` and its path to that level's `modules` list in `lecture/resources/index.json`.

## Progress

Each section saves its own progress in the browser (`lecons-french-v1`, `lecture-french-v1`, `memo-french-v2`), on that device only.

## Opening a section directly

`#lecons`, `#lecture` or `#cartes` after the address opens that tab. Each section also works on its own at `lecons/index.html` and so on.
