# 🕷️ Scrapient

TypeScript-first web scraping and document processing tool with browser extension and PDF processing capabilities.

## Features

- **Multi-Format Processing**: Web pages, PDFs, JSON, Markdown
- **Local LLM Integration**: Document analysis, entity extraction, knowledge graphs
- **Knowledge Graph Generation**: Visual Mermaid diagrams and Neo4j Cypher export
- **Docling PDF Engine**: Advanced PDF processing with structured output
- **Chrome Extension**: One-click web scraping
- **File Upload**: Direct file upload and paste content support
- **Modular Dashboard**: Clean web interface for document management
- **Enterprise Security**: CORS, CSP headers, rate limiting, input sanitization
- **Process Management**: Single-instance server with automatic conflict resolution
- **TypeScript Architecture**: Fully typed codebase with functional patterns

## Quick Start

```bash
# Setup
bun install
bun run setup

# Download LLM model (optional)
bun run llm:download

# Start server (with process guards)
bun run dev

# Alternative commands
bun run stop     # Stop all server instances
bun run restart  # Clean restart

# Load Chrome extension
# → chrome://extensions/ → Load unpacked → extensions/chrome/build/

# Access dashboard: http://localhost:3000
```

## Architecture

```
src/
├── core/
│   ├── router/       # Modular request routing
│   ├── config.ts     # Secure configuration validation
│   ├── security.ts   # Security middleware & CORS
│   ├── process-guard.ts # Single-instance enforcement
│   └── port-manager.ts  # Port conflict resolution
├── api/
│   ├── handlers/     # Request handlers (upload, files)
│   ├── validators/   # Input validation
│   ├── scrape.ts     # Web & PDF scraping
│   ├── documents.ts  # Document management
│   ├── llm.ts        # LLM analysis endpoints
│   └── kg.ts         # Knowledge graph generation
├── services/
│   ├── llm/          # Local LLM integration
│   └── kg/           # Knowledge graph processing
├── storage/          # MongoDB integration
└── utils/           # Docling PDF processor

dashboard/
├── components/       # UI components (upload, documents, modals)
├── core/            # State management & utilities
├── styles/          # Modular CSS
└── app.ts          # Main orchestrator (33 lines)

extensions/
├── shared/          # Common TypeScript code
├── chrome/         # Chrome extension
└── scripts/        # Build automation
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

### LLM Analysis
- `POST /api/llm/analyze` - Analyze single document
- `POST /api/llm/process` - Process multiple documents
- `POST /api/llm/query` - Query document collection
- `GET /api/llm/status` - LLM service status

### Knowledge Graphs
- `POST /api/kg/generate` - Generate knowledge graph (streaming)
- `POST /api/kg/to-cypher` - Convert to Neo4j Cypher
- `POST /api/kg/save` - Save to database
- `GET /api/kg` - List knowledge graphs
- `GET /api/kg/:id` - Get knowledge graph
- `DELETE /api/kg/:id` - Delete knowledge graph

## Technology Stack

- **Runtime**: Bun (primary), Node.js compatible
- **Language**: TypeScript (100% - no JavaScript files)
- **Database**: MongoDB
- **PDF Processing**: Docling (IBM Research)
- **LLM Engine**: node-llama-cpp (local Llama 3.1 8B)
- **Visualization**: Mermaid (knowledge graphs)
- **Security**: CORS, CSP, rate limiting, input sanitization
- **Architecture**: Functional programming, factory patterns
- **Frontend**: Vanilla TypeScript, no frameworks

## Security Features

- **Process Guards**: Single-instance server enforcement
- **Port Management**: Automatic conflict resolution
- **Security Headers**: CSP, XSS protection, HSTS
- **CORS Protection**: Configurable origin validation
- **Rate Limiting**: 100 requests per 15-minute window
- **Input Sanitization**: Path traversal and injection prevention
- **Configuration Validation**: Zod-based environment validation

## Environment Configuration

```bash
# Required
MONGO_URI=mongodb://localhost:27017/scrapient

# Optional
PORT=3000
LLM_MODEL_PATH=./models/llama-3.1-8b-instruct.gguf
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
MAX_FILE_SIZE=50000000
TEMP_DIR=/tmp
```