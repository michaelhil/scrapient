import { initializeUploadManager } from './components/uploadManager';
import { initializeDocumentList, loadDocuments } from './components/documentList';
import { initializeDocumentModal, closeDocumentModal } from './components/documentModal';
import { initializePasteModal } from './components/pasteModal';
import { initializeAnalysisModal, hideAnalysisModal } from './components/analysisModal';

const initializeEventListeners = (): void => {
  // Initialize all component event listeners
  initializeUploadManager();
  initializeDocumentList();
  initializeDocumentModal();
  initializePasteModal();
  initializeAnalysisModal();

  // Global keyboard shortcuts
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      // Close analysis modal first, then paste modal, then document modal
      const analysisModalElement = document.getElementById('analysis-modal');
      const pasteModalElement = document.getElementById('paste-modal');

      if (analysisModalElement && analysisModalElement.style.display !== 'none') {
        hideAnalysisModal();
      } else if (pasteModalElement && pasteModalElement.style.display !== 'none') {
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