/**
 * XML Command
 *
 * Export the currently opened record to XML and download.
 *
 * Usage: xml
 * Example: xml
 */

(function() {
  const command = {
    name: 'xml',
    aliases: ['export', 'unload'],
    description: 'Export current record to XML',
    usage: 'xml',
    examples: [
      'xml - Export the currently viewed record as XML'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      // No arguments needed
      return true;
    },

    /**
     * Execute the xml command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;

      // Try to extract table and sys_id from current URL
      // Handle various URL patterns including navigation URLs
      const currentUrl = window.location.href;

      // First, try to decode URL-encoded characters
      const decodedUrl = decodeURIComponent(currentUrl);

      // Match patterns for different URL structures
      let urlMatch = null;

      // Pattern 1: Direct table.do URLs
      urlMatch = decodedUrl.match(/\/([^\/]+)\.do.*(?:sys_id=|sysparm_sys_id=)([a-f0-9]{32})/i);

      // Pattern 2: Navigation URLs with params/target/
      if (!urlMatch) {
        urlMatch = decodedUrl.match(/\/params\/target\/([^\/]+)\.do\?.*sys_id=([a-f0-9]{32})/i);
      }

      // Pattern 3: Simple sys_id parameter anywhere in URL
      if (!urlMatch) {
        urlMatch = decodedUrl.match(/sys_id=([a-f0-9]{32})/i);
        if (urlMatch) {
          // Try to extract table from URL path
          const tableMatch = decodedUrl.match(/\/([^\/]+)\.do/i);
          if (tableMatch) {
            urlMatch = [null, tableMatch[1], urlMatch[1]];
          }
        }
      }

      if (!urlMatch) {
        ui.showError('Unable to detect current record. Please make sure you are viewing a record page.');
        return;
      }

      const tableName = urlMatch[1];
      const sysId = urlMatch[2];

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      // Construct XML export URL: table.do?UNL&sysparm_query=sys_id=<sys_id>
      const xmlUrl = `${instanceUrl}/${tableName}.do?UNL&sysparm_query=sys_id=${sysId}`;

      ui.showSuccess(`Exporting ${tableName} record to XML...`);
      ui.hide();

      window.location.href = xmlUrl;
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
