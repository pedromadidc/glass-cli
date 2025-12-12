/**
 * Glass Context - Shared state and utilities for the extension
 * 
 * Provides:
 * - ServiceNow instance detection
 * - Current user information
 * - Storage access
 * - Common utilities
 */

class GlassContext {
  constructor() {
    this._instanceUrl = null;
    this._currentUser = null;
  }

  /**
   * Get the platform instance URL from the current page
   * @returns {Promise<string|null>}
   */
  async getInstanceUrl() {
    if (this._instanceUrl) {
      return this._instanceUrl;
    }

    const currentUrl = window.location.href;

    // Try multiple patterns to detect ServiceNow instances
    const patterns = [
      // Standard servicenow.com instances
      /^https:\/\/([^\/]+\.servicenow\.com)/,
      // service-now.com instances (older format)
      /^https:\/\/([^\/]+\.service-now\.com)/,
      // Custom domains with ServiceNow paths
      /^https:\/\/([^\/]+)\/(navpage\.do|login\.do|incident\.do)/
    ];

    for (const pattern of patterns) {
      const match = currentUrl.match(pattern);
      if (match) {
        this._instanceUrl = `https://${match[1]}`;
        return this._instanceUrl;
      }
    }

    // Check if we're on a page that looks like ServiceNow
    if (this._isLikelyServiceNowPage()) {
      const url = new URL(currentUrl);
      this._instanceUrl = `https://${url.hostname}`;
      return this._instanceUrl;
    }

    // Check for manually configured instance
    return new Promise((resolve) => {
      chrome.storage.sync.get(['servicenowInstance'], (result) => {
        if (result.servicenowInstance) {
          this._instanceUrl = result.servicenowInstance;
          resolve(this._instanceUrl);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Check if current page looks like ServiceNow
   * @returns {boolean}
   */
  _isLikelyServiceNowPage() {
    const indicators = [
      document.querySelector('[data-glide-name]'),
      document.querySelector('.navbar-header'),
      document.querySelector('#gsft_main'),
      /\/navpage\.do/.test(window.location.pathname),
      /\/incident\.do/.test(window.location.pathname),
      /\/change\.do/.test(window.location.pathname),
      /ServiceNow/.test(document.title)
    ];

    return indicators.some(indicator => !!indicator);
  }

  /**
   * Check if we're currently on a platform instance
   * @returns {boolean}
   */
  isServiceNowPage() {
    const url = window.location.href;
    return /\.servicenow\.com/.test(url) || 
           /\.service-now\.com/.test(url) || 
           this._isLikelyServiceNowPage();
  }

  /**
   * Get the g_ck token from the page (if available)
   * @returns {string|null}
   */
  getToken() {
    // Try window global
    if (window.g_ck) {
      return window.g_ck;
    }

    // Try to extract from scripts
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || '';
      const match = content.match(/g_ck\s*=\s*['"]([^'"]+)['"]/);
      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Navigate to a platform URL
   * @param {string} path - Path to navigate to (without instance URL)
   */
  async navigate(path) {
    const instanceUrl = await this.getInstanceUrl();
    if (!instanceUrl) {
      throw new Error('Unable to detect instance');
    }

    const fullUrl = path.startsWith('http') ? path : `${instanceUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    window.location.href = fullUrl;
  }

  /**
   * Reload the current page
   */
  reload() {
    window.location.reload();
  }

  /**
   * Store a value in extension storage
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   * @returns {Promise<void>}
   */
  async store(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, resolve);
    });
  }

  /**
   * Get a value from extension storage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default value if not found
   * @returns {Promise<any>}
   */
  async get(key, defaultValue = null) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([key], (result) => {
        resolve(result[key] !== undefined ? result[key] : defaultValue);
      });
    });
  }

  /**
   * Reset the cached instance URL (useful if navigating between instances)
   */
  resetInstanceUrl() {
    this._instanceUrl = null;
  }
}

// Export singleton instance
window.GlassContext = window.GlassContext || new GlassContext();

