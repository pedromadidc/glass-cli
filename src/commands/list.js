/**
 * List Command
 * 
 * Navigate to a platform table list view.
 * Dynamically fetches table definitions from sys_db_object.
 * 
 * Usage: list <table_name>
 * Example: list incident
 */

(function() {
  // Cache for table definitions
  let cachedTables = [];
  let cacheTimestamp = 0;
  let isFetching = false;
  let fetchPromise = null;
  
  // Cache duration: 12 hours
  const CACHE_DURATION = 12 * 60 * 60 * 1000;
  
  // Storage key for localStorage cache (instance-specific)
  function getCacheKey() {
    return `glass_tables_${window.location.hostname}`;
  }

  /**
   * Load cached tables from localStorage
   */
  function loadCacheFromStorage() {
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (cached) {
        const { tables, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          cachedTables = tables;
          cacheTimestamp = timestamp;
          return true;
        }
      }
    } catch (e) {
    }
    return false;
  }

  /**
   * Save tables to localStorage cache
   */
  function saveCacheToStorage(tables) {
    try {
      const cacheData = {
        tables: tables,
        timestamp: Date.now()
      };
      localStorage.setItem(getCacheKey(), JSON.stringify(cacheData));
    } catch (e) {
    }
  }

  /**
   * Fetch all tables from sys_db_object
   * @returns {Promise<Array>} - Array of { name, table } objects
   */
  async function fetchTableDefinitions() {
    // Return cached if still valid
    if (cachedTables.length > 0 && Date.now() - cacheTimestamp < CACHE_DURATION) {
      return cachedTables;
    }

    // Check localStorage cache
    if (loadCacheFromStorage()) {
      return cachedTables;
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
          return cachedTables;
        }

        const instanceUrl = await context.getInstanceUrl();
        if (!instanceUrl) {
          return cachedTables;
        }
        
        // Fetch tables from sys_db_object
        // Get name (technical name) and label (display name)
        const tables = await api.tableGet(instanceUrl, 'sys_db_object', {
          fields: ['name', 'label'],
          limit: 10000,
          query: 'nameISNOTEMPTY^labelISNOTEMPTY',
          displayValue: false
        });

        if (tables && tables.length > 0) {
          // Transform to our format: { name: label, table: name }
          cachedTables = tables.map(t => ({
            name: t.label || t.name,
            table: t.name
          }));
          cacheTimestamp = Date.now();
          
          // Save to localStorage for persistence
          saveCacheToStorage(cachedTables);
        }

        return cachedTables;
      } catch (error) {
        return cachedTables;
      } finally {
        isFetching = false;
        fetchPromise = null;
      }
    })();

    return fetchPromise;
  }

  /**
   * Get current table definitions (from cache or trigger fetch)
   * @returns {Array} - Current cached tables
   */
  function getTableDefinitions() {
    // Try to load from localStorage if memory cache is empty
    if (cachedTables.length === 0) {
      loadCacheFromStorage();
    }
    
    // Trigger background fetch if cache is stale
    if (Date.now() - cacheTimestamp >= CACHE_DURATION) {
      fetchTableDefinitions();
    }
    
    return cachedTables;
  }

  // Initialize: start loading tables in background
  setTimeout(() => {
    if (window.GlassContext && window.GlassContext.isServiceNowPage()) {
      fetchTableDefinitions();
    }
  }, 2000);

  // Expose table definitions globally for UI suggestions
  window.GlassTableDefinitions = getTableDefinitions;
  window.GlassFetchTableDefinitions = fetchTableDefinitions;

  /**
   * Find matching tables based on input
   * Prioritizes: 1) startsWith over includes, 2) shorter names first
   * @param {string} input - User input to match
   * @returns {Array} - Matching table definitions
   */
  function findMatchingTables(input) {
    if (!input) return [];
    
    const tables = getTableDefinitions();
    const lowerInput = input.toLowerCase();
    
    // Sort by table name length (shorter first)
    const sortByLength = (a, b) => a.table.length - b.table.length;
    
    // First, find exact startsWith matches (higher priority)
    const startsWithMatches = tables
      .filter(def => 
        def.name.toLowerCase().startsWith(lowerInput) ||
        def.table.toLowerCase().startsWith(lowerInput)
      )
      .sort(sortByLength);
    
    // Then find includes matches (lower priority)
    const includesMatches = tables
      .filter(def => 
        !def.name.toLowerCase().startsWith(lowerInput) &&
        !def.table.toLowerCase().startsWith(lowerInput) &&
        (def.name.toLowerCase().includes(lowerInput) ||
         def.table.toLowerCase().includes(lowerInput))
      )
      .sort(sortByLength);
    
    return [...startsWithMatches, ...includesMatches].slice(0, 10);
  }

  /**
   * Resolve input to actual table name
   * @param {string} input - User input (could be friendly name or table name)
   * @returns {string} - Actual table name
   */
  function resolveTableName(input) {
    const tables = getTableDefinitions();
    const lowerInput = input.toLowerCase();
    
    // First, check for exact table match
    const exactTable = tables.find(def => 
      def.table.toLowerCase() === lowerInput
    );
    if (exactTable) return exactTable.table;
    
    // Check for exact friendly name match
    const exactName = tables.find(def => 
      def.name.toLowerCase() === lowerInput
    );
    if (exactName) return exactName.table;
    
    // If no match, assume it's a custom table name
    return input.toLowerCase();
  }

  // Expose functions globally
  window.GlassFindMatchingTables = findMatchingTables;
  window.GlassResolveTableName = resolveTableName;

  const command = {
    name: 'list',
    aliases: ['ls', 'l'],
    description: 'Navigate to a table list view',
    usage: 'list <table_name>',
    examples: [
      'list incident    - Go to incident list',
      'list user        - Go to sys_user list',
      'list acl         - Go to ACL list',
      'list sys_user    - Direct table name also works'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      if (args.length === 0) {
        return 'Usage: list <table_name>';
      }
      return true;
    },

    /**
     * Execute the list command
     */
    async execute(args, ctx) {
      const input = args.join(' '); // Support multi-word names like "Change Request"
      const { ui, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      // Resolve the table name (handles friendly names)
      const tableName = resolveTableName(input);
      
      // Find the friendly name if available
      const tables = getTableDefinitions();
      const tableDef = tables.find(def => def.table === tableName);
      const displayName = tableDef ? `${tableDef.name} (${tableName})` : tableName;

      // Construct the list URL
      const listUrl = `${instanceUrl}/${tableName}_list.do`;

      ui.showSuccess(`Navigating to ${displayName}...`);
      ui.hide();

      window.location.href = listUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
