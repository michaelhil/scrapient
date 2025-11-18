import type { Storage } from '../storage/types';
import { LLMService } from '../services/llm/LLMService';
import { createKGService, type KGGenerationRequest } from '../services/kg';
import { z } from 'zod';
import path from 'path';

const KGGenerationRequestSchema = z.object({
  documentIds: z.array(z.string()),
  userPrompt: z.string(),
  title: z.string().optional()
});

const CypherGenerationRequestSchema = z.object({
  kgId: z.string(),
  rawData: z.object({
    entities: z.array(z.any()),
    relationships: z.array(z.any()),
    summary: z.string().optional(),
    themes: z.array(z.string()).optional()
  })
});

const KGSaveRequestSchema = z.object({
  kgId: z.string()
});

export const createKGHandlers = (storage: Storage) => {
  const llmService = new LLMService();
  let isInitialized = false;
  let kgService: any = null;

  // Initialize services
  const initializeServices = async (): Promise<void> => {
    if (isInitialized) return;

    try {
      const modelPath = process.env.LLM_MODEL_PATH || path.join(process.cwd(), 'models', 'llama-3.1-8b-instruct.gguf');

      await llmService.initialize({
        modelPath,
        contextSize: 8192,
        temperature: 0.1,
        maxTokens: 8192,
        gpu: 'auto'
      });

      kgService = createKGService({
        llmService
      });

      isInitialized = true;
      console.log('KG services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize KG services:', error);
    }
  };

  // Initialize on first request
  initializeServices();

  const handleGenerate = async (req: Request): Promise<Response> => {
    console.log('🚀 KG generation request received');
    try {
      if (!isInitialized || !kgService) {
        console.error('❌ KG service not initialized');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'KG service not initialized. Please check model configuration.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          }
        );
      }

      const body = await req.json();
      const validatedRequest = KGGenerationRequestSchema.parse(body);

      // Fetch documents from storage
      const documents = [];
      for (const documentId of validatedRequest.documentIds) {
        const document = await storage.findById(documentId);
        if (document) {
          documents.push(document);
        }
      }

      if (documents.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No valid documents found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      // Create streaming response for progress updates
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Create KG service with progress callback
            const streamingKGService = createKGService({
              llmService,
              progressCallback: (progress: number, message: string) => {
                try {
                  // Check if controller is still active
                  if (!controller || controller.desiredSize === null) return;
                  const chunk = new TextEncoder().encode(`data: ${JSON.stringify({
                    type: 'progress',
                    progress,
                    message
                  })}\n\n`);
                  controller.enqueue(chunk);
                } catch (error) {
                  console.warn('Failed to enqueue progress chunk:', error);
                }
              }
            });

            const result = await streamingKGService.generateKG(validatedRequest, documents);

            if (result.success) {
              // Save KG to storage
              const title = validatedRequest.title || `Knowledge Graph: ${documents.length} Documents`;
              const kgId = await storage.saveKG({
                title,
                sourceDocumentIds: validatedRequest.documentIds,
                generatedAt: new Date(),
                updatedAt: new Date(),
                rawData: result.data,
                mermaidCode: result.mermaidCode,
                neo4jStatus: 'pending',
                metadata: {
                  userPrompt: validatedRequest.userPrompt,
                  model: result.metadata?.model || 'llama-3.1-8b',
                  processingTime: result.metadata?.processingTime || 0,
                  stage: 'preview'
                }
              });

              // Send final result
              const chunk = new TextEncoder().encode(`data: ${JSON.stringify({
                type: 'result',
                kgId,
                rawData: result.data,
                mermaidCode: result.mermaidCode,
                metadata: result.metadata
              })}\n\n`);
              try {
                if (controller && controller.desiredSize !== null) {
                  controller.enqueue(chunk);
                }
              } catch (error) {
                console.warn('Failed to enqueue result chunk:', error);
              }
            } else {
              // Send error
              const chunk = new TextEncoder().encode(`data: ${JSON.stringify({
                type: 'error',
                message: result.error || 'Unknown error occurred'
              })}\n\n`);
              try {
                if (controller && controller.desiredSize !== null) {
                  controller.enqueue(chunk);
                }
              } catch (error) {
                console.warn('Failed to enqueue error chunk:', error);
              }
            }

            try {
              if (controller && controller.desiredSize !== null) {
                controller.close();
              }
            } catch (error) {
              console.warn('Controller already closed:', error);
            }

          } catch (error) {
            console.error('KG generation stream error:', error);
            try {
              const errorChunk = new TextEncoder().encode(`data: ${JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : 'Generation failed'
              })}\n\n`);
              controller.enqueue(errorChunk);
            } catch (enqueueError) {
              console.warn('Failed to enqueue error in catch block:', enqueueError);
            } finally {
              try {
                controller.close();
              } catch (closeError) {
                console.warn('Controller already closed:', closeError);
              }
            }
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });

    } catch (error) {
      console.error('KG generation error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Generation failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  const handleToCypher = async (req: Request): Promise<Response> => {
    try {
      if (!isInitialized || !kgService) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'KG service not initialized'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          }
        );
      }

      const body = await req.json();
      const validatedRequest = CypherGenerationRequestSchema.parse(body);

      const result = await kgService.generateCypherFromKG(validatedRequest);

      if (result.success) {
        // Update KG in storage
        await storage.updateKG(validatedRequest.kgId, {
          cypherCode: result.cypherCode,
          updatedAt: new Date(),
          metadata: {
            stage: 'cypher'
          } as any
        });

        return new Response(
          JSON.stringify({
            success: true,
            cypherCode: result.cypherCode
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: result.error
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          }
        );
      }

    } catch (error) {
      console.error('Cypher generation error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Cypher generation failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  const handleSave = async (req: Request): Promise<Response> => {
    try {
      const body = await req.json();
      const validatedRequest = KGSaveRequestSchema.parse(body);

      // Get KG from storage
      const kg = await storage.findKGById(validatedRequest.kgId);
      if (!kg) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Knowledge graph not found'
          }),
          { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      if (!kg.cypherCode) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No Cypher code available for this knowledge graph'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      // TODO: Implement Neo4j integration here
      // For now, just mark as saved in metadata
      await storage.updateKG(validatedRequest.kgId, {
        neo4jStatus: 'saved',
        updatedAt: new Date(),
        metadata: {
          stage: 'complete'
        } as any
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Knowledge graph saved successfully'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      console.error('KG save error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Save failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  const handleList = async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const kgs = await storage.findAllKGs({ limit, offset });

      return new Response(
        JSON.stringify({
          success: true,
          kgs: kgs.map(kg => ({
            id: kg.id,
            title: kg.title,
            sourceDocumentIds: kg.sourceDocumentIds,
            generatedAt: kg.generatedAt,
            updatedAt: kg.updatedAt,
            neo4jStatus: kg.neo4jStatus,
            stage: kg.metadata.stage
          }))
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      console.error('KG list error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'List failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  const handleGet = async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const pathSegments = url.pathname.split('/');
      const kgId = pathSegments[pathSegments.length - 1];

      if (!kgId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'KG ID is required'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      const kg = await storage.findKGById(kgId);
      if (!kg) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Knowledge graph not found'
          }),
          { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          kg
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      console.error('KG get error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Get failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  const handleDelete = async (req: Request): Promise<Response> => {
    try {
      const url = new URL(req.url);
      const pathSegments = url.pathname.split('/');
      const kgId = pathSegments[pathSegments.length - 1];

      if (!kgId) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'KG ID is required'
          }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      const deleted = await storage.deleteKGById(kgId);
      if (!deleted) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Knowledge graph not found'
          }),
          { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Knowledge graph deleted successfully'
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );

    } catch (error) {
      console.error('KG delete error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Delete failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  return {
    handleGenerate,
    handleToCypher,
    handleSave,
    handleList,
    handleGet,
    handleDelete
  };
};