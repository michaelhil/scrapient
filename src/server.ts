import type { Server } from 'bun';
import { createMongoStorage } from './storage/mongodb';
import { createScrapeHandlers } from './api/scrape';
import { createDocumentHandlers } from './api/documents';
import { createUploadHandlers } from './api/upload';
import { createLLMHandlers } from './api/llm';
import { createKGHandlers } from './api/kg';
import { createAppRouter } from './core/router';

export const createServer = async (): Promise<Server> => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/scrapient';

  const storage = await createMongoStorage(mongoUri);
  const scrapeHandlers = createScrapeHandlers(storage);
  const documentHandlers = createDocumentHandlers(storage);
  const uploadHandlers = createUploadHandlers(storage);
  const llmHandlers = createLLMHandlers(storage);
  const kgHandlers = createKGHandlers(storage);

  const router = createAppRouter({
    scrapeHandlers,
    documentHandlers,
    uploadHandlers,
    llmHandlers,
    kgHandlers,
    storage
  });

  const port = parseInt(process.env.PORT || '3000');

  const server = Bun.serve({
    port,
    fetch: router,
    idleTimeout: 255 // Maximum allowed idleTimeout in seconds
  });

  console.log(`🕷️ Scrapient server running on http://localhost:${port}`);

  return server;
};

if (import.meta.main) {
  await createServer();
}