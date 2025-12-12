/**
 * Upload Command
 *
 * Open XML import page for a table.
 * Uses table auto-complete. If no table specified, detects from current URL.
 *
 * Usage: upload [table_name]
 * Example: upload incident
 */

(function() {
  const command = {
    name: 'upload',
    aliases: ['import', 'load'],
    description: 'Open XML import page for a table',
    usage: 'upload [table_name]',
    examples: [
      'upload incident    - Open XML import for incident table',
      'upload             - Import to current table (if viewing record/list)',
      'upload user        - Open XML import for sys_user table'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      // Arguments are optional - will auto-detect if not provided
      return true;
    },

    /**
     * Execute the upload command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      let tableName = null;

      if (args.length > 0) {
        // User provided table name - resolve it
        const input = args.join(' ');
        tableName = window.GlassResolveTableName
          ? window.GlassResolveTableName(input)
          : input.toLowerCase();
      } else {
        // No table specified - try to detect from current URL
        tableName = detectCurrentTable();
        if (!tableName) {
          ui.showError('No table specified and unable to detect current table from URL. Please specify a table name.');
          return;
        }
      }

      // Find the friendly name if available
      const tables = typeof window.GlassTableDefinitions === 'function' ? window.GlassTableDefinitions() : [];
      const tableDef = tables.find(def => def.table === tableName);
      const displayName = tableDef ? `${tableDef.name} (${tableName})` : tableName;

      // Construct the upload URL: upload.do?sysparm_referring_url=table_list.do&sysparm_target=table
      const uploadUrl = `${instanceUrl}/upload.do?sysparm_referring_url=${tableName}_list.do&sysparm_target=${tableName}`;

      ui.showSuccess(`Opening XML import for ${displayName}...`);
      ui.hide();

      window.location.href = uploadUrl;
    }
  };

  /**
   * Detect current table from URL
   * @returns {string|null} - Table name or null if not found
   */
  function detectCurrentTable() {
    const currentUrl = decodeURIComponent(window.location.href);

    // Pattern 1: Direct table URLs (table.do, table_list.do)
    let match = currentUrl.match(/\/([^\/]+?)_(?:list\.do|\.do)/i);
    if (match) {
      return match[1];
    }

    // Pattern 2: Navigation URLs with params/target/
    match = currentUrl.match(/\/params\/target\/([^\/]+?)\.do/i);
    if (match) {
      return match[1];
    }

    // Pattern 3: Look for table in URL parameters
    match = currentUrl.match(/[?&]sysparm_target=([^&]+)/i);
    if (match) {
      return decodeURIComponent(match[1]);
    }

    return null;
  }

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
