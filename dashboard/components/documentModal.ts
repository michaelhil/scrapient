import type { ScrapedDocument } from '../core/state';
import { fetchDocument } from '../core/api';
import { markdownToHtml, escapeHtml } from '../core/utils';

export const initializeDocumentModal = (): void => {
  const modalClose = document.getElementById('modal-close');
  const modal = document.getElementById('document-modal');

  modalClose?.addEventListener('click', closeDocumentModal);

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeDocumentModal();
    }
  });

  // Tab functionality
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('tab-button')) {
      switchTab(target.dataset.tab || 'preview');
    }
  });
};

export const showDocumentModal = async (doc: ScrapedDocument): Promise<void> => {
  console.log('Opening document modal for:', doc.title, 'ID:', doc.id || doc._id);

  const modal = document.getElementById('document-modal');
  const titleElement = document.getElementById('modal-title');
  const previewIframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
  const dataContent = document.getElementById('data-content');

  if (!modal || !titleElement || !previewIframe || !dataContent) {
    console.error('Modal elements not found');
    return;
  }

  // Show modal
  modal.style.display = 'flex';

  // Set title
  titleElement.textContent = doc.title || 'Untitled Document';

  // Load full document data if needed
  let fullDoc = doc;
  try {
    fullDoc = await fetchDocument(doc.id || doc._id || '');
  } catch (error) {
    console.warn('Failed to fetch full document data, using provided data:', error);
  }

  // Set up preview based on content type
  setupPreviewContent(fullDoc, previewIframe);

  // Set up data content
  setupDataContent(fullDoc, dataContent);

  // Switch to preview tab by default
  switchTab('preview');
};

const setupPreviewContent = (doc: ScrapedDocument, iframe: HTMLIFrameElement): void => {
  console.log('Setting up preview content for document:', doc.title, 'type:', doc.contentType, 'content keys:', Object.keys(doc.content || {}));

  if (doc.contentType === 'pdf') {
    // Handle PDF documents
    const content = doc.content?.markdown || doc.content?.text || 'No content available';
    console.log('PDF content length:', content.length);
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            padding: 20px;
            max-width: none;
            margin: 0;
            background: white;
          }
          h1, h2, h3 { color: #1a202c; margin-top: 24px; margin-bottom: 12px; }
          p { margin-bottom: 12px; }
          code { background: #f1f5f9; padding: 2px 4px; border-radius: 3px; font-family: 'Courier New', monospace; }
          pre { background: #f1f5f9; padding: 12px; border-radius: 6px; overflow-x: auto; }
          .no-content { color: #64748b; font-style: italic; text-align: center; padding: 40px; }
        </style>
      </head>
      <body>
        <div class="content">
          ${content === 'No content available' ? '<div class="no-content">No content available</div>' :
            doc.content?.markdown ? markdownToHtml(content) : `<pre>${escapeHtml(content)}</pre>`}
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    iframe.src = blobUrl;
  } else if (doc.content?.html) {
    // Handle HTML content
    const blob = new Blob([doc.content.html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    iframe.src = blobUrl;
  } else if (doc.content?.markdown) {
    // Handle Markdown content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            padding: 20px;
            max-width: none;
            margin: 0;
            background: white;
          }
          h1, h2, h3 { color: #1a202c; margin-top: 24px; margin-bottom: 12px; }
          p { margin-bottom: 12px; }
          code { background: #f1f5f9; padding: 2px 4px; border-radius: 3px; font-family: 'Courier New', monospace; }
          pre { background: #f1f5f9; padding: 12px; border-radius: 6px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="content">
          ${markdownToHtml(doc.content.markdown)}
        </div>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    iframe.src = blobUrl;
  } else {
    // Handle plain text content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Courier New', monospace;
            line-height: 1.4;
            padding: 20px;
            margin: 0;
            background: #f8f9fa;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <pre>${escapeHtml(doc.content?.text || 'No content available')}</pre>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    iframe.src = blobUrl;
  }
};

const setupDataContent = (doc: ScrapedDocument, dataElement: HTMLElement): void => {
  console.log('Setting up data content for document:', doc.title);

  if (doc.content?.json) {
    // Handle JSON content with expandable fields
    dataElement.innerHTML = '';
    const jsonContainer = document.createElement('div');
    jsonContainer.className = 'data-json-inline';

    try {
      const formattedJson = JSON.stringify(doc.content.json, null, 2);
      jsonContainer.textContent = formattedJson;
      dataElement.appendChild(jsonContainer);
    } catch (error) {
      jsonContainer.textContent = 'Error formatting JSON data';
      dataElement.appendChild(jsonContainer);
    }
  } else {
    // Handle other content types
    const fullData = {
      id: doc.id || doc._id,
      url: doc.url,
      domain: doc.domain,
      title: doc.title,
      scrapedAt: doc.scrapedAt,
      contentType: doc.contentType,
      content: {
        ...doc.content,
        fileData: doc.content?.fileData ? '[Binary Data]' : undefined
      }
    };

    dataElement.innerHTML = '';
    const jsonContainer = document.createElement('div');
    jsonContainer.className = 'data-json-inline';

    try {
      const formattedJson = JSON.stringify(fullData, null, 2);
      jsonContainer.textContent = formattedJson;
      dataElement.appendChild(jsonContainer);
    } catch (error) {
      jsonContainer.textContent = 'Error formatting document data';
      dataElement.appendChild(jsonContainer);
    }
  }
};

const switchTab = (tabName: string): void => {
  // Update tab buttons
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });

  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  activeButton?.classList.add('active');

  // Update tab panels
  const tabPanels = document.querySelectorAll('.tab-panel');
  tabPanels.forEach(panel => {
    panel.classList.remove('active');
  });

  const activePanel = document.getElementById(`${tabName}-tab`);
  activePanel?.classList.add('active');
};

export const closeDocumentModal = (): void => {
  const modal = document.getElementById('document-modal');
  if (modal) {
    modal.style.display = 'none';

    // Clean up blob URLs
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
    if (iframe && iframe.src.startsWith('blob:')) {
      URL.revokeObjectURL(iframe.src);
      iframe.src = '';
    }
  }
};