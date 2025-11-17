export interface ScrapedDocument {
  id?: string;
  _id?: string;
  url: string;
  domain: string;
  title: string;
  scrapedAt: string;
  contentType: string;
  content: {
    html?: string;
    text: string;
    markdown?: string;
    json?: any;
    metadata: Record<string, any>;
    images?: string[];
    fileData?: ArrayBuffer;
  };
}

export interface UploadResult {
  id: string;
  filename: string;
  success: boolean;
  error?: string;
}

export interface UploadResponse {
  success: boolean;
  uploaded: UploadResult[];
  total: number;
  successful: number;
  failed: number;
}

export interface DocumentState {
  documents: ScrapedDocument[];
  selectedIds: Set<string>;
  currentPage: number;
  pageSize: number;
  totalCount: number;
}

export interface FileUploadState {
  files: Map<string, {
    file: File;
    status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
    progress: number;
    currentActivity?: string;
    pagesProcessed?: number;
    totalPages?: number;
    error?: string;
  }>;
  overallProgress: number;
  isUploading: boolean;
  completedCount: number;
  failedCount: number;
}

export const state: DocumentState = {
  documents: [],
  selectedIds: new Set(),
  currentPage: 1,
  pageSize: 50,
  totalCount: 0
};

export const uploadState: FileUploadState = {
  files: new Map(),
  overallProgress: 0,
  isUploading: false,
  completedCount: 0,
  failedCount: 0
};