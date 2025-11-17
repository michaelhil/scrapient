import { state } from '../core/state';
import { analyzeDocuments, pasteContent } from '../core/api';

interface AnalysisState {
  isAnalyzing: boolean;
  progress: number;
  status: string;
  results: string | null;
  selectedDocuments: string[];
}

const analysisState: AnalysisState = {
  isAnalyzing: false,
  progress: 0,
  status: '',
  results: null,
  selectedDocuments: []
};

export const initializeAnalysisModal = (): void => {
  const modal = document.getElementById('analysis-modal');
  const closeBtn = document.getElementById('analysis-modal-close');
  const cancelBtn = document.getElementById('analysis-cancel-btn');
  const submitBtn = document.getElementById('analysis-submit-btn');
  const closeResultsBtn = document.getElementById('analysis-close-btn');

  closeBtn?.addEventListener('click', hideAnalysisModal);
  cancelBtn?.addEventListener('click', handleCancel);
  submitBtn?.addEventListener('click', handleSubmit);
  closeResultsBtn?.addEventListener('click', hideAnalysisModal);

  // Close modal when clicking outside
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      hideAnalysisModal();
    }
  });
};

export const showAnalysisModal = (selectedIds: string[]): void => {
  const modal = document.getElementById('analysis-modal');
  const selectedCountElement = document.getElementById('analysis-selected-count');
  const promptTextarea = document.getElementById('analysis-prompt') as HTMLTextAreaElement;
  const storeToggle = document.getElementById('store-as-document') as HTMLInputElement;

  if (!modal || !selectedCountElement) return;

  // Reset state
  analysisState.selectedDocuments = [...selectedIds];
  analysisState.isAnalyzing = false;
  analysisState.progress = 0;
  analysisState.status = '';
  analysisState.results = null;

  // Update UI
  selectedCountElement.textContent = `${selectedIds.length} document${selectedIds.length === 1 ? '' : 's'} selected`;
  promptTextarea.value = '';
  storeToggle.checked = true;

  resetModalState();
  modal.style.display = 'flex';
};

export const hideAnalysisModal = (): void => {
  const modal = document.getElementById('analysis-modal');
  if (modal) {
    modal.style.display = 'none';
  }

  // Reset state if not currently analyzing
  if (!analysisState.isAnalyzing) {
    resetModalState();
  }
};

const handleCancel = (): void => {
  if (analysisState.isAnalyzing) {
    // TODO: Implement analysis cancellation
    return;
  }

  hideAnalysisModal();
};

const handleSubmit = async (): Promise<void> => {
  const promptTextarea = document.getElementById('analysis-prompt') as HTMLTextAreaElement;
  const storeToggle = document.getElementById('store-as-document') as HTMLInputElement;

  if (!promptTextarea || !storeToggle) return;

  const prompt = promptTextarea.value.trim();
  if (!prompt) {
    alert('Please enter an analysis prompt.');
    return;
  }

  if (analysisState.selectedDocuments.length === 0) {
    alert('No documents selected for analysis.');
    return;
  }

  try {
    analysisState.isAnalyzing = true;
    updateModalState('analyzing');

    const shouldStore = storeToggle.checked;

    // Start analysis
    updateProgress(10, 'Preparing documents...');

    const result = await analyzeDocuments(
      analysisState.selectedDocuments,
      prompt,
      (progress: number, status: string) => updateProgress(progress, status)
    );

    updateProgress(90, 'Processing results...');

    if (shouldStore) {
      // Store as new document
      const title = `Analysis: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`;
      const timestamp = new Date().toISOString();
      const analysisContent = `# LLM Analysis Results

**Prompt:** ${prompt}
**Documents Analyzed:** ${analysisState.selectedDocuments.length}
**Generated:** ${new Date().toLocaleString()}

---

${result}`;

      await pasteContent(title, 'text', analysisContent);

      updateProgress(100, 'Analysis complete! Document saved.');

      // Refresh document list to show new analysis document
      const { loadDocuments } = await import('./documentList');
      await loadDocuments();

      setTimeout(() => {
        analysisState.isAnalyzing = false;
        hideAnalysisModal();
      }, 1500);

    } else {
      // Show results in modal
      updateProgress(100, 'Analysis complete!');
      analysisState.results = result;
      updateModalState('results');
    }

  } catch (error) {
    console.error('Analysis failed:', error);
    updateProgress(0, `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

    setTimeout(() => {
      analysisState.isAnalyzing = false;
      updateModalState('form');
    }, 2000);
  }
};

const updateProgress = (progress: number, status: string): void => {
  analysisState.progress = progress;
  analysisState.status = status;

  const progressFill = document.getElementById('analysis-progress-fill');
  const progressPercentage = document.querySelector('.analysis-progress .progress-percentage');
  const progressStatus = document.getElementById('analysis-progress-status');

  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }

  if (progressPercentage) {
    progressPercentage.textContent = `${Math.round(progress)}%`;
  }

  if (progressStatus) {
    progressStatus.textContent = status;
  }
};

const updateModalState = (state: 'form' | 'analyzing' | 'results'): void => {
  const formElements = {
    prompt: document.getElementById('analysis-prompt'),
    toggle: document.getElementById('store-as-document'),
    submitBtn: document.getElementById('analysis-submit-btn'),
    cancelBtn: document.getElementById('analysis-cancel-btn'),
    closeBtn: document.getElementById('analysis-close-btn'),
    progress: document.getElementById('analysis-progress'),
    results: document.getElementById('analysis-results'),
    resultsContent: document.getElementById('analysis-results-content')
  };

  // Hide all optional elements first
  formElements.progress?.classList.add('hidden');
  formElements.results?.classList.add('hidden');
  formElements.closeBtn?.classList.add('hidden');

  switch (state) {
    case 'form':
      if (formElements.prompt) (formElements.prompt as HTMLTextAreaElement).disabled = false;
      if (formElements.toggle) (formElements.toggle as HTMLInputElement).disabled = false;
      if (formElements.submitBtn) {
        (formElements.submitBtn as HTMLButtonElement).disabled = false;
        formElements.submitBtn.textContent = '🧠 Start Analysis';
      }
      if (formElements.cancelBtn) formElements.cancelBtn.textContent = 'Cancel';
      break;

    case 'analyzing':
      if (formElements.prompt) (formElements.prompt as HTMLTextAreaElement).disabled = true;
      if (formElements.toggle) (formElements.toggle as HTMLInputElement).disabled = true;
      if (formElements.submitBtn) {
        (formElements.submitBtn as HTMLButtonElement).disabled = true;
        formElements.submitBtn.textContent = '🔄 Analyzing...';
      }
      if (formElements.cancelBtn) formElements.cancelBtn.textContent = 'Cancel';
      formElements.progress?.classList.remove('hidden');
      break;

    case 'results':
      if (formElements.prompt) (formElements.prompt as HTMLTextAreaElement).disabled = true;
      if (formElements.toggle) (formElements.toggle as HTMLInputElement).disabled = true;
      if (formElements.submitBtn) (formElements.submitBtn as HTMLButtonElement).style.display = 'none';
      if (formElements.cancelBtn) formElements.cancelBtn.style.display = 'none';
      formElements.closeBtn?.classList.remove('hidden');
      formElements.results?.classList.remove('hidden');

      if (formElements.resultsContent && analysisState.results) {
        formElements.resultsContent.textContent = analysisState.results;
      }
      break;
  }
};

const resetModalState = (): void => {
  const formElements = {
    prompt: document.getElementById('analysis-prompt') as HTMLTextAreaElement,
    toggle: document.getElementById('store-as-document') as HTMLInputElement,
    submitBtn: document.getElementById('analysis-submit-btn') as HTMLButtonElement,
    cancelBtn: document.getElementById('analysis-cancel-btn') as HTMLButtonElement,
    closeBtn: document.getElementById('analysis-close-btn') as HTMLButtonElement,
    progress: document.getElementById('analysis-progress'),
    results: document.getElementById('analysis-results')
  };

  // Reset form state
  if (formElements.prompt) {
    formElements.prompt.disabled = false;
    formElements.prompt.value = '';
  }

  if (formElements.toggle) {
    formElements.toggle.disabled = false;
    formElements.toggle.checked = true;
  }

  if (formElements.submitBtn) {
    formElements.submitBtn.disabled = false;
    formElements.submitBtn.style.display = '';
    formElements.submitBtn.textContent = '🧠 Start Analysis';
  }

  if (formElements.cancelBtn) {
    formElements.cancelBtn.style.display = '';
    formElements.cancelBtn.textContent = 'Cancel';
  }

  if (formElements.closeBtn) {
    formElements.closeBtn.classList.add('hidden');
  }

  // Hide progress and results
  formElements.progress?.classList.add('hidden');
  formElements.results?.classList.add('hidden');

  // Reset progress
  updateProgress(0, 'Ready to start analysis...');
};