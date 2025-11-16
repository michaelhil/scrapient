document.addEventListener('DOMContentLoaded', async () => {
  const urlElement = document.getElementById('current-url') as HTMLElement;
  const titleElement = document.getElementById('current-title') as HTMLElement;
  const scrapeButton = document.getElementById('scrape-button') as HTMLButtonElement;
  const dashboardButton = document.getElementById('dashboard-button') as HTMLButtonElement;
  const statusElement = document.getElementById('status') as HTMLElement;

  const setStatus = (message: string, type: 'info' | 'success' | 'error' = 'info'): void => {
    statusElement.textContent = message;
    statusElement.className = `status ${type}`;
  };

  const updateCurrentPageInfo = async (): Promise<void> => {
    try {
      // @ts-ignore
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        urlElement.textContent = tab.url || 'Unknown URL';
        titleElement.textContent = tab.title || 'Untitled Page';
      }
    } catch (error) {
      console.error('Error getting tab info:', error);
      urlElement.textContent = 'Unable to get current page';
      titleElement.textContent = 'Error';
    }
  };

  const handleScrape = async (): Promise<void> => {
    try {
      setStatus('Scraping page...', 'info');
      scrapeButton.disabled = true;
      scrapeButton.textContent = 'Scraping...';

      // @ts-ignore
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      // @ts-ignore
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });

      if (response && response.success) {
        setStatus('✅ Page scraped successfully!', 'success');
      } else {
        throw new Error(response?.error || 'Scraping failed');
      }

    } catch (error) {
      console.error('Scrape error:', error);
      setStatus(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      scrapeButton.disabled = false;
      scrapeButton.textContent = 'Scrape Page';
    }
  };

  const handleDashboard = (): void => {
    // @ts-ignore
    chrome.tabs.create({ url: 'http://localhost:3001' });
  };

  scrapeButton.addEventListener('click', handleScrape);
  dashboardButton.addEventListener('click', handleDashboard);

  await updateCurrentPageInfo();
  setStatus('Ready to scrape', 'info');
});