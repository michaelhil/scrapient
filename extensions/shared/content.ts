import type { ExtractedContent, NotificationOptions } from './types';
import { htmlToMarkdown } from './htmlToMarkdown';

const extractPageContent = (): ExtractedContent => {
  const textContent = document.body.innerText || '';
  const htmlContent = document.documentElement.outerHTML || '';
  const markdownContent = htmlToMarkdown(document.body.innerHTML || '');

  const metadata: Record<string, any> = {};
  metadata.title = document.title || '';

  const metaTags = document.getElementsByTagName('meta');
  for (const meta of metaTags) {
    const name = meta.getAttribute('name') || meta.getAttribute('property') || meta.getAttribute('http-equiv');
    const content = meta.getAttribute('content');
    if (name && content) {
      metadata[name] = content;
    }
  }

  const images: string[] = [];
  const imgElements = document.querySelectorAll('img[src]');
  imgElements.forEach((img) => {
    const src = (img as HTMLImageElement).src;
    if (src && !src.startsWith('data:')) {
      images.push(src);
    }
  });

  return {
    url: window.location.href,
    domain: window.location.hostname,
    title: document.title || '',
    content: {
      html: htmlContent,
      text: textContent,
      markdown: markdownContent,
      metadata,
      images
    },
    scrapedAt: new Date(),
    contentType: 'webpage'
  };
};

const showNotification = (options: NotificationOptions): void => {
  const existingNotification = document.getElementById('scrapient-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'scrapient-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    padding: 12px 16px;
    border-radius: 6px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: white;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    max-width: 400px;
    word-wrap: break-word;
    transition: all 0.3s ease;
    opacity: 0;
    transform: translateY(-10px);
  `;

  const colors = {
    info: '#2196F3',
    success: '#4CAF50',
    error: '#f44336'
  };
  notification.style.backgroundColor = colors[options.type];
  notification.textContent = options.message;

  document.body.appendChild(notification);

  requestAnimationFrame(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
  });

  const duration = options.duration || (options.type === 'error' ? 8000 : 4000);
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, duration);

  notification.addEventListener('click', () => {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  });

  notification.style.cursor = 'pointer';
};

const triggerScrape = async (): Promise<void> => {
  try {
    showNotification({ message: 'Scraping page...', type: 'info' });

    const content = extractPageContent();
    const serverUrl = 'http://localhost:3000';

    const response = await fetch(`${serverUrl}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(content),
      mode: 'cors'
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
      throw new Error(errorData.error || `Server responded with ${response.status}`);
    }

    const result = await response.json();
    showNotification({
      message: `✅ Page scraped successfully! ID: ${result.id}`,
      type: 'success'
    });

  } catch (error) {
    console.error('Scrape failed:', error);

    let errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('Failed to fetch')) {
      errorMessage = 'Connection failed. Check if Scrapient server is running on http://localhost:3001';
    }

    showNotification({
      message: `❌ Error: ${errorMessage}`,
      type: 'error'
    });
  }
};

console.log('Scrapient content script loaded on:', window.location.href);

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.shiftKey &&
      (event.key === 'S' || event.key === 's' || event.code === 'KeyS')) {
    console.log('Scrapient: Triggering page scrape');
    event.preventDefault();
    triggerScrape();
  }
});

// @ts-ignore
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scrape') {
    triggerScrape()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});