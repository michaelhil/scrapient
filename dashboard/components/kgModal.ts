import type { ScrapedDocument } from '../core/state';
import { getSelectedDocuments } from './documentList';

interface KGGenerationState {
  selectedDocuments: ScrapedDocument[];
  currentStage: 'input' | 'generating' | 'preview' | 'cypher' | 'complete';
  kgData: any;
  mermaidCode: string;
  cypherCode: string;
  kgId?: string;
}

let kgState: KGGenerationState = {
  selectedDocuments: [],
  currentStage: 'input',
  kgData: null,
  mermaidCode: '',
  cypherCode: ''
};

export const initializeKGModal = (): void => {
  const modal = document.getElementById('kg-modal');
  const closeBtn = document.getElementById('kg-modal-close');
  const generateBtn = document.getElementById('generate-kg-btn');
  const cancelBtn = document.getElementById('kg-cancel-btn');
  const closeModalBtn = document.getElementById('kg-close-btn');

  // Button event listeners
  generateBtn?.addEventListener('click', handleGenerateKGClick);
  closeBtn?.addEventListener('click', hideKGModal);
  cancelBtn?.addEventListener('click', hideKGModal);
  closeModalBtn?.addEventListener('click', hideKGModal);

  // Modal background click
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) {
      hideKGModal();
    }
  });

  // KG generation form
  const kgModalGenerateBtn = document.getElementById('kg-modal-generate-btn');
  kgModalGenerateBtn?.addEventListener('click', startKGGeneration);

  // Preview actions
  const discardBtn = document.getElementById('kg-discard-btn');
  const approveBtn = document.getElementById('kg-approve-btn');
  discardBtn?.addEventListener('click', discardKG);
  approveBtn?.addEventListener('click', generateCypher);

  // Cypher actions
  const copyCypherBtn = document.getElementById('kg-copy-cypher-btn');
  const saveBtn = document.getElementById('kg-save-btn');
  copyCypherBtn?.addEventListener('click', copyCypherToClipboard);
  saveBtn?.addEventListener('click', saveToDatabase);

  // Tab switching
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('tab-btn') && target.closest('#kg-modal')) {
      switchKGTab(target.dataset.tab || 'mermaid');
    }
  });

  // Update button state based on selection
  document.addEventListener('selectionChanged', updateKGButtonState);
};

const handleGenerateKGClick = (event?: Event): void => {
  event?.preventDefault();
  event?.stopPropagation();

  const selectedDocs = getSelectedDocuments();

  if (selectedDocs.length === 0) {
    alert('Please select at least one document to generate a knowledge graph.');
    return;
  }

  showKGModal(selectedDocs);
};

export const showKGModal = (documents: ScrapedDocument[]): void => {
  const modal = document.getElementById('kg-modal');
  const titleInput = document.getElementById('kg-title') as HTMLInputElement;
  const selectedDocsContainer = document.getElementById('kg-selected-documents');

  if (!modal || !titleInput || !selectedDocsContainer) {
    console.error('KG modal elements not found');
    return;
  }

  // Reset state
  kgState = {
    selectedDocuments: documents,
    currentStage: 'input',
    kgData: null,
    mermaidCode: '',
    cypherCode: ''
  };

  // Set default title
  const defaultTitle = documents.length === 1
    ? `Knowledge Graph: ${documents[0].title}`
    : `Knowledge Graph: ${documents.length} Documents`;
  titleInput.value = defaultTitle;

  // Show selected documents
  selectedDocsContainer.innerHTML = documents.map(doc => `
    <div class="selected-document">
      <span class="doc-icon">${getDocumentIcon(doc.contentType)}</span>
      <span class="doc-title">${doc.title}</span>
      <span class="doc-type">${doc.contentType}</span>
    </div>
  `).join('');

  // Show appropriate sections
  showKGSection('input');

  // Show modal
  modal.style.display = 'flex';
};

export const hideKGModal = (): void => {
  const modal = document.getElementById('kg-modal');
  if (modal) {
    modal.style.display = 'none';
  }

  // Reset state
  kgState = {
    selectedDocuments: [],
    currentStage: 'input',
    kgData: null,
    mermaidCode: '',
    cypherCode: ''
  };

  // Reset UI
  showKGSection('input');
};

const showKGSection = (section: string): void => {
  const sections = ['kg-progress', 'kg-preview', 'kg-cypher'];
  const buttons = ['kg-modal-generate-btn', 'kg-cancel-btn', 'kg-close-btn'];

  // Hide all sections
  sections.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.classList.add('hidden');
  });

  // Hide all buttons
  buttons.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.classList.add('hidden');
  });

  // Show appropriate section and buttons
  switch (section) {
    case 'input':
      document.getElementById('kg-modal-generate-btn')?.classList.remove('hidden');
      document.getElementById('kg-cancel-btn')?.classList.remove('hidden');
      break;
    case 'generating':
      document.getElementById('kg-progress')?.classList.remove('hidden');
      document.getElementById('kg-cancel-btn')?.classList.remove('hidden');
      break;
    case 'preview':
      document.getElementById('kg-preview')?.classList.remove('hidden');
      break;
    case 'cypher':
      document.getElementById('kg-cypher')?.classList.remove('hidden');
      break;
  }
};

const startKGGeneration = async (event?: Event): Promise<void> => {
  event?.preventDefault();
  event?.stopPropagation();

  const titleInput = document.getElementById('kg-title') as HTMLInputElement;
  const promptTextarea = document.getElementById('kg-prompt') as HTMLTextAreaElement;

  const title = titleInput.value.trim();
  const prompt = promptTextarea.value.trim();

  if (!title || !prompt) {
    alert('Please provide a title and prompt for the knowledge graph.');
    return;
  }

  kgState.currentStage = 'generating';
  showKGSection('generating');

  try {
    // Update progress
    updateKGProgress(0, 'Analyzing documents...');

    // Generate KG
    const response = await fetch('/api/kg/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentIds: kgState.selectedDocuments.map(doc => doc.id || doc._id),
        userPrompt: prompt,
        title: title
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate knowledge graph: ${response.statusText}`);
    }

    // Handle streaming response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response stream available');
    }

    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += new TextDecoder().decode(value);
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'progress') {
              updateKGProgress(data.progress, data.message);
            } else if (data.type === 'result') {
              handleKGResult(data);
              return;
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (error) {
            console.warn('Failed to parse SSE data:', line);
          }
        }
      }
    }
  } catch (error) {
    console.error('KG generation error:', error);
    alert(`Failed to generate knowledge graph: ${error instanceof Error ? error.message : 'Unknown error'}`);
    kgState.currentStage = 'input';
    showKGSection('input');
  }
};

const handleKGResult = (data: any): void => {
  kgState.kgData = data.rawData;
  kgState.mermaidCode = data.mermaidCode || '';
  kgState.kgId = data.kgId;
  kgState.currentStage = 'preview';

  // Show preview
  showKGSection('preview');
  renderKGPreview();
};

const renderKGPreview = (): void => {
  const mermaidContainer = document.getElementById('kg-mermaid-diagram');
  const jsonContainer = document.getElementById('kg-json-display');

  if (mermaidContainer && kgState.mermaidCode) {
    renderMermaidDiagram(mermaidContainer, kgState.mermaidCode);
  }

  if (jsonContainer && kgState.kgData) {
    jsonContainer.textContent = JSON.stringify(kgState.kgData, null, 2);
  }
};

const renderMermaidDiagram = async (container: HTMLElement, mermaidCode: string): Promise<void> => {
  try {
    // Dynamic import of Mermaid
    const mermaid = await import('mermaid');
    mermaid.default.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose'
    });

    // Clear container
    container.innerHTML = '';

    // Render diagram
    const { svg } = await mermaid.default.render('kg-diagram', mermaidCode);
    container.innerHTML = svg;
  } catch (error) {
    console.error('Failed to render Mermaid diagram:', error);
    container.innerHTML = `
      <div class="error-message">
        <p>Failed to render diagram</p>
        <details>
          <summary>Mermaid Code</summary>
          <pre>${mermaidCode}</pre>
        </details>
      </div>
    `;
  }
};

const switchKGTab = (tab: string): void => {
  // Update tab buttons
  const tabButtons = document.querySelectorAll('#kg-modal .tab-btn');
  tabButtons.forEach(btn => btn.classList.remove('active'));

  const activeBtn = document.querySelector(`#kg-modal .tab-btn[data-tab="${tab}"]`);
  activeBtn?.classList.add('active');

  // Update tab content
  const tabContents = document.querySelectorAll('#kg-modal .tab-content');
  tabContents.forEach(content => content.classList.remove('active'));

  const activeContent = document.getElementById(`kg-${tab}-container`);
  activeContent?.classList.add('active');
};

const updateKGProgress = (progress: number, message: string): void => {
  const progressFill = document.getElementById('kg-progress-fill');
  const progressStatus = document.getElementById('kg-progress-status');

  if (progressFill) {
    progressFill.style.width = `${progress}%`;
  }

  if (progressStatus) {
    progressStatus.textContent = message;
  }
};

const discardKG = (): void => {
  kgState.currentStage = 'input';
  showKGSection('input');
};

const generateCypher = async (): Promise<void> => {
  if (!kgState.kgId || !kgState.kgData) {
    alert('No knowledge graph data available');
    return;
  }

  try {
    const response = await fetch('/api/kg/to-cypher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kgId: kgState.kgId,
        rawData: kgState.kgData
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate Cypher code: ${response.statusText}`);
    }

    const result = await response.json();
    kgState.cypherCode = result.cypherCode;
    kgState.currentStage = 'cypher';

    // Show cypher section
    showKGSection('cypher');

    // Display cypher code
    const cypherElement = document.getElementById('kg-cypher-code');
    if (cypherElement) {
      cypherElement.textContent = kgState.cypherCode;
    }
  } catch (error) {
    console.error('Cypher generation error:', error);
    alert(`Failed to generate Cypher code: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const copyCypherToClipboard = async (): Promise<void> => {
  if (!kgState.cypherCode) return;

  try {
    await navigator.clipboard.writeText(kgState.cypherCode);

    // Show feedback
    const btn = document.getElementById('kg-copy-cypher-btn');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(() => {
        btn.textContent = originalText;
      }, 2000);
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    alert('Failed to copy to clipboard');
  }
};

const saveToDatabase = async (): Promise<void> => {
  if (!kgState.kgId) {
    alert('No knowledge graph ID available');
    return;
  }

  try {
    const response = await fetch('/api/kg/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kgId: kgState.kgId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save to database: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      alert('Knowledge graph saved to Neo4j database successfully!');
      kgState.currentStage = 'complete';

      // Show close button
      document.getElementById('kg-close-btn')?.classList.remove('hidden');
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('Database save error:', error);
    alert(`Failed to save to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const updateKGButtonState = (): void => {
  const selectedDocs = getSelectedDocuments();
  const kgBtn = document.getElementById('generate-kg-btn') as HTMLButtonElement;

  if (kgBtn) {
    kgBtn.disabled = selectedDocs.length === 0;
  }
};

const getDocumentIcon = (contentType: string): string => {
  switch (contentType) {
    case 'pdf': return '📄';
    case 'json': return '📊';
    case 'markdown': return '📝';
    case 'text': return '📃';
    default: return '📄';
  }
};