import type { ScrapedDocument, UploadResponse } from './state';

export const fetchDocuments = async (page: number = 1, pageSize: number = 50): Promise<{documents: ScrapedDocument[], totalCount: number}> => {
  const response = await fetch(`/api/documents?page=${page}&pageSize=${pageSize}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch documents: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    documents: data.documents || [],
    totalCount: data.totalCount || 0
  };
};

export const fetchDocument = async (id: string): Promise<ScrapedDocument> => {
  console.log(`Fetching document with ID: ${id}`);
  const response = await fetch(`/api/documents/${id}`);

  if (!response.ok) {
    console.error(`Failed to fetch document ${id}: ${response.status} ${response.statusText}`);
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  const result = await response.json();
  console.log(`API response:`, result);

  if (!result.success || !result.document) {
    console.error('Invalid API response structure:', result);
    throw new Error('Invalid API response structure');
  }

  console.log(`Successfully fetched document: ${result.document.title}`);
  return result.document;
};

export const deleteDocument = async (id: string): Promise<void> => {
  const response = await fetch(`/api/documents/${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }
};

export const deleteDocuments = async (ids: string[]): Promise<void> => {
  const response = await fetch('/api/documents', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids })
  });

  if (!response.ok) {
    throw new Error(`Failed to delete documents: ${response.statusText}`);
  }
};

export const uploadFiles = async (files: FileList | File[]): Promise<UploadResponse> => {
  const formData = new FormData();

  const fileArray = Array.isArray(files) ? files : Array.from(files);
  for (const file of fileArray) {
    formData.append('files', file);
  }

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
};

export const pasteContent = async (title: string, contentType: string, content: string): Promise<{success: boolean, id: string, title: string}> => {
  const response = await fetch('/api/paste-content', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title || undefined,
      contentType,
      content,
    }),
  });

  if (!response.ok) {
    throw new Error(`Paste failed: ${response.statusText}`);
  }

  return response.json();
};

export const analyzeDocuments = async (
  documentIds: string[],
  prompt: string,
  onProgress?: (progress: number, status: string) => void
): Promise<string> => {
  const response = await fetch('/api/llm/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentIds,
      task: {
        type: 'custom',
        instructions: prompt
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM analysis failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let result = '';

  if (!reader) {
    throw new Error('Response body not readable');
  }

  try {
    let progressCounter = 20; // Start at 20% after request sent

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress') {
              const progress = Math.min(20 + (data.progress * 0.7), 90); // Scale to 20-90%
              onProgress?.(progress, data.status || 'Processing...');
              progressCounter = progress;
            } else if (data.type === 'result') {
              result = data.content;
              onProgress?.(100, 'Analysis complete!');
            } else if (data.type === 'error') {
              throw new Error(data.message || 'LLM analysis failed');
            }
          } catch (parseError) {
            // Ignore JSON parse errors for non-JSON chunks
            continue;
          }
        } else if (line.trim()) {
          // Handle non-SSE responses (fallback)
          result += line;
        }
      }

      // Update progress during streaming
      if (progressCounter < 80) {
        progressCounter += 5;
        onProgress?.(progressCounter, 'Analyzing documents...');
      }
    }

    return result || 'Analysis completed successfully.';

  } finally {
    reader.releaseLock();
  }
};

export const getLLMStatus = async (): Promise<{available: boolean, model?: string, error?: string}> => {
  try {
    const response = await fetch('/api/llm/status');

    if (!response.ok) {
      return {
        available: false,
        error: `Status check failed: ${response.statusText}`
      };
    }

    return await response.json();
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};