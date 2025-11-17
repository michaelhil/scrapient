import { initializeUploadManager } from './components/uploadManager';
import { initializeDocumentList, loadDocuments } from './components/documentList';
import { initializeDocumentModal, closeDocumentModal } from './components/documentModal';
import { initializePasteModal } from './components/pasteModal';

const initializeEventListeners = (): void => {
  // Initialize all component event listeners
  initializeUploadManager();
  initializeDocumentList();
  initializeDocumentModal();
  initializePasteModal();

  // Global keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // Close paste modal first (if open), then document modal
      const pasteModalElement = document.getElementById('paste-modal');
      if (pasteModalElement && pasteModalElement.style.display !== 'none') {
        const { closePasteModal } = require('./components/pasteModal');
        closePasteModal();
      } else {
        closeDocumentModal();
      }
    }
  });
};

const initialize = async (): Promise<void> => {
  initializeEventListeners();
  await loadDocuments();
};

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', initialize);