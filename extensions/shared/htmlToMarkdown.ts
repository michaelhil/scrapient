export const htmlToMarkdown = (html: string): string => {
  // Create a temporary DOM to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Remove script and style elements
  const scripts = tempDiv.querySelectorAll('script, style, noscript');
  scripts.forEach(el => el.remove());

  const result = convertElement(tempDiv).trim();

  // Normalize newlines - ensure never more than one newline between content
  return result
    .replace(/\n\s*\n/g, '\n')  // Replace any sequence of newline + optional whitespace + newline with single newline
    .replace(/\n{2,}/g, '\n');  // Replace multiple consecutive newlines with single newline
};

const convertElement = (element: Element): string => {
  let result = '';

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Add text content, cleaning up whitespace
      const text = node.textContent?.trim() || '';
      if (text) {
        result += text + ' ';
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      result += convertElementToMarkdown(el);
    }
  }

  return result;
};

const convertElementToMarkdown = (element: Element): string => {
  const tagName = element.tagName.toLowerCase();
  const text = getTextContent(element);

  switch (tagName) {
    case 'h1':
      return `\n# ${text}\n\n`;
    case 'h2':
      return `\n## ${text}\n\n`;
    case 'h3':
      return `\n### ${text}\n\n`;
    case 'h4':
      return `\n#### ${text}\n\n`;
    case 'h5':
      return `\n##### ${text}\n\n`;
    case 'h6':
      return `\n###### ${text}\n\n`;

    case 'p':
      return `${convertElement(element)}\n\n`;

    case 'br':
      return '\n';

    case 'strong':
    case 'b':
      return `**${text}**`;

    case 'em':
    case 'i':
      return `*${text}*`;

    case 'code':
      return `\`${text}\``;

    case 'pre':
      return `\n\`\`\`\n${text}\n\`\`\`\n\n`;

    case 'blockquote':
      const lines = convertElement(element).split('\n');
      return lines.map(line => line.trim() ? `> ${line}` : '>').join('\n') + '\n\n';

    case 'ul':
    case 'ol':
      return convertList(element);

    case 'li':
      return convertElement(element);

    case 'a':
      const href = element.getAttribute('href');
      if (href && text) {
        return `[${text}](${href})`;
      }
      return text;

    case 'img':
      const src = element.getAttribute('src');
      const alt = element.getAttribute('alt') || '';
      if (src) {
        return `![${alt}](${src})`;
      }
      return '';

    case 'table':
      return convertTable(element);

    case 'hr':
      return '\n---\n\n';

    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'aside':
    case 'nav':
    case 'header':
    case 'footer':
      return convertElement(element) + '\n';

    default:
      // For other elements, just convert their content
      return convertElement(element);
  }
};

const getTextContent = (element: Element): string => {
  return element.textContent?.trim() || '';
};

const convertList = (listElement: Element): string => {
  const isOrdered = listElement.tagName.toLowerCase() === 'ol';
  let result = '\n';

  const items = listElement.querySelectorAll(':scope > li');
  items.forEach((item, index) => {
    const content = convertElement(item).trim();
    if (content) {
      const prefix = isOrdered ? `${index + 1}. ` : '- ';
      result += `${prefix}${content}\n`;
    }
  });

  return result + '\n';
};

const convertTable = (table: Element): string => {
  const rows = table.querySelectorAll('tr');
  if (rows.length === 0) return '';

  let result = '\n';
  let headerProcessed = false;

  rows.forEach((row, rowIndex) => {
    const cells = row.querySelectorAll('td, th');
    const cellContents = Array.from(cells).map(cell =>
      convertElement(cell).trim().replace(/\n/g, ' ')
    );

    if (cellContents.length > 0) {
      result += `| ${cellContents.join(' | ')} |\n`;

      // Add header separator after first row
      if (!headerProcessed) {
        result += `| ${cellContents.map(() => '---').join(' | ')} |\n`;
        headerProcessed = true;
      }
    }
  });

  return result + '\n';
};