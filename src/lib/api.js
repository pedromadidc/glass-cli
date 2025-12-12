/**
 * Platform API Service
 * 
 * Provides a clean interface for making authenticated API calls.
 * Uses postMessage to communicate with the api-bridge.js running in page context.
 */

class ServiceNowAPI {
  constructor() {
    this.messageHandlers = new Map();
    this.messageIdCounter = 0;
    this.timeout = 15000; // 15 second default timeout
    this.bridgeReady = false;
    this.bridgeReadyPromise = null;

    // Set up global message listener
    window.addEventListener('message', this._handleMessage.bind(this));
  }

  /**
   * Ensure the API bridge is loaded and ready
   * @returns {Promise<void>}
   */
  async ensureBridgeReady() {
    if (this.bridgeReady) {
      return;
    }

    if (this.bridgeReadyPromise) {
      return this.bridgeReadyPromise;
    }

    this.bridgeReadyPromise = new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.snEzApiBridge) {
        this.bridgeReady = true;
        resolve();
        return;
      }

      // Listen for bridge ready signal
      const readyHandler = (event) => {
        if (event.data && event.data.type === 'glassBridgeReady') {
          window.removeEventListener('message', readyHandler);
          this.bridgeReady = true;
          resolve();
        }
      };
      window.addEventListener('message', readyHandler);

      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('api-bridge.js');

      script.onload = () => {
        // Give a small fallback timeout in case the ready signal was missed
        setTimeout(() => {
          if (!this.bridgeReady) {
            window.removeEventListener('message', readyHandler);
            this.bridgeReady = true;
            resolve();
          }
        }, 100);
      };

      script.onerror = (e) => {
        window.removeEventListener('message', readyHandler);
        reject(new Error('Failed to load API bridge'));
      };

      document.head.appendChild(script);
    });

    return this.bridgeReadyPromise;
  }

  /**
   * Generate unique message ID
   * @returns {string}
   */
  _generateMessageId() {
    return `glass_${Date.now()}_${++this.messageIdCounter}`;
  }

  /**
   * Handle incoming messages from api-bridge
   * @param {MessageEvent} event 
   */
  _handleMessage(event) {
    const { type, messageId } = event.data;
    
    // Skip messages without messageId or that we're not waiting for
    if (!messageId || !this.messageHandlers.has(messageId)) {
      return;
    }

    // IMPORTANT: Only process RESPONSE messages, not our own outgoing requests
    // Response types end with "Response" (e.g., snEzImpersonateResponse, snEzApiResponse)
    if (!type || !type.includes('Response')) {
      return;
    }

    const handler = this.messageHandlers.get(messageId);
    this.messageHandlers.delete(messageId);
    
    if (handler.timeout) {
      clearTimeout(handler.timeout);
    }

    handler.resolve(event.data);
  }

  /**
   * Send a message to the api-bridge and wait for response
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<Object>}
   */
  async _sendMessage(type, data, timeout = this.timeout) {
    await this.ensureBridgeReady();

    const messageId = this._generateMessageId();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        reject(new Error(`Request timed out: ${type}`));
      }, timeout);

      this.messageHandlers.set(messageId, {
        resolve,
        reject,
        timeout: timeoutId
      });

      // Small delay to ensure bridge event listener is fully ready
      setTimeout(() => {
        window.postMessage({
          type,
          messageId,
          ...data
        }, '*');
      }, 50);
    });
  }

  /**
   * Make a GET request to Table API
   * @param {string} instanceUrl - instance URL
   * @param {string} table - Table name
   * @param {Object} options - Query options
   * @returns {Promise<Array>}
   */
  async tableGet(instanceUrl, table, options = {}) {
    const {
      query = '',
      fields = [],
      limit = 100,
      offset = 0,
      displayValue = false
    } = options;

    const params = new URLSearchParams();
    if (query) params.append('sysparm_query', query);
    if (fields.length) params.append('sysparm_fields', fields.join(','));
    params.append('sysparm_limit', limit);
    params.append('sysparm_offset', offset);
    params.append('sysparm_display_value', displayValue);

    const fullUrl = `${instanceUrl}/api/now/table/${table}?${params.toString()}`;
    const response = await this._sendMessage('glassApiRequest', {
      method: 'GET',
      url: fullUrl,
      instanceUrl
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.result || [];
  }

  /**
   * Look up a user by username
   * @param {string} instanceUrl - instance URL
   * @param {string} username - Username to look up
   * @returns {Promise<Object|null>}
   */
  async lookupUser(instanceUrl, username) {
    const response = await this._sendMessage('snEzApiRequest', {
      username,
      instanceUrl
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.result && response.result.length > 0 ? response.result[0] : null;
  }

  /**
   * Impersonate a user
   * @param {string} instanceUrl - instance URL
   * @param {string} username - Username to impersonate
   * @returns {Promise<boolean>}
   */
  async impersonate(instanceUrl, username) {
    const response = await this._sendMessage('snEzImpersonateRequest', {
      username,
      instanceUrl
    });

    if (!response.success) {
      throw new Error(response.error || 'Impersonation failed');
    }

    return true;
  }

  /**
   * End impersonation and return to original user
   * The original user is extracted from the page by the API bridge
   * @param {string} instanceUrl - instance URL
   * @returns {Promise<boolean>}
   */
  async endImpersonate(instanceUrl) {
    const response = await this._sendMessage('snEzEndImpersonateRequest', {
      instanceUrl
    });

    if (!response.success) {
      throw new Error(response.error || 'End impersonation failed');
    }

    return true;
  }

  /**
   * Get current user information
   * @param {string} instanceUrl - instance URL
   * @returns {Promise<Object>}
   */
  async getCurrentUser(instanceUrl) {
    const response = await this._sendMessage('snEzCurrentUserRequest', {
      instanceUrl
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.user;
  }

  /**
   * Make a generic API request
   * @param {string} instanceUrl - instance URL
   * @param {string} endpoint - API endpoint (without instance URL)
   * @param {Object} options - Request options
   * @returns {Promise<Object>}
   */
  async request(instanceUrl, endpoint, options = {}) {
    const {
      method = 'GET',
      body = null,
      headers = {}
    } = options;

    const response = await this._sendMessage('glassApiRequest', {
      method,
      url: `${instanceUrl}${endpoint}`,
      body,
      headers,
      instanceUrl
    });

    if (response.error) {
      throw new Error(response.error);
    }

    return response.result;
  }
}

// Export singleton instance
window.GlassAPI = window.GlassAPI || new ServiceNowAPI();

