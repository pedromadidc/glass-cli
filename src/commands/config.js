/**
 * Config Command
 *
 * Navigate to the configuration/personalization page for a table.
 * Uses the same table auto-complete as the list command.
 *
 * Usage: config <table_name>
 * Example: config incident
 */

(function() {
  const command = {
    name: 'config',
    aliases: ['personalize', 'configure'],
    description: 'Open table configuration/personalization',
    usage: 'config <table_name>',
    examples: [
      'config incident    - Open incident table configuration',
      'config user        - Open sys_user table configuration',
      'config change      - Open change_request configuration'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      if (args.length === 0) {
        return 'Usage: config <table_name>';
      }
      return true;
    },

    /**
     * Execute the config command
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

      // Construct the config URL: personalize_all.do?sysparm_rules_table=table&sysparm_rules_label=table&sysparm_clear_stack=true
      const configUrl = `${instanceUrl}/personalize_all.do?sysparm_rules_table=${encodeURIComponent(tableName)}&sysparm_rules_label=${encodeURIComponent(tableName)}&sysparm_clear_stack=true`;

      ui.showSuccess(`Opening ${displayName} configuration...`);
      ui.hide();

      window.location.href = configUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
