export const createStaticRouter = () => {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method !== 'GET') {
      return null;
    }

    if (path === '/' || path === '/index.html') {
      try {
        const indexFile = Bun.file('./dashboard/index.html');
        return new Response(indexFile, {
          headers: { 'Content-Type': 'text/html' }
        });
      } catch (error) {
        console.error('Error serving index.html:', error);
      }
    }

    if (path === '/app.js') {
      try {
        const result = await Bun.build({
          entrypoints: ['./dashboard/app.ts'],
          target: 'browser',
          format: 'iife',
          minify: false
        });

        if (!result.success) {
          throw new Error('Build failed');
        }

        const output = await result.outputs[0].text();
        return new Response(output, {
          headers: { 'Content-Type': 'application/javascript' }
        });
      } catch (error) {
        console.error('Error serving app.js:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to build app.js' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    if (path === '/styles.css') {
      try {
        const cssFile = Bun.file('./dashboard/styles/main.css');
        return new Response(cssFile, {
          headers: { 'Content-Type': 'text/css' }
        });
      } catch (error) {
        console.error('Error serving styles.css:', error);
      }
    }

    return null;
  };
};