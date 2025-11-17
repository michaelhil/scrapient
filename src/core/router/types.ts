import type { Storage } from '../../storage/types';

export interface AppHandlers {
  scrapeHandlers: {
    handleScrape: (req: Request) => Promise<Response>;
    handlePDFScrape: (req: Request) => Promise<Response>;
    handleDoclingPDFScrape: (req: Request) => Promise<Response>;
  };
  documentHandlers: {
    handleListDocuments: (req: Request) => Promise<Response>;
    handleGetDocument: (req: Request) => Promise<Response>;
    handleDeleteDocument: (req: Request) => Promise<Response>;
    handleDeleteMany: (req: Request) => Promise<Response>;
  };
  uploadHandlers: {
    handleUpload: (req: Request) => Promise<Response>;
    handlePasteContent: (req: Request) => Promise<Response>;
  };
  storage: Storage;
}

export interface Router {
  (req: Request): Promise<Response>;
}