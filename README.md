# 🕷️ Scrapient

TypeScript-first web scraping and document processing tool with browser extension and PDF processing capabilities.

## Features

- **Multi-Format Processing**: Web pages, PDFs, JSON, Markdown
- **Docling PDF Engine**: Advanced PDF processing with structured output
- **Chrome Extension**: One-click web scraping
- **File Upload**: Direct file upload and paste content support
- **Modular Dashboard**: Clean web interface for document management
- **TypeScript Architecture**: Fully typed codebase with functional patterns

## Quick Start

```bash
# Setup
bun install
bun run setup

# Start server
bun run dev

# Load Chrome extension
# → chrome://extensions/ → Load unpacked → extensions/chrome/build/

# Access dashboard: http://localhost:3000
```

## Architecture

```
src/
├── core/router/        # Modular request routing
├── api/
│   ├── handlers/       # Request handlers (upload, files)
│   ├── validators/     # Input validation
│   ├── scrape.ts      # Web & PDF scraping
│   └── documents.ts   # Document management
├── storage/           # MongoDB integration
└── utils/            # Docling PDF processor

dashboard/
├── components/        # UI components (upload, documents, modals)
├── core/             # State management & utilities
├── styles/           # Modular CSS
└── app.ts           # Main orchestrator (33 lines)

extensions/
├── shared/           # Common TypeScript code
├── chrome/          # Chrome extension
└── scripts/         # Build automation
```

## API Endpoints

### Web Scraping
- `POST /api/scrape` - Web page scraping
- `POST /api/scrape/pdf` - PDF processing (Docling)

### File Upload
- `POST /api/upload` - File upload (PDF/JSON/Markdown)
- `POST /api/paste-content` - Paste content directly

### Document Management
- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Get document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/:id/download` - Download PDF

## Technology Stack

- **Runtime**: Bun (primary), Node.js compatible
- **Language**: TypeScript (100% - no JavaScript files)
- **Database**: MongoDB
- **PDF Processing**: Docling (IBM Research)
- **Architecture**: Functional programming, factory patterns
- **Frontend**: Vanilla TypeScript, no frameworks