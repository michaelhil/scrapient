import type { AppHandlers, Router } from './types';
import { createAPIRouter } from './apiRouter';
import { createStaticRouter } from './staticRouter';

export const createAppRouter = (handlers: AppHandlers): Router => {
  const apiRouter = createAPIRouter(handlers);
  const staticRouter = createStaticRouter();

  return async (req: Request): Promise<Response> => {
    const apiResponse = await apiRouter(req);
    if (apiResponse) {
      return apiResponse;
    }

    const staticResponse = await staticRouter(req);
    if (staticResponse) {
      return staticResponse;
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  };
};