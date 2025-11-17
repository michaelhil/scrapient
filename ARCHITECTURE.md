# Architectural Design Records (ADR)

## ADR-001: TypeScript-Only Development Policy

**Date**: 2024-11-17
**Status**: Adopted
**Decision Maker**: Core Development Team

### Context
The codebase was originally mixed JavaScript/TypeScript. Type safety and maintainability improvements were needed.

### Decision
- **All new code must be written in TypeScript (.ts files)**
- **No JavaScript files allowed without explicit approval**
- **100% TypeScript codebase policy**
- **Complete type definitions required for all functions and interfaces**

### Consequences
**Positive:**
- Enhanced type safety and development experience
- Better IDE support and refactoring capabilities
- Consistent codebase standards
- Reduced runtime errors

**Negative:**
- Slight increase in development time for type definitions
- Learning curve for developers new to TypeScript

---

## ADR-002: Functional Programming Architecture

**Date**: 2024-11-17
**Status**: Adopted
**Decision Maker**: Core Development Team

### Context
Need for maintainable, testable, and scalable architecture patterns.

### Decision
- **Factory functions over ES6 classes**
- **Pure functions and immutable data structures**
- **Function composition over inheritance**
- **Object literals and configuration objects**

### Rationale
- Easier to test and mock
- More predictable behavior
- Better compatibility with TypeScript
- Reduced complexity and coupling

### Examples
```typescript
// ✅ Preferred: Factory function
export const createUploadHandler = (storage: Storage) => ({
  handleUpload: async (req: Request) => { /* implementation */ }
});

// ❌ Avoided: Class-based
class UploadHandler {
  constructor(storage: Storage) { /* avoid */ }
}
```

---

## ADR-003: File Size Standards

**Date**: 2024-11-17
**Status**: Adopted
**Decision Maker**: Core Development Team

### Context
Large files (1000+ lines) were becoming difficult to maintain and understand.

### Decision
- **Maximum file size: 250 lines**
- **Maximum function size: 50 lines**
- **Split oversized files into focused modules**
- **Single responsibility principle enforcement**

### Implementation Results
- `dashboard/app.ts`: 1,023 → 33 lines (97% reduction)
- `src/api/upload.ts`: 341 → 6 lines (98% reduction)
- `src/server.ts`: 173 → 21 lines (88% reduction)

---

## ADR-004: Modular Architecture Pattern

**Date**: 2024-11-17
**Status**: Adopted
**Decision Maker**: Core Development Team

### Context
Monolithic files were difficult to maintain, test, and understand.

### Decision
- **Component-based organization**
- **Clear separation of concerns**
- **Focused, single-purpose modules**
- **Hierarchical folder structure**

### Structure
```
src/
├── core/router/        # Request routing
│   ├── apiRouter.ts   # API endpoints
│   ├── staticRouter.ts # Static files
│   └── appRouter.ts   # Main orchestrator
├── api/
│   ├── handlers/      # Request handlers
│   ├── validators/    # Input validation
│   └── *.ts          # Domain handlers
├── storage/           # Data persistence
└── utils/            # Utilities

dashboard/
├── components/        # UI components
├── core/             # State & logic
└── styles/           # Styling
```

---

## ADR-005: Docling PDF Processing

**Date**: 2024-11-17
**Status**: Adopted
**Decision Maker**: Core Development Team

### Context
Multiple PDF processing libraries (pdf-parse, unpdf) created complexity and maintenance overhead.

### Decision
- **Docling as the sole PDF processing engine**
- **Remove all legacy PDF processors**
- **No fallback mechanisms**
- **Consolidate to single processing pipeline**

### Rationale
- Docling provides superior structured output
- Reduces dependency complexity
- Eliminates maintenance of multiple PDF libraries
- Simplifies debugging and testing

### Migration Actions
- Removed `pdf-parse` and `unpdf` dependencies
- Deleted `src/utils/pdfProcessor.ts`
- Updated `/api/scrape/pdf` to use Docling exclusively

---

## ADR-006: Single Server Policy

**Date**: 2024-11-17
**Status**: Adopted
**Decision Maker**: Core Development Team

### Context
Multiple HTTP servers can create confusion, port conflicts, and deployment complexity.

### Decision
- **Exactly one HTTP server at `src/server.ts`**
- **Integration over separation**
- **No microservices architecture**
- **All functionality consolidated into main server**

### Exceptions
- MCP protocol server (different protocol, not HTTP)
- Test servers (temporary, cleaned up after tests)

---

## ADR-007: Bun Runtime Preference

**Date**: 2024-11-17
**Status**: Adopted
**Decision Maker**: Core Development Team

### Context
Need for fast development iteration and modern JavaScript runtime.

### Decision
- **Bun as primary runtime for development and execution**
- **Maintain Node.js compatibility**
- **Use Bun package manager when possible**
- **Async/await over Promise chains**

### Benefits
- Faster startup and execution
- Built-in TypeScript support
- Modern JavaScript features
- Excellent development experience

---

## ADR-008: Zero-Dependency Philosophy

**Date**: 2024-11-17
**Status**: Adopted
**Decision Maker**: Core Development Team

### Context
Minimizing external dependencies reduces security vulnerabilities and maintenance overhead.

### Decision
- **Minimize runtime dependencies**
- **Use built-in platform features when possible**
- **Carefully evaluate each new dependency**
- **Regular dependency audits and cleanup**

### Current Dependencies
- `mongodb`: Database driver (essential)
- `zod`: Runtime type validation (essential)

### Removed Dependencies
- `pdf-parse`: Replaced by Docling
- `unpdf`: Replaced by Docling

---

## Implementation Guidelines

### Code Organization
1. **One responsibility per file**
2. **Clear module boundaries**
3. **Explicit exports and imports**
4. **Consistent naming conventions**

### TypeScript Standards
1. **Explicit type annotations**
2. **Interface definitions for all data structures**
3. **Strict TypeScript configuration**
4. **No `any` types without justification**

### Testing Strategy
1. **Unit tests for pure functions**
2. **Integration tests for API endpoints**
3. **End-to-end tests for critical workflows**
4. **Mocking external dependencies**

### Performance Considerations
1. **Lazy loading where appropriate**
2. **Efficient data structures**
3. **Minimal memory allocation**
4. **Profiling and optimization**

---

## Decision Review Process

1. **Proposal**: Document architectural change proposal
2. **Discussion**: Team review and feedback
3. **Decision**: Formal adoption or rejection
4. **Implementation**: Execute architectural changes
5. **Review**: Periodic evaluation of architectural decisions

---

*This document is updated as architectural decisions are made and should be reviewed quarterly.*