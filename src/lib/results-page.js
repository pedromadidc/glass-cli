/**
 * Glass Results Page
 * 
 * A unified, beautifully styled results page for commands that output to a new tab.
 * Provides a consistent glass-like aesthetic across all Glass CLI commands.
 */

(function() {
  'use strict';

  // Glass theme colors - frosted glass aesthetic
  const GLASS_STYLES = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      background: linear-gradient(135deg, #0f1419 0%, #0a0e12 50%, #06080a 100%);
      color: #f0f4f8;
      padding: 40px 20px;
      position: relative;
      overflow-x: hidden;
      overflow-y: auto;
    }

    .glass-container {
      max-width: 1000px;
      margin: 0 auto;
      background: rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      overflow: hidden;
    }

    .glass-header {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);
      padding: 32px 40px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .glass-header h1 {
      font-size: 28px;
      font-weight: 600;
      color: #ffffff;
      margin: 0 0 8px 0;
      letter-spacing: -0.5px;
    }

    .glass-header .subtitle {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
      font-weight: 400;
    }

    .glass-content {
      padding: 32px 40px;
    }

    .glass-section {
      margin-bottom: 32px;
    }

    .glass-section:last-child {
      margin-bottom: 0;
    }

    .glass-section-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(255, 255, 255, 0.8);
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .glass-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 12px;
      transition: all 0.2s ease;
    }

    .glass-card:last-child {
      margin-bottom: 0;
    }

    .glass-card:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-1px);
    }

    .glass-card-title {
      font-size: 16px;
      font-weight: 500;
      color: #ffffff;
      margin-bottom: 4px;
    }

    .glass-card-subtitle {
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
    }

    .glass-card-meta {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin-top: 8px;
    }

    .glass-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.9);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 500;
      margin-left: 8px;
    }

    .glass-list {
      list-style: none;
    }

    .glass-list li {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .glass-list li:last-child {
      border-bottom: none;
    }

    .glass-list li:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .glass-code {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      background: rgba(0, 0, 0, 0.3);
      padding: 2px 8px;
      border-radius: 4px;
      color: rgba(200, 220, 240, 0.9);
    }

    .glass-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .glass-stat {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }

    .glass-stat-value {
      font-size: 32px;
      font-weight: 600;
      color: rgba(200, 220, 255, 1);
      margin-bottom: 4px;
    }

    .glass-stat-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: rgba(255, 255, 255, 0.5);
    }

    .glass-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .glass-footer {
      padding: 20px 40px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.4);
    }

    /* Links - bright and readable */
    a, a:link {
      color: #7dd3fc !important;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    a:hover {
      color: #bae6fd !important;
      text-decoration: underline;
    }

    a:visited {
      color: #a5b4fc !important;
    }

    a:active {
      color: #e0f2fe !important;
    }

    .glass-footer a {
      color: rgba(200, 220, 255, 0.8);
      text-decoration: none;
    }

    .glass-footer a:hover {
      color: rgba(200, 220, 255, 1);
    }

    /* Pre-formatted text */
    pre {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
      background: rgba(0, 0, 0, 0.2);
      padding: 20px;
      border-radius: 12px;
      overflow-x: auto;
      color: rgba(200, 220, 240, 0.9);
    }

    /* Scrollbar styling */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    /* Responsive */
    @media (max-width: 768px) {
      body {
        padding: 20px 10px;
      }

      .glass-header,
      .glass-content,
      .glass-footer {
        padding-left: 20px;
        padding-right: 20px;
      }

      .glass-header h1 {
        font-size: 22px;
      }

      .glass-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  /**
   * Build the HTML structure for a results page
   * @param {Object} options - Page configuration
   * @param {string} options.title - Page title
   * @param {string} options.subtitle - Subtitle/description
   * @param {string} options.content - Main HTML content
   * @param {string} options.footer - Optional footer text
   * @returns {string} - Complete HTML document
   */
  function buildPage(options) {
    const {
      title = 'Glass CLI',
      subtitle = '',
      content = '',
      footer = 'Glass CLI'
    } = options;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${GLASS_STYLES}</style>
</head>
<body>
  <div class="glass-container">
    <div class="glass-header">
      <h1>${title}</h1>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    </div>
    <div class="glass-content">
      ${content}
    </div>
    ${footer ? `<div class="glass-footer">${footer}</div>` : ''}
  </div>
</body>
</html>`;
  }

  /**
   * Build a section with title and content
   * @param {string} title - Section title
   * @param {string} content - Section HTML content
   * @returns {string} - Section HTML
   */
  function buildSection(title, content) {
    return `
      <div class="glass-section">
        ${title ? `<div class="glass-section-title">${title}</div>` : ''}
        ${content}
      </div>
    `;
  }

  /**
   * Build a card element
   * @param {Object} options - Card configuration
   * @param {string} options.title - Card title
   * @param {string} options.subtitle - Card subtitle
   * @param {string} options.meta - Additional meta info
   * @param {string} options.badge - Optional badge text
   * @returns {string} - Card HTML
   */
  function buildCard(options) {
    const { title = '', subtitle = '', meta = '', badge = '' } = options;

    return `
      <div class="glass-card">
        <div class="glass-card-title">
          ${title}
          ${badge ? `<span class="glass-badge">${badge}</span>` : ''}
        </div>
        ${subtitle ? `<div class="glass-card-subtitle">${subtitle}</div>` : ''}
        ${meta ? `<div class="glass-card-meta">${meta}</div>` : ''}
      </div>
    `;
  }

  /**
   * Build a grid of cards
   * @param {Array} cards - Array of card option objects
   * @returns {string} - Grid HTML
   */
  function buildCardGrid(cards) {
    return `
      <div class="glass-grid">
        ${cards.map(card => buildCard(card)).join('')}
      </div>
    `;
  }

  /**
   * Build stats display
   * @param {Array} stats - Array of { value, label } objects
   * @returns {string} - Stats HTML
   */
  function buildStats(stats) {
    return `
      <div class="glass-stats">
        ${stats.map(stat => `
          <div class="glass-stat">
            <div class="glass-stat-value">${stat.value}</div>
            <div class="glass-stat-label">${stat.label}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Build a simple list
   * @param {Array} items - Array of { left, right } objects or strings
   * @returns {string} - List HTML
   */
  function buildList(items) {
    return `
      <ul class="glass-list">
        ${items.map(item => {
          if (typeof item === 'string') {
            return `<li>${item}</li>`;
          }
          return `<li><span>${item.left}</span><span class="glass-code">${item.right || ''}</span></li>`;
        }).join('')}
      </ul>
    `;
  }

  /**
   * Open a results page in a new tab
   * @param {string} html - Complete HTML document
   */
  function openPage(html) {
    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  }

  // Expose the API globally
  window.GlassResultsPage = {
    buildPage,
    buildSection,
    buildCard,
    buildCardGrid,
    buildStats,
    buildList,
    openPage,
    STYLES: GLASS_STYLES
  };

})();

