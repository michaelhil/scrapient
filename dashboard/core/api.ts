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
  const response = await fetch(`/api/documents/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  return response.json();
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

export const uploadFiles = async (files: FileList): Promise<UploadResponse> => {
  const formData = new FormData();

  for (const file of Array.from(files)) {
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