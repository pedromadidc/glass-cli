/**
 * Cache Command
 *
 * Clear platform caches by making a background GET request to /cache.do
 * No visual interface - just clears caches silently.
 *
 * Usage: cache
 * Example: cache
 */

(function() {
  const command = {
    name: 'cache',
    aliases: ['flush', 'clearcache'],
    description: 'Clear platform caches',
    usage: 'cache',
    examples: [
      'cache - Clear all platform caches'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      // No arguments needed
      return true;
    },

    /**
     * Execute the cache command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      try {
        ui.showInfo('Clearing platform caches...');

        // Make background GET request to /cache.do
        const cacheUrl = `${instanceUrl}/cache.do`;

        // Use fetch to make the request without leaving the page
        const response = await fetch(cacheUrl, {
          method: 'GET',
          credentials: 'same-origin',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Cache-Control': 'no-cache'
          }
        });

        if (response.ok) {
          ui.showSuccess('platform caches cleared successfully!');
        } else {
          // Even if not 200, the request might have triggered cache clearing
          ui.showSuccess('Cache clearing request sent (check server response)');
        }

      } catch (error) {
        ui.showError(`Failed to clear caches: ${error.message}`);
      }
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
