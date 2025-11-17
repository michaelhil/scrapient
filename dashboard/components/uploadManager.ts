import { uploadState } from '../core/state';
import { uploadFiles } from '../core/api';
import { getFileStatusIcon, generateUniqueId } from '../core/utils';

export const initializeUploadManager = (): void => {
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');

  uploadZone?.addEventListener('click', handleUploadZoneClick);
  uploadZone?.addEventListener('dragover', handleDragOver);
  uploadZone?.addEventListener('dragleave', handleDragLeave);
  uploadZone?.addEventListener('drop', handleDrop);
  fileInput?.addEventListener('change', handleFileInputChange);
};

const handleUploadZoneClick = (): void => {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  if (fileInput) {
    fileInput.click();
  }
};

const handleFileInputChange = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    processFiles(target.files);
  }
};

const handleDragOver = (event: DragEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  const uploadZone = event.currentTarget as HTMLElement;
  uploadZone?.classList.add('drag-over');
};

const handleDragLeave = (event: DragEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  const uploadZone = event.currentTarget as HTMLElement;
  uploadZone?.classList.remove('drag-over');
};

const handleDrop = (event: DragEvent): void => {
  event.preventDefault();
  event.stopPropagation();

  const uploadZone = event.currentTarget as HTMLElement;
  uploadZone?.classList.remove('drag-over');

  if (event.dataTransfer?.files) {
    processFiles(event.dataTransfer.files);
  }
};

const processFiles = async (files: FileList): Promise<void> => {
  if (uploadState.isUploading) {
    alert('Upload already in progress. Please wait for it to complete.');
    return;
  }

  resetUploadState();
  showUploadProgress();

  const fileArray = Array.from(files);
  uploadState.isUploading = true;

  // Initialize file tracking
  fileArray.forEach(file => {
    const fileId = generateUniqueId();
    uploadState.files.set(fileId, {
      file,
      status: 'pending',
      progress: 0
    });
  });

  updateProgressDisplay();

  // Process files sequentially for better progress tracking
  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const fileId = Array.from(uploadState.files.keys())[i];
    const fileState = uploadState.files.get(fileId)!;

    try {
      // Start processing this file
      fileState.status = 'uploading';
      fileState.currentActivity = 'Uploading...';
      updateProgressDisplay();

      // Simulate progress updates for this file
      const progressTimer = simulateProgressUpdates(file.name);

      // Upload the file
      const result = await uploadFiles(new FileList([file] as any));

      clearInterval(progressTimer);

      if (result.success && result.uploaded[0]?.success) {
        fileState.status = 'completed';
        fileState.progress = 100;
        fileState.currentActivity = 'Complete';
        uploadState.completedCount++;
      } else {
        fileState.status = 'failed';
        fileState.error = result.uploaded[0]?.error || 'Upload failed';
        uploadState.failedCount++;
      }
    } catch (error) {
      fileState.status = 'failed';
      fileState.error = error instanceof Error ? error.message : 'Unknown error';
      uploadState.failedCount++;
    }

    // Update overall progress
    uploadState.overallProgress = Math.round(((i + 1) / fileArray.length) * 100);
    updateProgressDisplay();
  }

  // Upload completed
  uploadState.isUploading = false;

  setTimeout(() => {
    hideUploadProgress();
    // Refresh the documents list
    window.location.reload();
  }, 2000);
};

const simulateProgressUpdates = (filename: string): number => {
  const fileStates = Array.from(uploadState.files.values());
  const currentFile = fileStates.find(f => f.file.name === filename);

  if (!currentFile) return 0;

  return setInterval(() => {
    if (currentFile.status === 'uploading' && currentFile.progress < 90) {
      currentFile.progress += Math.random() * 15;
      if (currentFile.progress > 90) currentFile.progress = 90;

      // Update activity
      if (currentFile.progress < 30) {
        currentFile.currentActivity = 'Uploading...';
      } else if (currentFile.progress < 60) {
        currentFile.currentActivity = 'Processing with Docling...';
      } else if (currentFile.progress < 90) {
        currentFile.currentActivity = 'Extracting content...';
        currentFile.pagesProcessed = Math.floor((currentFile.progress / 100) * 10);
        currentFile.totalPages = 10;
      }

      updateProgressDisplay();
    }
  }, 500);
};

const updateProgressDisplay = (): void => {
  const progressTitle = document.getElementById('upload-progress-title');
  const progressSubtitle = document.getElementById('upload-progress-subtitle');
  const progressFill = document.getElementById('upload-progress-fill');
  const progressText = document.getElementById('upload-progress-text');
  const progressFiles = document.getElementById('upload-progress-files');
  const progressActivity = document.getElementById('upload-activity');
  const progressPages = document.getElementById('upload-pages');

  if (progressFill) {
    progressFill.style.width = `${uploadState.overallProgress}%`;
  }

  if (progressText) {
    progressText.textContent = `Overall Progress: ${uploadState.overallProgress}%`;
  }

  if (progressTitle) {
    progressTitle.textContent = 'Processing Documents';
  }

  if (progressSubtitle) {
    const totalFiles = uploadState.files.size;
    const processed = uploadState.completedCount + uploadState.failedCount;
    progressSubtitle.textContent = `${processed}/${totalFiles} files processed`;
  }

  // Update files list
  if (progressFiles) {
    progressFiles.innerHTML = '';

    uploadState.files.forEach((fileState, fileId) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'upload-file-item';

      fileItem.innerHTML = `
        <div class="upload-file-icon">${getFileStatusIcon(fileState.status)}</div>
        <div class="upload-file-info">
          <div class="upload-file-name">${fileState.file.name}</div>
          <div class="upload-file-status">${fileState.currentActivity || fileState.status}</div>
        </div>
        <div class="upload-file-progress">
          <div class="upload-file-progress-fill ${fileState.status}" style="width: ${fileState.progress}%"></div>
        </div>
      `;

      progressFiles.appendChild(fileItem);
    });
  }

  // Update current activity
  const currentFile = Array.from(uploadState.files.values()).find(f => f.status === 'uploading');
  if (progressActivity && currentFile) {
    progressActivity.innerHTML = `🔄 ${currentFile.currentActivity || 'Processing...'}`;
  }

  if (progressPages && currentFile?.pagesProcessed && currentFile?.totalPages) {
    progressPages.textContent = `Pages processed: ${currentFile.pagesProcessed}/${currentFile.totalPages}`;
  }
};

const resetUploadState = (): void => {
  uploadState.files.clear();
  uploadState.overallProgress = 0;
  uploadState.isUploading = false;
  uploadState.completedCount = 0;
  uploadState.failedCount = 0;
};

const showUploadProgress = (): void => {
  const uploadProgress = document.getElementById('upload-progress');
  if (uploadProgress) {
    uploadProgress.classList.remove('hidden');
  }
};

const hideUploadProgress = (): void => {
  const uploadProgress = document.getElementById('upload-progress');
  if (uploadProgress) {
    uploadProgress.classList.add('hidden');
  }
};