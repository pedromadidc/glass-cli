/**
 * Filter Command
 * 
 * Navigate to a platform table list with filter panel open.
 * Uses the same table auto-complete as the list command.
 * 
 * Usage: filter <table_name>
 * Example: filter incident
 */

(function() {
  const command = {
    name: 'filter',
    aliases: ['f', 'query'],
    description: 'Open a table list with filter panel',
    usage: 'filter <table_name>',
    examples: [
      'filter incident    - Open incident list with filter',
      'filter user        - Open user list with filter',
      'filter change      - Open change list with filter'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      if (args.length === 0) {
        return 'Usage: filter <table_name>';
      }
      return true;
    },

    /**
     * Execute the filter command
     */
    async execute(args, ctx) {
      const input = args.join(' ');
      const { ui, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      // Reuse the global resolver from list.js
      const tableName = window.GlassResolveTableName 
        ? window.GlassResolveTableName(input) 
        : input.toLowerCase();
      
      // Find the friendly name if available
      const tables = typeof window.GlassTableDefinitions === 'function' ? window.GlassTableDefinitions() : [];
      const tableDef = tables.find(def => def.table === tableName);
      const displayName = tableDef ? `${tableDef.name} (${tableName})` : tableName;

      // Construct the filter URL: table_list.do?sysparm_filter_only=true&sysparm_clear_stack=true
      const filterUrl = `${instanceUrl}/${tableName}_list.do?sysparm_filter_only=true&sysparm_clear_stack=true`;

      ui.showSuccess(`Opening ${displayName} filter...`);
      ui.hide();

      window.location.href = filterUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
