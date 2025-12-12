/**
 * Background Script Runner
 * 
 * A reusable utility for executing background scripts
 * without navigating away from the current page.
 * 
 * Uses postMessage to communicate with api-bridge.js which runs in page context
 * and has access to g_ck and other platform globals.
 * 
 * Inspired by standard patterns implementation.
 */

(function() {
  'use strict';

  let messageIdCounter = 0;
  const pendingRequests = new Map();
  const DEFAULT_TIMEOUT = 30000; // 30 seconds for background scripts

  // Listen for responses from api-bridge
  window.addEventListener('message', function(event) {
    const { type, messageId } = event.data;
    
    if (type === 'glassBackgroundScriptResponse' && messageId && pendingRequests.has(messageId)) {
      const handler = pendingRequests.get(messageId);
      pendingRequests.delete(messageId);
      
      if (handler.timeout) {
        clearTimeout(handler.timeout);
      }

      if (event.data.error) {
        handler.reject(new Error(event.data.error));
      } else {
        handler.resolve(event.data.html);
      }
    }
  });

  /**
   * Generate unique message ID
   * @returns {string}
   */
  function generateMessageId() {
    return `glass_bg_${Date.now()}_${++messageIdCounter}`;
  }

  /**
   * Ensure the API bridge is loaded
   * @returns {Promise<void>}
   */
  async function ensureBridgeReady() {
    // Use the GlassAPI's bridge ready mechanism if available
    if (window.GlassAPI && window.GlassAPI.ensureBridgeReady) {
      return window.GlassAPI.ensureBridgeReady();
    }
    // Fallback: assume bridge is ready if GlassAPI exists
    return Promise.resolve();
  }

  /**
   * Execute a background script and return the result
   * 
   * @param {string} script - The GlideRecord/server-side script to execute
   * @param {object} options - Optional configuration
   * @param {string} options.instanceUrl - the platform instance URL (defaults to current origin)
   * @param {string} options.scope - Application scope sys_id (optional)
   * @param {number} options.timeout - Timeout in ms (default: 30000)
   * @returns {Promise<string>} - The HTML response from the background script page
   */
  async function execute(script, options = {}) {
    await ensureBridgeReady();

    const scope = options.scope || '';
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const messageId = generateMessageId();

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingRequests.delete(messageId);
        reject(new Error('Background script execution timed out'));
      }, timeout);

      pendingRequests.set(messageId, {
        resolve,
        reject,
        timeout: timeoutId
      });

      // Send request to api-bridge via postMessage
      window.postMessage({
        type: 'glassBackgroundScriptRequest',
        messageId,
        script,
        scope
      }, '*');
    });
  }

  /**
   * Decode HTML entities in a string
   * @param {string} text - Text with HTML entities
   * @returns {string} - Text with HTML entities decoded
   */
  function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  /**
   * Clean HTML output from background script
   * Converts <BR/> tags to newlines and decodes HTML entities
   * @param {string} html - Raw HTML output
   * @returns {string} - Cleaned text
   */
  function cleanHtmlOutput(html) {
    if (!html) return '';
    
    // Convert <BR/> and <BR> tags to newlines
    let cleaned = html.replace(/<BR\s*\/?>/gi, '\n');
    
    // Decode HTML entities
    cleaned = decodeHtmlEntities(cleaned);
    
    return cleaned;
  }

  /**
   * Parse lines from background script output
   * Handles "*** Script: " prefixes and extracts JSON objects
   * @param {string} text - Cleaned text output
   * @returns {Array} - Array of parsed objects
   */
  function parseScriptLines(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const results = [];

    lines.forEach(line => {
      let cleanLine = line.trim();
      
      // Strip "*** Script: " prefix if present
      if (cleanLine.startsWith('*** Script: ')) {
        cleanLine = cleanLine.substring('*** Script: '.length);
      }

      // Try to parse as JSON
      if (cleanLine && !cleanLine.startsWith('###')) {
        try {
          const parsed = JSON.parse(cleanLine);
          results.push(parsed);
        } catch (e) {
          // Not JSON, could be plain text result
          if (cleanLine.trim()) {
            results.push(cleanLine);
          }
        }
      }
    });

    return results;
  }

  /**
   * Execute a background script and extract output between markers
   * 
   * @param {string} script - The script to execute
   * @param {string} startMarker - The start marker to look for (default: '###')
   * @param {string} endMarker - The end marker to look for (default: '###')
   * @param {object} options - Optional configuration passed to execute()
   * @returns {Promise<string|null>} - The extracted content or null if not found
   */
  async function executeAndExtract(script, startMarker = '###', endMarker = '###', options = {}) {
    const html = await execute(script, options);
    
    // Build regex to extract content between markers
    const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedStart}([\\s\\S]*?)${escapedEnd}`);
    
    const match = html.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Execute a background script and parse JSON results
   * Automatically handles HTML entities, <BR/> tags, and *** Script: prefixes
   * 
   * @param {string} script - The script to execute
   * @param {string} startMarker - Start marker (default: '###RESULTS###')
   * @param {string} endMarker - End marker (default: '###END###')
   * @param {object} options - Optional configuration passed to execute()
   * @returns {Promise<Array>} - Array of parsed result objects
   */
  async function executeAndParse(script, startMarker = '###RESULTS###', endMarker = '###END###', options = {}) {
    const html = await execute(script, options);
    
    // Clean the HTML output
    const cleanedHtml = cleanHtmlOutput(html);
    
    // Build regex to extract content between markers
    const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escapedStart}([\\s\\S]*?)${escapedEnd}`);
    
    const match = cleanedHtml.match(regex);
    if (!match) return [];
    
    // Parse the lines into objects
    return parseScriptLines(match[1]);
  }

  /**
   * Execute a background script with callback (legacy/compatibility style)
   * 
   * @param {string} script - The script to execute
   * @param {function} callback - Callback function that receives the HTML response
   * @param {function} errorCallback - Optional error callback
   * @param {object} options - Optional configuration passed to execute()
   */
  function executeWithCallback(script, callback, errorCallback, options = {}) {
    execute(script, options)
      .then(html => callback(html))
      .catch(err => {
        if (errorCallback) {
          errorCallback(err);
        } else {
        }
      });
  }

  // Expose the API globally
  window.GlassBackgroundScript = {
    execute,
    executeAndExtract,
    executeAndParse,
    executeWithCallback,
    cleanHtmlOutput,
    parseScriptLines
  };

})();

