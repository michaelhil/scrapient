export interface ExtractedContent {
  url: string;
  domain: string;
  title: string;
  content: {
    html: string;
    text: string;
    markdown: string;
    metadata: Record<string, any>;
    images: string[];
  };
  scrapedAt: Date;
  contentType: 'webpage';
}

export interface PDFScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  success: boolean;
  id?: string;
  error?: string;
}

export interface NotificationOptions {
  message: string;
  type: 'info' | 'success' | 'error';
  duration?: number;
}