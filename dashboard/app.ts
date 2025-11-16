interface ScrapedDocument {
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
    metadata: Record<string, any>;
    images?: string[];
  };
}

interface DocumentState {
  documents: ScrapedDocument[];
  selectedIds: Set<string>;
  currentPage: number;
  pageSize: number;
  totalCount: number;
}

const state: DocumentState = {
  documents: [],
  selectedIds: new Set(),
  currentPage: 1,
  pageSize: 50,
  totalCount: 0
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getDocumentIcon = (contentType: string): string => {
  switch (contentType) {
    case 'pdf': return '📑';
    case 'excel': return '📊';
    case 'image': return '🖼️';
    default: return '📄';
  }
};

const loadDocuments = async (): Promise<void> => {
  try {
    const offset = (state.currentPage - 1) * state.pageSize;
    const response = await fetch(`/api/documents?limit=${state.pageSize}&offset=${offset}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      state.documents = data.documents || [];
      state.totalCount = data.documents?.length || 0;
      renderDocuments();
      updateUI();
    } else {
      throw new Error(data.error || 'Failed to load documents');
    }
  } catch (error) {
    console.error('Failed to load documents:', error);
    const listElement = document.getElementById('documents-list');
    if (listElement) {
      listElement.innerHTML = '<div class="loading">❌ Failed to load documents</div>';
    }
  }
};

const renderDocuments = (): void => {
  const listElement = document.getElementById('documents-list');
  if (!listElement) return;

  if (state.documents.length === 0) {
    listElement.innerHTML = '<div class="loading">No documents found. Start scraping pages with the browser extension!</div>';
    return;
  }

  const documentsHTML = state.documents.map(doc => {
    const docId = doc.id || doc._id;
    const isSelected = state.selectedIds.has(docId);
    const icon = getDocumentIcon(doc.contentType);
    const formattedDate = formatDate(doc.scrapedAt);

    return `
      <div class="document-item ${isSelected ? 'selected' : ''}" data-id="${docId}">
        <input type="checkbox" class="document-checkbox" ${isSelected ? 'checked' : ''} data-id="${docId}">
        <div class="document-info">
          <div class="document-title">${icon} ${doc.title || 'Untitled'}</div>
          <div class="document-meta">
            <span>🌐 ${doc.domain}</span>
            <span>📅 ${formattedDate}</span>
            <span>📄 ${doc.contentType}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  listElement.innerHTML = documentsHTML;
};

const handleDocumentClick = (event: Event): void => {
  const target = event.target as HTMLElement;
  const documentItem = target.closest('.document-item') as HTMLElement;

  if (!documentItem || target.matches('input[type="checkbox"]')) return;

  const documentId = documentItem.dataset.id;
  if (documentId) {
    openDocumentModal(documentId);
  }
};

const handleCheckboxChange = (event: Event): void => {
  const checkbox = event.target as HTMLInputElement;
  if (!checkbox.matches('input[type="checkbox"]')) return;

  const documentId = checkbox.dataset.id;
  if (!documentId) return;

  if (checkbox.checked) {
    state.selectedIds.add(documentId);
  } else {
    state.selectedIds.delete(documentId);
  }

  updateSelection();
  updateUI();
};

const updateSelection = (): void => {
  const documentItems = document.querySelectorAll('.document-item');
  documentItems.forEach(item => {
    const element = item as HTMLElement;
    const documentId = element.dataset.id;
    const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement;

    if (documentId && state.selectedIds.has(documentId)) {
      element.classList.add('selected');
      checkbox.checked = true;
    } else {
      element.classList.remove('selected');
      checkbox.checked = false;
    }
  });
};

const toggleSelectAll = (): void => {
  const allSelected = state.documents.every(doc => {
    const docId = doc.id || doc._id;
    return state.selectedIds.has(docId);
  });

  if (allSelected) {
    state.documents.forEach(doc => {
      const docId = doc.id || doc._id;
      state.selectedIds.delete(docId);
    });
  } else {
    state.documents.forEach(doc => {
      const docId = doc.id || doc._id;
      state.selectedIds.add(docId);
    });
  }

  updateSelection();
  updateUI();
};

const deleteSelectedDocuments = async (): Promise<void> => {
  if (state.selectedIds.size === 0) return;

  const confirmed = confirm(`Delete ${state.selectedIds.size} selected documents? This action cannot be undone.`);
  if (!confirmed) return;

  try {
    const ids = Array.from(state.selectedIds);
    const response = await fetch('/api/documents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.success) {
      state.selectedIds.clear();
      await loadDocuments();
    } else {
      throw new Error(data.error || 'Failed to delete documents');
    }
  } catch (error) {
    console.error('Delete failed:', error);
    alert('Failed to delete documents. Please try again.');
  }
};

const openDocumentModal = async (documentId: string): Promise<void> => {
  try {
    const response = await fetch(`/api/documents/${documentId}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to load document');
    }

    const doc = data.document;
    showDocumentModal(doc);
  } catch (error) {
    console.error('Failed to load document:', error);
    alert('Failed to load document details.');
  }
};

const showDocumentModal = (doc: ScrapedDocument): void => {
  const modal = document.getElementById('document-modal');
  const titleElement = document.getElementById('modal-title');
  const previewIframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
  const dataContent = document.getElementById('data-content');

  if (!modal || !titleElement || !previewIframe || !dataContent) return;

  titleElement.textContent = doc.title || 'Untitled Document';

  if (doc.content.html) {
    const blob = new Blob([doc.content.html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    previewIframe.src = blobUrl;
  } else {
    previewIframe.src = 'about:blank';
  }

  // Show the raw database object with inline expandable sections
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  // Helper to truncate text for preview
  const truncate = (str: string, length: number = 80): string => {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
  };

  // Build the JSON structure with inline expandable HTML and text
  const buildDataJSON = (): string => {
    // Create a copy of the document with cleaned content for replacement
    const cleanDoc = JSON.parse(JSON.stringify(doc));
    if (cleanDoc.content.html) cleanDoc.content.html = "HTML_PLACEHOLDER";
    if (cleanDoc.content.text) cleanDoc.content.text = "TEXT_PLACEHOLDER";
    if (cleanDoc.content.markdown) cleanDoc.content.markdown = "MARKDOWN_PLACEHOLDER";
    if (cleanDoc.content.metadata) cleanDoc.content.metadata = "METADATA_PLACEHOLDER";
    if (cleanDoc.content.images && cleanDoc.content.images.length > 0) cleanDoc.content.images = "IMAGES_PLACEHOLDER";

    // Build base JSON structure
    let json = JSON.stringify(cleanDoc, null, 2);

    // Replace HTML placeholder with expandable version
    if (doc.content.html) {
      const htmlPreview = truncate(doc.content.html.replace(/\s+/g, ' '), 60);
      const htmlFull = doc.content.html;
      const htmlReplacement = `<span class="expandable-field" data-field="html"><span class="expand-arrow">▶</span>"html": "<span class="content-preview">${escapeHtml(htmlPreview)}</span><span class="content-full" style="display: none;">${escapeHtml(htmlFull)}</span>"</span>`;

      json = json.replace(
        /"html": "HTML_PLACEHOLDER"/,
        htmlReplacement
      );
    }

    // Replace text placeholder with expandable version
    if (doc.content.text) {
      const textPreview = truncate(doc.content.text.replace(/\s+/g, ' '), 60);
      const textFull = doc.content.text;
      const textReplacement = `<span class="expandable-field" data-field="text"><span class="expand-arrow">▶</span>"text": "<span class="content-preview">${escapeHtml(textPreview)}</span><span class="content-full" style="display: none;">${escapeHtml(textFull)}</span>"</span>`;

      json = json.replace(
        /"text": "TEXT_PLACEHOLDER"/,
        textReplacement
      );
    }

    // Replace markdown placeholder with expandable version
    if (doc.content.markdown) {
      const markdownPreview = truncate(doc.content.markdown.replace(/\s+/g, ' '), 60);
      const markdownFull = doc.content.markdown;
      const markdownReplacement = `<span class="expandable-field" data-field="markdown"><span class="expand-arrow">▶</span>"markdown": "<span class="content-preview">${escapeHtml(markdownPreview)}</span><span class="content-full" style="display: none;">${escapeHtml(markdownFull)}</span>"</span>`;

      json = json.replace(
        /"markdown": "MARKDOWN_PLACEHOLDER"/,
        markdownReplacement
      );
    }

    // Replace metadata placeholder with expandable version
    if (doc.content.metadata && Object.keys(doc.content.metadata).length > 0) {
      const metadataStr = JSON.stringify(doc.content.metadata, null, 2);
      const metadataPreview = `{${Object.keys(doc.content.metadata).length} keys}`;
      const metadataReplacement = `<span class="expandable-field" data-field="metadata"><span class="expand-arrow">▶</span>"metadata": <span class="content-preview">${escapeHtml(metadataPreview)}</span><span class="content-full" style="display: none;">${escapeHtml(metadataStr)}</span></span>`;

      json = json.replace(
        /"metadata": "METADATA_PLACEHOLDER"/,
        metadataReplacement
      );
    }

    // Replace images placeholder with expandable version
    if (doc.content.images && doc.content.images.length > 0) {
      const imagesStr = JSON.stringify(doc.content.images, null, 2);
      const imagesPreview = `[${doc.content.images.length} images]`;
      const imagesReplacement = `<span class="expandable-field" data-field="images"><span class="expand-arrow">▶</span>"images": <span class="content-preview">${escapeHtml(imagesPreview)}</span><span class="content-full" style="display: none;">${escapeHtml(imagesStr)}</span></span>`;

      json = json.replace(
        /"images": "IMAGES_PLACEHOLDER"/,
        imagesReplacement
      );
    }

    return json;
  };

  const dataHTML = `<pre class="data-json-inline">${buildDataJSON()}</pre>`;
  dataContent.innerHTML = dataHTML;

  // Set up inline expand/collapse listeners
  setupInlineExpandListeners();

  // Set up tab switching for this modal
  setupModalTabListeners();

  modal.style.display = 'flex';
};

const setupModalTabListeners = (): void => {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true)); // Remove existing listeners
  });

  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', (event) => {
      const button = event.target as HTMLElement;
      const tabName = button.dataset.tab;
      if (tabName) {
        switchTab(tabName);
      }
    });
  });
};

const setupInlineExpandListeners = (): void => {
  document.querySelectorAll('.expandable-field').forEach(field => {
    field.addEventListener('click', (event) => {
      const element = event.currentTarget as HTMLElement;
      const arrow = element.querySelector('.expand-arrow') as HTMLElement;
      const preview = element.querySelector('.content-preview') as HTMLElement;
      const full = element.querySelector('.content-full') as HTMLElement;

      if (!arrow || !preview || !full) return;

      if (full.style.display === 'none') {
        // Expand
        preview.style.display = 'none';
        full.style.display = 'inline';
        arrow.textContent = '▼';
        element.classList.add('expanded');
      } else {
        // Collapse
        preview.style.display = 'inline';
        full.style.display = 'none';
        arrow.textContent = '▶';
        element.classList.remove('expanded');
      }
    });
  });
};

const closeDocumentModal = (): void => {
  const modal = document.getElementById('document-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

const switchTab = (tabName: string): void => {
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.remove('active');
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
  const activePanel = document.getElementById(`${tabName}-tab`);

  if (activeButton && activePanel) {
    activeButton.classList.add('active');
    activePanel.classList.add('active');
  }
};

const updateUI = (): void => {
  const countElement = document.getElementById('document-count');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn') as HTMLButtonElement;

  if (countElement) {
    const count = state.documents.length;
    countElement.textContent = `${count} document${count !== 1 ? 's' : ''}`;
  }

  if (selectAllBtn) {
    const allSelected = state.documents.length > 0 && state.documents.every(doc => {
      const docId = doc.id || doc._id;
      return state.selectedIds.has(docId);
    });
    selectAllBtn.textContent = allSelected ? '☐ Deselect All' : '☑️ Select All';
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = state.selectedIds.size === 0;
  }
};

const initializeEventListeners = (): void => {
  const selectAllBtn = document.getElementById('select-all-btn');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const modalClose = document.getElementById('modal-close');
  const modal = document.getElementById('document-modal');
  const documentsList = document.getElementById('documents-list');

  selectAllBtn?.addEventListener('click', toggleSelectAll);
  deleteSelectedBtn?.addEventListener('click', deleteSelectedDocuments);
  refreshBtn?.addEventListener('click', loadDocuments);
  modalClose?.addEventListener('click', closeDocumentModal);

  documentsList?.addEventListener('click', handleDocumentClick);
  documentsList?.addEventListener('change', handleCheckboxChange);

  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeDocumentModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDocumentModal();
    }
  });
};

const initialize = async (): Promise<void> => {
  initializeEventListeners();
  await loadDocuments();
};

document.addEventListener('DOMContentLoaded', initialize);