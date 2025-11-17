import type { Server } from 'bun';
import { createMongoStorage } from './storage/mongodb';
import { createScrapeHandlers } from './api/scrape';
import { createDocumentHandlers } from './api/documents';
import { createUploadHandlers } from './api/upload';
import { createLLMHandlers } from './api/llm';
import { createAppRouter } from './core/router';

export const createServer = async (): Promise<Server> => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/scrapient';

  const storage = await createMongoStorage(mongoUri);
  const scrapeHandlers = createScrapeHandlers(storage);
  const documentHandlers = createDocumentHandlers(storage);
  const uploadHandlers = createUploadHandlers(storage);
  const llmHandlers = createLLMHandlers(storage);

  const router = createAppRouter({
    scrapeHandlers,
    documentHandlers,
    uploadHandlers,
    llmHandlers,
    storage
  });

  const port = parseInt(process.env.PORT || '3000');

  const server = Bun.serve({
    port,
    fetch: router
  });

  console.log(`🕷️ Scrapient server running on http://localhost:${port}`);

  return server;
};

if (import.meta.main) {
  await createServer();
}