import type { Storage } from '../storage/types';
import { z } from 'zod';

const DeleteManySchema = z.object({
  ids: z.array(z.string())
});

export const createDocumentHandlers = (storage: Storage) => {
  const handleListDocuments = async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const documents = await storage.findAll({ limit, offset });

      return new Response(
        JSON.stringify({ success: true, documents }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      console.error('List documents error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  };

  const handleGetDocument = async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const documentId = pathParts[3];

      if (!documentId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Document ID is required' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      const document = await storage.findById(documentId);

      if (!document) {
        return new Response(
          JSON.stringify({ success: false, error: 'Document not found' }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, document }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      console.error('Get document error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  };

  const handleDeleteDocument = async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/');
      const documentId = pathParts[3];

      if (!documentId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Document ID is required' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      const deleted = await storage.deleteById(documentId);

      if (!deleted) {
        return new Response(
          JSON.stringify({ success: false, error: 'Document not found' }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      console.error('Delete document error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  };

  const handleDeleteMany = async (req: Request): Promise<Response> => {
    try {
      const body = await req.json();
      const { ids } = DeleteManySchema.parse(body);

      const deletedCount = await storage.deleteMany(ids);

      return new Response(
        JSON.stringify({ success: true, deletedCount }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      console.error('Delete many error:', error);

      const errorMessage = error instanceof z.ZodError
        ? 'Invalid request data'
        : error instanceof Error
        ? error.message
        : 'Internal server error';

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        {
          status: error instanceof z.ZodError ? 400 : 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  };

  return {
    handleListDocuments,
    handleGetDocument,
    handleDeleteDocument,
    handleDeleteMany
  };
};