/**
 * Random Command
 *
 * Open a random record from a platform table.
 * Uses the same table auto-complete / resolver as the do/list commands.
 *
 * Usage: random <table_name>
 * Example: random incident
 */

(function() {
  const command = {
    name: 'random',
    aliases: ['rand', 'r'],
    description: 'Open a random record from a table',
    usage: 'random <table_name>',
    examples: [
      'random incident   - Open a random incident',
      'random user       - Open a random user',
      'rand change       - Open a random change request'
    ],

    validate(args) {
      if (args.length === 0) return 'Usage: random <table_name>';
      return true;
    },

    async execute(args, ctx) {
      const input = args.join(' ');
      const { ui, context, api } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      // Resolve table name (same pattern as do.js)
      const tableName = window.GlassResolveTableName
        ? window.GlassResolveTableName(input)
        : input.toLowerCase();

      // Friendly label if available
      const tables = typeof window.GlassTableDefinitions === 'function' ? window.GlassTableDefinitions() : [];
      const tableDef = tables.find(def => def.table === tableName);
      const displayName = tableDef ? `${tableDef.name} (${tableName})` : tableName;

      try {
        ui.showInfo(`Picking a random ${displayName}...`);

        // Fetch a batch of records using authenticated API
        // We'll get a larger batch and pick randomly from it
        const windowSize = 100;
        
        // First try with a random-ish query to get variety
        // Order by sys_updated_on DESC to get recent records, then pick randomly
        const results = await api.tableGet(instanceUrl, tableName, {
          fields: ['sys_id', 'number'],
          limit: windowSize,
          offset: 0,
          query: 'ORDERBYDESCsys_updated_on',
          displayValue: true
        });

        if (!results || results.length === 0) {
          // Try without ordering
          const fallbackResults = await api.tableGet(instanceUrl, tableName, {
            fields: ['sys_id', 'number'],
            limit: windowSize,
            offset: 0,
            displayValue: true
          });

          if (!fallbackResults || fallbackResults.length === 0) {
            ui.showError(`No accessible records found in ${displayName}.`);
            return;
          }

          const pick = fallbackResults[Math.floor(Math.random() * fallbackResults.length)];
          const sysId = pick?.sys_id;
          if (!sysId) throw new Error('Picked record has no sys_id');

          ui.showSuccess(`Opening random ${displayName}...`);
          ui.hide();
          window.location.href = `${instanceUrl}/${tableName}.do?sys_id=${sysId}`;
          return;
        }

        // Pick one randomly from the results
        const picked = results[Math.floor(Math.random() * results.length)];
        const sysId = picked?.sys_id;
        if (!sysId) throw new Error('Picked record has no sys_id');

        ui.showSuccess(`Opening random ${displayName}...`);
        ui.hide();

        // Open record form
        window.location.href = `${instanceUrl}/${tableName}.do?sys_id=${sysId}`;

      } catch (err) {
        ui.showError(`Random failed: ${err.message}`);
      }
    }
  };

  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
