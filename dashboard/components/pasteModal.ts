import { pasteContent } from '../core/api';
import { loadDocuments } from './documentList';

export const initializePasteModal = (): void => {
  const pasteContentBtn = document.getElementById('paste-content-btn');
  const pasteModal = document.getElementById('paste-modal');
  const pasteModalClose = document.getElementById('paste-modal-close');
  const pasteSubmitBtn = document.getElementById('paste-submit-btn');
  const pasteCancelBtn = document.getElementById('paste-cancel-btn');

  pasteContentBtn?.addEventListener('click', showPasteModal);
  pasteModalClose?.addEventListener('click', closePasteModal);
  pasteSubmitBtn?.addEventListener('click', handlePasteSubmit);
  pasteCancelBtn?.addEventListener('click', closePasteModal);

  pasteModal?.addEventListener('click', (event) => {
    if (event.target === pasteModal) {
      closePasteModal();
    }
  });
};

const showPasteModal = (): void => {
  const pasteModal = document.getElementById('paste-modal');
  if (pasteModal) {
    pasteModal.style.display = 'flex';
    // Clear form
    const titleInput = document.getElementById('content-title') as HTMLInputElement;
    const contentTextarea = document.getElementById('content-text') as HTMLTextAreaElement;
    if (titleInput) titleInput.value = '';
    if (contentTextarea) contentTextarea.value = '';
  }
};

const closePasteModal = (): void => {
  const pasteModal = document.getElementById('paste-modal');
  if (pasteModal) {
    pasteModal.style.display = 'none';
  }
};

const handlePasteSubmit = async (): Promise<void> => {
  const titleInput = document.getElementById('content-title') as HTMLInputElement;
  const contentTypeSelect = document.getElementById('content-type') as HTMLSelectElement;
  const contentTextarea = document.getElementById('content-text') as HTMLTextAreaElement;
  const submitBtn = document.getElementById('paste-submit-btn') as HTMLButtonElement;

  if (!titleInput || !contentTypeSelect || !contentTextarea || !submitBtn) {
    alert('Form elements not found');
    return;
  }

  const title = titleInput.value.trim();
  const contentType = contentTypeSelect.value;
  const content = contentTextarea.value.trim();

  if (!content) {
    alert('Please enter some content');
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    const result = await pasteContent(title, contentType, content);

    if (result.success) {
      closePasteModal();
      await loadDocuments(); // Refresh the documents list
      alert(`Content saved successfully as "${result.title}"`);
    } else {
      throw new Error('Failed to save content');
    }
  } catch (error) {
    console.error('Paste submission error:', error);
    alert(`Failed to save content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '💾 Save Content';
  }
};