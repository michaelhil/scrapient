# 🕷️ Scrapient

Simplified extension-first web scraping tool built with TypeScript and Bun.

## Features

- **Chrome Extension**: One-click scraping with popup interface
- **Keyboard Shortcuts**: Ctrl+Shift+S (Cmd+Shift+S on Mac)
- **Dashboard**: Clean web interface for managing scraped content
- **Bulk Operations**: Select and delete multiple documents
- **Content Viewer**: Preview HTML, view text, and inspect metadata
- **TypeScript First**: Type-safe codebase with factory functions
- **MongoDB Storage**: Reliable document storage

## Quick Start

1. **Setup**:
   ```bash
   cd scrapient
   bun install
   bun run setup
   ```

2. **Start Development**:
   ```bash
   bun run dev
   ```

3. **Load Chrome Extension**:
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `extensions/chrome/build/` folder

4. **Start Scraping**:
   - Visit any webpage
   - Press `Ctrl+Shift+S` or click the extension icon
   - View results at `http://localhost:3001`

## Architecture

```
extensions/          # Browser extensions
├── shared/         # TypeScript source code
├── chrome/         # Chrome-specific files
└── scripts/        # Build scripts

src/                # Backend server
├── api/           # API route handlers
├── storage/       # MongoDB integration
└── server.ts      # Main server

dashboard/          # Web dashboard
├── app.ts         # Dashboard logic
├── styles/        # CSS styles
└── index.html     # Main page
```

## API Endpoints

- `POST /api/scrape` - Submit scraped content
- `GET /api/documents` - List all documents
- `GET /api/documents/:id` - Get specific document
- `DELETE /api/documents/:id` - Delete single document
- `DELETE /api/documents` - Bulk delete (with `ids` array)

## Development

- **Extension**: `bun run build:extensions`
- **Watch Mode**: `bun run watch:extensions`
- **Server**: `bun run dev`
- **Database**: `bun run docker:up`

## Future Features

- Firefox extension support
- PDF and Excel file processing
- AI-powered content cleaning
- Advanced filtering and tagging
- Real-time WebSocket updates

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Database**: MongoDB
- **Frontend**: Vanilla TS (no framework)
- **Architecture**: Factory functions, no classes