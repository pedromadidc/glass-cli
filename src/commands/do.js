/**
 * Do Command
 * 
 * Navigate to a platform table form (new record).
 * Uses the same table auto-complete as the list command.
 * 
 * Usage: do <table_name>
 * Example: do incident
 */

(function() {
  const command = {
    name: 'do',
    aliases: ['new', 'create'],
    description: 'Open a table form (new record)',
    usage: 'do <table_name>',
    examples: [
      'do incident    - Open new incident form',
      'do user        - Open new user form',
      'do change      - Open new change request form'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      if (args.length === 0) {
        return 'Usage: do <table_name>';
      }
      return true;
    },

    /**
     * Execute the do command
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

      // Construct the form URL: table.do
      const formUrl = `${instanceUrl}/${tableName}.do`;

      ui.showSuccess(`Opening ${displayName} form...`);
      ui.hide();

      window.location.href = formUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
