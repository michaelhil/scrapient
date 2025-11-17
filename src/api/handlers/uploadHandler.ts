import type { Storage } from '../../storage/types';
import { validateFile } from '../validators/fileValidator';
import { processPDFFile, processJSONFile, processMarkdownFile, processPastedJSON, processPastedMarkdown, processPastedText } from './fileProcessors';
import { z } from 'zod';

const UploadResponseSchema = z.object({
  success: z.boolean(),
  uploaded: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    success: z.boolean(),
    error: z.string().optional()
  })),
  total: z.number(),
  successful: z.number(),
  failed: z.number()
});

export const createUploadHandler = (storage: Storage) => {
  const handleUpload = async (req: Request): Promise<Response> => {
    try {
      const formData = await req.formData();
      const files = formData.getAll('files') as File[];

      console.log(`Upload request received: ${files.length} files`);
      files.forEach((file, index) => {
        console.log(`File ${index + 1}: ${file.name} (${file.type}, ${file.size} bytes)`);
      });

      if (files.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'No files provided' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      const results = await Promise.allSettled(
        files.map(async (file) => {
          // Validate file
          const validation = validateFile(file);
          if (!validation.isValid) {
            throw new Error(validation.error);
          }

          const buffer = Buffer.from(await file.arrayBuffer());

          // Process file based on type
          let document: any;
          console.log(`Processing ${file.name} as ${validation.contentType}`);
          switch (validation.contentType) {
            case 'pdf':
              document = await processPDFFile(buffer, file.name);
              console.log(`PDF processing completed for ${file.name}`);
              break;
            case 'json':
              document = await processJSONFile(buffer, file.name, file.type);
              break;
            case 'markdown':
              document = await processMarkdownFile(buffer, file.name, file.type);
              break;
            default:
              throw new Error(`Unsupported file type: ${file.name}`);
          }

          const id = await storage.save(document);

          return {
            id,
            filename: file.name,
            success: true
          };
        })
      );

      const uploaded = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            id: '',
            filename: files[index].name,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
          };
        }
      });

      const successful = uploaded.filter(u => u.success).length;
      const failed = uploaded.filter(u => !u.success).length;

      return new Response(
        JSON.stringify({
          success: true,
          uploaded,
          total: files.length,
          successful,
          failed
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
      console.error('Upload error:', error);

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

  const handlePasteContent = async (req: Request): Promise<Response> => {
    try {
      const { title, contentType, content } = await req.json();

      if (!content || !contentType) {
        return new Response(
          JSON.stringify({ success: false, error: 'Content and content type are required' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }

      let document: any;
      if (contentType === 'json') {
        document = await processPastedJSON(content, title);
      } else if (contentType === 'md') {
        document = await processPastedMarkdown(content, title);
      } else if (contentType === 'text') {
        document = await processPastedText(content, title);
      } else {
        throw new Error(`Unsupported content type: ${contentType}`);
      }

      const id = await storage.save(document);

      return new Response(
        JSON.stringify({
          success: true,
          id,
          title: document.title,
          contentType
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
      console.error('Paste content error:', error);

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

  return { handleUpload, handlePasteContent };
};