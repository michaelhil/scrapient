export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  contentType: 'pdf' | 'json' | 'markdown';
}

export const validateFile = (file: File): FileValidationResult => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

  // Validate file type
  const isSupported = file.type.includes('pdf') ||
                     file.type.includes('json') ||
                     file.type.includes('markdown') ||
                     ['json', 'md', 'markdown'].includes(fileExtension);

  if (!isSupported) {
    return {
      isValid: false,
      error: `Invalid file type: ${file.type}. Supported types: PDF, JSON, Markdown`,
      contentType: 'pdf' // default fallback
    };
  }

  // Size limit: 50MB
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File too large: ${(file.size / (1024 * 1024)).toFixed(2)}MB. Max size is 50MB.`,
      contentType: 'pdf' // default fallback
    };
  }

  // Determine content type
  let contentType: 'pdf' | 'json' | 'markdown' = 'pdf';
  if (file.type.includes('pdf') || fileExtension === 'pdf') {
    contentType = 'pdf';
  } else if (file.type.includes('json') || fileExtension === 'json') {
    contentType = 'json';
  } else if (['md', 'markdown'].includes(fileExtension)) {
    contentType = 'markdown';
  }

  return {
    isValid: true,
    contentType
  };
};

export const generateTitle = (content: string, filename: string): string => {
  if (content.length > 20) {
    return content.substring(0, 20).trim() + '...';
  }
  return content.trim() || filename.replace(/\.(pdf|json|md|markdown)$/i, '');
};