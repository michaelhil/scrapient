import { state } from '../core/state';
import { fetchDocuments, deleteDocument, deleteDocuments } from '../core/api';
import { formatDate, getDocumentIcon } from '../core/utils';

export const initializeDocumentList = (): void => {
  const selectAllBtn = document.getElementById('select-all-btn');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const documentsList = document.getElementById('documents-list');

  selectAllBtn?.addEventListener('click', toggleSelectAll);
  deleteSelectedBtn?.addEventListener('click', deleteSelectedDocuments);
  refreshBtn?.addEventListener('click', loadDocuments);
  documentsList?.addEventListener('click', handleDocumentClick);
  documentsList?.addEventListener('change', handleCheckboxChange);
};

export const loadDocuments = async (): Promise<void> => {
  try {
    const documentsListElement = document.getElementById('documents-list');
    if (documentsListElement) {
      documentsListElement.innerHTML = '<div class="loading">Loading documents...</div>';
    }

    const { documents, totalCount } = await fetchDocuments(state.currentPage, state.pageSize);

    state.documents = documents;
    state.totalCount = totalCount;
    state.selectedIds.clear();

    renderDocuments();
    updatePagination();
    updateDocumentCount();
    updateBulkActions();
  } catch (error) {
    console.error('Failed to load documents:', error);
    const documentsListElement = document.getElementById('documents-list');
    if (documentsListElement) {
      documentsListElement.innerHTML = '<div class="loading">Failed to load documents</div>';
    }
  }
};

const renderDocuments = (): void => {
  const documentsListElement = document.getElementById('documents-list');
  if (!documentsListElement) return;

  if (state.documents.length === 0) {
    documentsListElement.innerHTML = '<div class="loading">No documents found</div>';
    return;
  }

  documentsListElement.innerHTML = state.documents.map(doc => {
    const docId = doc.id || doc._id || '';
    const isSelected = state.selectedIds.has(docId);

    return `
      <div class="document-item ${isSelected ? 'selected' : ''}" data-id="${docId}">
        <input type="checkbox" class="document-checkbox" ${isSelected ? 'checked' : ''}>
        <div class="document-info">
          <div class="document-title">
            ${getDocumentIcon(doc.contentType)} ${doc.title}
          </div>
          <div class="document-meta">
            <span>Domain: ${doc.domain}</span>
            <span>Type: ${doc.contentType}</span>
            <span>Scraped: ${formatDate(doc.scrapedAt)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
};

const handleDocumentClick = async (event: Event): Promise<void> => {
  const target = event.target as HTMLElement;

  if (target.type === 'checkbox') {
    return; // Let checkbox handler deal with this
  }

  const documentItem = target.closest('.document-item') as HTMLElement;
  if (!documentItem) return;

  const docId = documentItem.dataset.id;
  if (!docId) return;

  try {
    const doc = state.documents.find(d => (d.id || d._id) === docId);
    if (!doc) {
      throw new Error('Document not found');
    }

    // Import and use document modal
    const { showDocumentModal } = await import('./documentModal');
    await showDocumentModal(doc);
  } catch (error) {
    console.error('Failed to load document:', error);
    alert('Failed to load document details.');
  }
};

const handleCheckboxChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;

  if (target.type !== 'checkbox') return;

  const documentItem = target.closest('.document-item') as HTMLElement;
  if (!documentItem) return;

  const docId = documentItem.dataset.id;
  if (!docId) return;

  if (target.checked) {
    state.selectedIds.add(docId);
    documentItem.classList.add('selected');
  } else {
    state.selectedIds.delete(docId);
    documentItem.classList.remove('selected');
  }

  updateBulkActions();
};

const toggleSelectAll = (): void => {
  const checkboxes = document.querySelectorAll('.document-checkbox') as NodeListOf<HTMLInputElement>;
  const allSelected = state.selectedIds.size === state.documents.length;

  if (allSelected) {
    // Deselect all
    state.selectedIds.clear();
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
      const documentItem = checkbox.closest('.document-item') as HTMLElement;
      documentItem?.classList.remove('selected');
    });
  } else {
    // Select all
    state.documents.forEach(doc => {
      const docId = doc.id || doc._id || '';
      state.selectedIds.add(docId);
    });

    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      const documentItem = checkbox.closest('.document-item') as HTMLElement;
      documentItem?.classList.add('selected');
    });
  }

  updateBulkActions();
};

const deleteSelectedDocuments = async (): Promise<void> => {
  if (state.selectedIds.size === 0) return;

  const confirmed = confirm(
    `Are you sure you want to delete ${state.selectedIds.size} document(s)? This action cannot be undone.`
  );

  if (!confirmed) return;

  try {
    const idsArray = Array.from(state.selectedIds);
    await deleteDocuments(idsArray);

    // Reload documents
    await loadDocuments();

    alert(`${idsArray.length} document(s) deleted successfully.`);
  } catch (error) {
    console.error('Failed to delete documents:', error);
    alert('Failed to delete documents. Please try again.');
  }
};

const updateBulkActions = (): void => {
  const selectAllBtn = document.getElementById('select-all-btn');
  const deleteSelectedBtn = document.getElementById('delete-selected-btn') as HTMLButtonElement;

  if (selectAllBtn) {
    const allSelected = state.selectedIds.size === state.documents.length && state.documents.length > 0;
    selectAllBtn.textContent = allSelected ? '☐ Deselect All' : '☑️ Select All';
  }

  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = state.selectedIds.size === 0;
  }
};

const updateDocumentCount = (): void => {
  const documentCountElement = document.getElementById('document-count');
  if (documentCountElement) {
    documentCountElement.textContent = `${state.totalCount} documents`;
  }
};

const updatePagination = (): void => {
  const paginationElement = document.getElementById('pagination');
  const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
  const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
  const pageInfo = document.getElementById('page-info');

  if (!paginationElement) return;

  const totalPages = Math.ceil(state.totalCount / state.pageSize);

  if (totalPages <= 1) {
    paginationElement.style.display = 'none';
    return;
  }

  paginationElement.style.display = 'flex';

  if (prevBtn) {
    prevBtn.disabled = state.currentPage === 1;
    prevBtn.onclick = () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        loadDocuments();
      }
    };
  }

  if (nextBtn) {
    nextBtn.disabled = state.currentPage >= totalPages;
    nextBtn.onclick = () => {
      if (state.currentPage < totalPages) {
        state.currentPage++;
        loadDocuments();
      }
    };
  }

  if (pageInfo) {
    pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
  }
};