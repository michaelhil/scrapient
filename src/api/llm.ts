import type { Storage } from '../storage/types';
import { LLMService } from '../services/llm/LLMService';
import { z } from 'zod';
import path from 'path';

const AnalysisRequestSchema = z.object({
  documentId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  content: z.string().optional(),
  type: z.enum(['document', 'text', 'markdown', 'json']).default('text'),
  task: z.object({
    type: z.enum(['summarize', 'extract_entities', 'analyze_sentiment', 'generate_keywords', 'extract_relationships', 'custom']),
    instructions: z.string().optional()
  }),
  options: z.object({
    maxLength: z.number().optional(),
    language: z.string().optional(),
    format: z.enum(['json', 'markdown', 'text']).default('json')
  }).optional()
});

const ProcessingRequestSchema = z.object({
  documentIds: z.array(z.string()),
  task: z.object({
    type: z.enum(['merge', 'compare', 'extract_common_themes', 'generate_knowledge_graph']),
    instructions: z.string().optional()
  }),
  options: z.object({
    outputFormat: z.enum(['json', 'md', 'text']).default('json'),
    includeMetadata: z.boolean().default(true)
  }).optional()
});

const QueryRequestSchema = z.object({
  query: z.string(),
  documentIds: z.array(z.string()).optional(),
  contextLimit: z.number().default(4000)
});

export const createLLMHandlers = (storage: Storage) => {
  const llmService = new LLMService();
  let isInitialized = false;

  // Initialize LLM service with default model
  const initializeLLMService = async () => {
    if (isInitialized) return;

    try {
      const modelPath = process.env.LLM_MODEL_PATH || path.join(process.cwd(), 'models', 'llama-3.1-8b-instruct.gguf');

      await llmService.initialize({
        modelPath,
        contextSize: 4096,
        temperature: 0.7,
        maxTokens: 2048,
        gpu: 'auto'
      });

      isInitialized = true;
      console.log('LLM service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LLM service:', error);
      // Service will remain uninitialized, endpoints will return errors
    }
  };

  // Initialize on first request
  initializeLLMService();

  const handleAnalyze = async (req: Request): Promise<Response> => {
    try {
      if (!isInitialized) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'LLM service not initialized. Please check model configuration.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          }
        );
      }

      const body = await req.json();
      const validatedRequest = AnalysisRequestSchema.parse(body);

      let content = validatedRequest.content;

      // If documentIds provided, fetch and combine content from multiple documents
      if (validatedRequest.documentIds && validatedRequest.documentIds.length > 0) {
        const documentContents = [];

        for (const documentId of validatedRequest.documentIds) {
          const document = await storage.findById(documentId);
          if (document) {
            const docContent = document.content.text || document.content.markdown || '';
            documentContents.push(`# Document: ${document.title}\n\n${docContent}\n\n---\n`);
          }
        }

        if (documentContents.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'No valid documents found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
          );
        }

        content = documentContents.join('\n');
        validatedRequest.type = 'text';
      }
      // If single documentId provided, fetch content from storage
      else if (validatedRequest.documentId && !content) {
        const document = await storage.findById(validatedRequest.documentId);
        if (!document) {
          return new Response(
            JSON.stringify({ success: false, error: 'Document not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
          );
        }

        content = document.content.text || document.content.markdown || '';
        validatedRequest.type = document.contentType as any;
      }

      if (!content) {
        return new Response(
          JSON.stringify({ success: false, error: 'No content provided' }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      // For custom task type, use the instructions as the prompt
      if (validatedRequest.task.type === 'custom' && validatedRequest.task.instructions) {
        // Limit content to first 10000 chars for testing
        const limitedContent = content.length > 10000 ? content.substring(0, 10000) + "\n\n[Content truncated for analysis]" : content;

        const prompt = `Please analyze the following document and ${validatedRequest.task.instructions}

The document to analyze:
"""
${limitedContent}
"""

Please provide a detailed analysis focusing specifically on the content above:`;

        // Return streaming response for custom analysis
        const stream = new ReadableStream({
          async start(controller) {
            try {
              console.log('Starting LLM analysis with prompt length:', prompt.length);
              console.log('Prompt preview:', prompt.substring(0, 200) + '...');

              const result = await llmService.complete(prompt, {
                temperature: 0.7,
                maxTokens: 1000,
                topP: 0.9
              });
              console.log('LLM analysis completed, result length:', result?.length || 0);
              console.log('Result preview:', result?.substring(0, 200) || 'No result');

              // Send final result
              const chunk = new TextEncoder().encode(`data: ${JSON.stringify({
                type: 'result',
                content: result || 'No content generated'
              })}\n\n`);
              controller.enqueue(chunk);
              controller.close();

            } catch (error) {
              console.error('LLM analysis error:', error);
              const errorChunk = new TextEncoder().encode(`data: ${JSON.stringify({
                type: 'error',
                message: error instanceof Error ? error.message : 'Analysis failed'
              })}\n\n`);
              controller.enqueue(errorChunk);
              controller.close();
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
      }

      // For standard analysis tasks
      const result = await llmService.analyzeDocument({
        content,
        type: validatedRequest.type,
        task: validatedRequest.task,
        options: validatedRequest.options
      });

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );

    } catch (error) {
      console.error('LLM analyze error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Analysis failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  const handleProcess = async (req: Request): Promise<Response> => {
    try {
      if (!isInitialized) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'LLM service not initialized. Please check model configuration.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          }
        );
      }

      const body = await req.json();
      const validatedRequest = ProcessingRequestSchema.parse(body);

      // Fetch documents from storage
      const documents = [];
      for (const documentId of validatedRequest.documentIds) {
        const document = await storage.findById(documentId);
        if (document) {
          documents.push({
            id: documentId,
            content: document.content.text || document.content.markdown || '',
            type: document.contentType
          });
        }
      }

      if (documents.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No valid documents found' }),
          { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      const result = await llmService.processMultipleDocuments({
        documents,
        task: validatedRequest.task,
        options: validatedRequest.options
      });

      return new Response(
        JSON.stringify(result),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );

    } catch (error) {
      console.error('LLM process error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Processing failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  const handleQuery = async (req: Request): Promise<Response> => {
    try {
      if (!isInitialized) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'LLM service not initialized. Please check model configuration.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          }
        );
      }

      const body = await req.json();
      const validatedRequest = QueryRequestSchema.parse(body);

      let context = '';

      if (validatedRequest.documentIds && validatedRequest.documentIds.length > 0) {
        // Fetch context from specified documents
        const documents = [];
        for (const documentId of validatedRequest.documentIds) {
          const document = await storage.findById(documentId);
          if (document) {
            documents.push(document.content.text || document.content.markdown || '');
          }
        }
        context = documents.join('\n\n---\n\n').slice(0, validatedRequest.contextLimit);
      } else {
        // Use recent documents as context
        const recentDocuments = await storage.findAll({ limit: 5 });
        context = recentDocuments
          .map(doc => doc.content.text || doc.content.markdown || '')
          .join('\n\n---\n\n')
          .slice(0, validatedRequest.contextLimit);
      }

      const result = await llmService.queryDocuments(validatedRequest.query, context);

      return new Response(
        JSON.stringify({
          success: true,
          response: result,
          metadata: {
            contextLength: context.length,
            documentsUsed: validatedRequest.documentIds?.length || 'recent'
          }
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );

    } catch (error) {
      console.error('LLM query error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Query failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  const handleKnowledgeGraph = async (req: Request): Promise<Response> => {
    try {
      if (!isInitialized) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'LLM service not initialized. Please check model configuration.'
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
          }
        );
      }

      const body = await req.json();
      const { documentIds, content } = body;

      let textContent = content;

      if (documentIds && documentIds.length > 0) {
        // Generate knowledge graph from multiple documents
        const documents = [];
        for (const documentId of documentIds) {
          const document = await storage.findById(documentId);
          if (document) {
            documents.push(document.content.text || document.content.markdown || '');
          }
        }
        textContent = documents.join('\n\n---\n\n');
      }

      if (!textContent) {
        return new Response(
          JSON.stringify({ success: false, error: 'No content provided' }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      const knowledgeGraph = await llmService.generateKnowledgeGraph(textContent);

      if (!knowledgeGraph) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to generate knowledge graph' }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }}
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          knowledgeGraph
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type'
          }
        }
      );

    } catch (error) {
      console.error('Knowledge graph generation error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Knowledge graph generation failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  const handleStatus = async (req: Request): Promise<Response> => {
    try {
      const status = await llmService.getStatus();

      return new Response(
        JSON.stringify({
          success: true,
          status
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
      console.error('LLM status error:', error);

      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Status check failed'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        }
      );
    }
  };

  return {
    handleAnalyze,
    handleProcess,
    handleQuery,
    handleKnowledgeGraph,
    handleStatus
  };
};