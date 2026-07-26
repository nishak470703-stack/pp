# Local Pocket Reader

A feature-rich Firefox extension for saving, organizing, and reading web pages locally — a self-hosted alternative to Pocket/Instapaper.

## Features

- **Article Saving & Reader View** — Save any page locally with clean reader mode
- **Category Management** — Organize with custom categories and auto-assignment rules
- **AI Summarization** — Integrates with ChatGPT, Claude, Gemini, Perplexity, Copilot, Grok, DeepSeek, Poe, Mistral
- **YouTube Transcript Summarization** — Extract and summarize video transcripts
- **Notes & Highlights** — In-page notes, text highlighting, mindmap visualization
- **Jarvis AI Assistant** — Bilingual (BM/EN) conversational assistant with command execution, article summarization, and context-aware chat
- **Cloud Sync & Backup** — Full data sync via Supabase
- **Gesture Controls** — Mouse gesture recognition with direction and shape modes
- **Floating Button** — Quick save with configurable visibility modes
- **Pomodoro Timer** — Built-in focus timer with statistics
- **14 Themes** — Including custom theme support
- **Import/Export** — JSON backup with deduplication

## Installation

### From Source (Development)

1. Clone or download this repository
2. Open Firefox and navigate to `about:debugging`
3. Click **This Firefox** > **Load Temporary Add-on**
4. Select `manifest.json` from the project directory

### Supabase Setup (Optional — for Cloud Sync)

See [SUPABASE_SETUP_GUIDE.md](SUPABASE_SETUP_GUIDE.md) for database and auth configuration.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+P` | Save current page |
| `Alt+A` | Open category picker |
| `Alt+Shift+I` | Toggle AI sidebar |
| `Alt+Shift+O` | Toggle notes overlay |
| `Alt+Shift+T` | Toggle Pomodoro timer |
| `Alt+F` | Toggle favorites filter |

See the full list in `manifest.json` under `commands`.

## Architecture

- `manifest.json` — Extension configuration (Manifest V2, Firefox 140+)
- `background.js` — Main background script (orchestrates all features)
- `core/` — Modular core modules:
  - `pickerScript.js` — Category picker UI (injected into pages)
  - `backgroundPomodoro.js` — Pomodoro timer engine
  - `backgroundSummary.js` — AI summary pipeline
  - `validationCore.js`, `storageManagerCore.js`, etc. — Shared utilities
- `contentScript*.js` — Page-level scripts for article extraction and AI provider integration
- `sidebar.html/js` — Firefox sidebar panel
- `options.html/js` — Settings page
- `lib/dompurify.min.js` — HTML sanitization library
- `build.js` — esbuild build script

## Development

```bash
# Install dev dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build for production
npm run build

# Build for development (with source maps)
npm run build:dev
```

## License

MIT
