import type { AppHandlers } from './types';

export const createAPIRouter = (handlers: AppHandlers) => {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (method === 'POST' && path === '/api/scrape') {
      return handlers.scrapeHandlers.handleScrape(req);
    }

    if (method === 'POST' && path === '/api/scrape/pdf') {
      return handlers.scrapeHandlers.handlePDFScrape(req);
    }

    if (method === 'POST' && path === '/api/scrape/pdf/docling') {
      return handlers.scrapeHandlers.handleDoclingPDFScrape(req);
    }

    if (method === 'POST' && path === '/api/upload') {
      return handlers.uploadHandlers.handleUpload(req);
    }

    if (method === 'POST' && path === '/api/paste-content') {
      return handlers.uploadHandlers.handlePasteContent(req);
    }

    if (method === 'GET' && path === '/api/documents') {
      return handlers.documentHandlers.handleListDocuments(req);
    }

    if (method === 'GET' && path.startsWith('/api/documents/') && path.split('/').length === 4) {
      return handlers.documentHandlers.handleGetDocument(req);
    }

    if (method === 'GET' && path.match(/^\/api\/documents\/[^\/]+\/download$/)) {
      const id = path.split('/')[3];
      const document = await handlers.storage.findById(id);

      if (!document) {
        return new Response(
          JSON.stringify({ success: false, error: 'Document not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (document.contentType !== 'pdf' || !document.content.fileData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Not a PDF document or no file data' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(document.content.fileData, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${document.title}.pdf"`,
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (method === 'DELETE' && path.startsWith('/api/documents/') && path.split('/').length === 4) {
      return handlers.documentHandlers.handleDeleteDocument(req);
    }

    if (method === 'DELETE' && path === '/api/documents') {
      return handlers.documentHandlers.handleDeleteMany(req);
    }

    if (method === 'GET' && path === '/api/health') {
      return new Response(
        JSON.stringify({ status: 'healthy' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // LLM endpoints
    if (method === 'POST' && path === '/api/llm/analyze') {
      return handlers.llmHandlers.handleAnalyze(req);
    }

    if (method === 'POST' && path === '/api/llm/process') {
      return handlers.llmHandlers.handleProcess(req);
    }

    if (method === 'POST' && path === '/api/llm/query') {
      return handlers.llmHandlers.handleQuery(req);
    }

    if (method === 'POST' && path === '/api/llm/knowledge-graph') {
      return handlers.llmHandlers.handleKnowledgeGraph(req);
    }

    if (method === 'GET' && path === '/api/llm/status') {
      return handlers.llmHandlers.handleStatus(req);
    }

    return null;
  };
};