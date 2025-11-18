import type { Server } from 'bun';
import { createMongoStorage } from './storage/mongodb';
import { createScrapeHandlers } from './api/scrape';
import { createDocumentHandlers } from './api/documents';
import { createUploadHandlers } from './api/upload';
import { createLLMHandlers } from './api/llm';
import { createKGHandlers } from './api/kg';
import { createAppRouter } from './core/router';
import { createProcessGuard } from './core/process-guard';
import { createPortManager } from './core/port-manager';
import { loadConfig, validateConfig } from './core/config';
import { createSecurityMiddleware, createRateLimiter } from './core/security';

export const createServer = async (): Promise<Server> => {
  // Load and validate configuration
  const { config } = loadConfig();
  validateConfig();

  const port = config.server.port;

  // Create process guard and port manager
  const processGuard = createProcessGuard(port);
  const portManager = createPortManager();

  // Create security middleware
  const security = createSecurityMiddleware(config);
  const rateLimiter = createRateLimiter();

  // Check if we can acquire the process lock
  const canStart = await processGuard.acquireLock();
  if (!canStart) {
    process.exit(1);
  }

  // Check if port is already in use
  const portInfo = await portManager.checkPortInUse(port);
  if (portInfo) {
    console.log(`⚠️  Port ${port} is in use by process ${portInfo.pid} (${portInfo.process})`);

    // If it's a Scrapient process, offer to kill it
    if (portInfo.process.includes('bun') || portInfo.process.includes('scrapient')) {
      console.log('🔄 Attempting to stop existing server...');
      const killed = await portManager.killProcessOnPort(port);

      if (killed) {
        console.log('✅ Previous server stopped');
        // Wait a moment for the port to be released
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.error('❌ Failed to stop existing server');
        process.exit(1);
      }
    } else {
      console.error('❌ Port is in use by another application');
      process.exit(1);
    }
  }

  try {
    const storage = await createMongoStorage(config.database.mongoUri);
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

    // Enhanced router with security middleware
    const secureRouter = async (request: Request): Promise<Response> => {
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return security.handlePreflight(request);
      }

      // Rate limiting
      const rateLimitResult = rateLimiter.isRateLimited(request);
      if (rateLimitResult.limited) {
        return new Response(
          JSON.stringify({ error: 'Too many requests, please try again later' }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Process the request
      const response = await router(request);

      // Add security headers
      return security.wrapResponse(response, request);
    };

    const server = Bun.serve({
      port,
      fetch: secureRouter,
      idleTimeout: 255 // Maximum allowed idleTimeout in seconds
    });

    console.log(`🕷️ Scrapient server running on http://localhost:${port}`);
    console.log(`📋 Process ID: ${process.pid}`);
    console.log(`🔒 Process lock acquired`);
    console.log(`🛡️ Security middleware enabled`);
    console.log(`📊 MongoDB: ${config.database.mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);
    console.log(`🤖 LLM Model: ${config.llm.modelPath ? 'Configured' : 'Not configured'}`);
    console.log(`🌍 CORS Origins: ${config.server.corsOrigin.join(', ')}`);

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (error instanceof Error && error.message.includes('Configuration')) {
      console.error('💡 Check your environment variables or create a .env file');
    }
    await processGuard.releaseLock();
    process.exit(1);
  }
};

if (import.meta.main) {
  await createServer();
}