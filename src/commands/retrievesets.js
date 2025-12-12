/**
 * RetrieveSets Command
 *
 * Retrieve update sets from a remote instance.
 * Caches sys_update_set_source list for autocomplete.
 *
 * Usage: retrievesets <source_name>
 * Example: retrievesets DEV
 */

(function() {
  // Cache for update set sources
  let cachedSources = [];
  let cacheTimestamp = 0;
  let isFetching = false;
  let fetchPromise = null;

  // Cache duration: 10 minutes
  const CACHE_DURATION = 10 * 60 * 1000;

  // Storage key for localStorage cache (instance-specific)
  function getCacheKey() {
    return `glass_update_sources_${window.location.hostname}`;
  }

  /**
   * Load cached sources from localStorage
   */
  function loadCacheFromStorage() {
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (cached) {
        const { sources, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          cachedSources = sources;
          cacheTimestamp = timestamp;
          return true;
        }
      }
    } catch (e) {
    }
    return false;
  }

  /**
   * Save sources to localStorage cache
   */
  function saveCacheToStorage(sources) {
    try {
      const cacheData = {
        sources: sources,
        timestamp: Date.now()
      };
      localStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
    } catch (e) {
    }
  }

  /**
   * Fetch all update set sources from sys_update_set_source
   * @returns {Promise<Array>} - Array of { name, sys_id } objects
   */
  async function fetchUpdateSources() {
    // Return cached if still valid
    if (cachedSources.length > 0 && Date.now() - cacheTimestamp < CACHE_DURATION) {
      return cachedSources;
    }

    // Check localStorage cache
    if (loadCacheFromStorage()) {
      return cachedSources;
    }

    // If already fetching, wait for that promise
    if (isFetching && fetchPromise) {
      return fetchPromise;
    }

    isFetching = true;

    fetchPromise = (async () => {
      try {
        const api = window.GlassAPI;
        const context = window.GlassContext;

        if (!api || !context) {
          return cachedSources;
        }

        const instanceUrl = await context.getInstanceUrl();
        if (!instanceUrl) {
          return cachedSources;
        }

        // Fetch sources from sys_update_set_source
        const sources = await api.tableGet(instanceUrl, 'sys_update_set_source', {
          fields: ['sys_id', 'name'],
          limit: 500,
          query: 'active=true',
          displayValue: false
        });

        if (sources && sources.length > 0) {
          cachedSources = sources.map(s => ({
            name: s.name,
            sys_id: s.sys_id
          }));
          cacheTimestamp = Date.now();

          // Save to localStorage for persistence
          saveCacheToStorage(cachedSources);
        }

        return cachedSources;
      } catch (error) {
        return cachedSources;
      } finally {
        isFetching = false;
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  }

  /**
   * Get current update sources (from cache or trigger fetch)
   * @returns {Array} - Current cached sources
   */
  function getUpdateSources() {
    // Try to load from localStorage if memory cache is empty
    if (cachedSources.length === 0) {
      loadCacheFromStorage();
    }

    // Trigger background fetch if cache is stale
    if (Date.now() - cacheTimestamp >= CACHE_DURATION) {
      fetchUpdateSources();
    }

    return cachedSources;
  }

  // Initialize: start loading sources in background
  setTimeout(() => {
    if (window.GlassContext && window.GlassContext.isServiceNowPage()) {
      fetchUpdateSources();
    }
  }, 3000);

  // Expose sources globally for UI suggestions
  window.GlassUpdateSources = getUpdateSources;
  window.GlassFetchUpdateSources = fetchUpdateSources;

  /**
   * Find matching sources based on input
   * @param {string} input - User input to match
   * @returns {Array} - Matching source definitions
   */
  function findMatchingSources(input) {
    if (!input) return getUpdateSources();

    const sources = getUpdateSources();
    const lowerInput = input.toLowerCase();

    // Find matches (startsWith first, then includes)
    const startsWithMatches = sources.filter(s =>
      s.name.toLowerCase().startsWith(lowerInput)
    );

    const includesMatches = sources.filter(s =>
      !s.name.toLowerCase().startsWith(lowerInput) &&
      s.name.toLowerCase().includes(lowerInput)
    );

    return [...startsWithMatches, ...includesMatches].slice(0, 10);
  }

  /**
   * Resolve input to source sys_id
   * @param {string} input - User input (source name)
   * @returns {Object|null} - Source object { name, sys_id } or null
   */
  function resolveSource(input) {
    const sources = getUpdateSources();
    const lowerInput = input.toLowerCase();

    // Exact match first
    const exact = sources.find(s => s.name.toLowerCase() === lowerInput);
    if (exact) return exact;

    // Partial match (startsWith)
    const partial = sources.find(s => s.name.toLowerCase().startsWith(lowerInput));
    if (partial) return partial;

    return null;
  }

  // Expose functions globally
  window.GlassFindMatchingSources = findMatchingSources;
  window.GlassResolveSource = resolveSource;

  const command = {
    name: 'retrievesets',
    aliases: ['retrieve', 'rs'],
    description: 'Retrieve update sets from a remote instance',
    usage: 'retrievesets <source_name>',
    examples: [
      'retrievesets DEV              - Retrieve from source starting with "DEV"',
      'retrievesets Production       - Retrieve from Production source'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      if (args.length === 0 || args[0].toLowerCase() === 'help') {
        return 'Usage: retrievesets <source_name>\n\nRetrieves update sets from a remote update source.\nSource names will autocomplete as you type.';
      }
      return true;
    },

    /**
     * Execute the retrievesets command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;
      const sourceName = args.join(' ');

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      // Ensure sources are loaded
      await fetchUpdateSources();

      // Resolve the source
      const source = resolveSource(sourceName);
      if (!source) {
        const available = getUpdateSources();
        if (available.length === 0) {
          ui.showError('No update sources found. Check your permissions.');
        } else {
          ui.showError(`Source "${sourceName}" not found. Available: ${available.map(s => s.name).slice(0, 5).join(', ')}...`);
        }
        return;
      }

      ui.showInfo(`Retrieving update sets from "${source.name}"...`);

      try {
        // Call the GlideAjax processor via postMessage to api-bridge
        const result = await this.callRetrieveUpdateSets(source.sys_id);

        if (result.error) {
          ui.showError(`Failed to retrieve: ${result.error}`);
          return;
        }

        ui.showSuccess(`Retrieve started for "${source.name}". Redirecting...`);
        
        // Wait 5 seconds then redirect to the update source record
        const sourceUrl = `${instanceUrl}/sys_update_set_source.do?sys_id=${source.sys_id}`;
        
        setTimeout(() => {
          ui.hide();
          window.location.href = sourceUrl;
        }, 5000);

      } catch (error) {
        ui.showError(`Failed to retrieve update sets: ${error.message}`);
      }
    },

    /**
     * Call the UpdateSetAjax processor to retrieve update sets
     * @param {string} sourceSysId - sys_id of the update source
     * @returns {Promise<Object>} - { trackerId, rawXml, error }
     */
    async callRetrieveUpdateSets(sourceSysId) {
      return new Promise((resolve) => {
        const messageId = `glass_retrieve_${Date.now()}`;

        const handler = (event) => {
          if (event.data.type === 'glassRetrieveUpdateSetsResponse' && 
              event.data.messageId === messageId) {
            window.removeEventListener('message', handler);
            resolve(event.data);
          }
        };

        window.addEventListener('message', handler);

        // Send request to api-bridge
        window.postMessage({
          type: 'glassRetrieveUpdateSetsRequest',
          messageId: messageId,
          sourceSysId: sourceSysId
        }, '*');

        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('message', handler);
          resolve({ error: 'Request timed out' });
        }, 30000);
      });
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();

