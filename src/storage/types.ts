export interface ScrapedDocument {
  _id?: string;
  id: string;
  url: string;
  domain: string;
  title: string;
  scrapedAt: Date;
  contentType: 'webpage' | 'pdf' | 'excel' | 'image' | 'json' | 'markdown' | 'text';
  content: {
    html?: string;
    text: string;
    markdown?: string;
    metadata: Record<string, any>;
    images?: string[];
    fileData?: Buffer;
    structure?: any; // JSON document structure
  };
  tags?: string[];
  processed?: boolean;
  error?: string;
}

export interface Storage {
  save: (document: Omit<ScrapedDocument, 'id'>) => Promise<string>;
  findById: (id: string) => Promise<ScrapedDocument | null>;
  findAll: (options?: { limit?: number; offset?: number }) => Promise<ScrapedDocument[]>;
  deleteById: (id: string) => Promise<boolean>;
  deleteMany: (ids: string[]) => Promise<number>;
  close: () => Promise<void>;
}