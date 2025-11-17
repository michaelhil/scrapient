export const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return dateString;
  }
};

export const markdownToHtml = (markdown: string): string => {
  let html = markdown;

  // Convert headers
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // Convert emphasis
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Convert code blocks
  html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Convert line breaks
  html = html.replace(/\n/g, '<br>');

  return html;
};

export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const getDocumentIcon = (contentType: string): string => {
  switch (contentType.toLowerCase()) {
    case 'pdf': return '📄';
    case 'json': return '🗂️';
    case 'markdown': return '📝';
    default: return '📄';
  }
};

export const getFileStatusIcon = (status: string): string => {
  switch (status) {
    case 'pending': return '⏳';
    case 'uploading': return '📤';
    case 'processing': return '⚙️';
    case 'completed': return '✅';
    case 'failed': return '❌';
    default: return '⏳';
  }
};

export const generateUniqueId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};