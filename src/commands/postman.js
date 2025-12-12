/**
 * Postman Command
 *
 * Generate a Postman collection from a sys_ws_definition record.
 * User should be on a sys_ws_definition record form when running this command.
 * 
 * Queries:
 * - sys_ws_definition: API definition details
 * - sys_ws_operation: API operations/endpoints
 * - sys_ws_query_parameter: Query parameters for operations
 *
 * Usage: postman
 * Example: postman (while on a sys_ws_definition form)
 */

(function() {
  const command = {
    name: 'postman',
    aliases: ['pm', 'collection'],
    description: 'Generate Postman collection from current API definition',
    usage: 'postman',
    examples: [
      'postman - Generate collection from current sys_ws_definition record'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      return true;
    },

    /**
     * Get the current record's sys_id from the URL or page
     * @returns {string|null} - The sys_id or null if not found
     */
    getCurrentSysId() {
      const url = window.location.href;
      
      // Decode URL in case it's encoded
      const decodedUrl = decodeURIComponent(url);
      
      // Try sys_id parameter (standard format)
      const sysIdMatch = decodedUrl.match(/sys_id=([a-f0-9]{32})/i);
      if (sysIdMatch) {
        return sysIdMatch[1];
      }

      // Try URL path format (workspace/UI format)
      const pathMatch = decodedUrl.match(/\/([a-f0-9]{32})(?:\?|$|#|\/)/i);
      if (pathMatch) {
        return pathMatch[1];
      }

      // Try to get from page's g_form object
      if (typeof g_form !== 'undefined' && g_form.getUniqueValue) {
        try {
          const sysId = g_form.getUniqueValue();
          if (sysId && /^[a-f0-9]{32}$/i.test(sysId)) {
            return sysId;
          }
        } catch (e) {
        }
      }

      // Try to get from NOW.sysId (some pages use this)
      if (typeof NOW !== 'undefined' && NOW.sysId) {
        return NOW.sysId;
      }

      // Try to find sys_id in hidden form field
      const sysIdField = document.querySelector('input[name="sys_id"], input[id="sys_uniqueValue"]');
      if (sysIdField && sysIdField.value && /^[a-f0-9]{32}$/i.test(sysIdField.value)) {
        return sysIdField.value;
      }

      // Try iframe content if in classic UI
      try {
        const iframe = document.querySelector('iframe#gsft_main');
        if (iframe && iframe.contentWindow) {
          const iframeUrl = iframe.contentWindow.location.href;
          const decodedIframeUrl = decodeURIComponent(iframeUrl);
          const iframeSysIdMatch = decodedIframeUrl.match(/sys_id=([a-f0-9]{32})/i);
          if (iframeSysIdMatch) {
            return iframeSysIdMatch[1];
          }
        }
      } catch (e) {
      }
      return null;
    },

    /**
     * Check if we're on a sys_ws_definition form
     * @returns {boolean}
     */
    isOnApiDefinitionForm() {
      const url = decodeURIComponent(window.location.href);
      
      // Check main URL
      if (url.includes('sys_ws_definition')) {
        return true;
      }

      // Check iframe URL for classic UI
      try {
        const iframe = document.querySelector('iframe#gsft_main');
        if (iframe && iframe.contentWindow) {
          const iframeUrl = decodeURIComponent(iframe.contentWindow.location.href);
          if (iframeUrl.includes('sys_ws_definition')) {
            return true;
          }
        }
      } catch (e) {
        // Cross-origin or no iframe
      }

      return false;
    },

    /**
     * Build the background script to fetch API definition and operations
     * @param {string} sysId - The sys_ws_definition sys_id
     * @returns {string} - The GlideRecord script
     */
    buildFetchScript(sysId) {
      return `
function getApiDefinition() {
  var result = {
    definition: null,
    operations: [],
    parameters: {}
  };

  // Get the API definition
  var defGr = new GlideRecord('sys_ws_definition');
  if (defGr.get('${sysId}')) {
    result.definition = {
      sys_id: defGr.getUniqueValue(),
      name: defGr.getValue('name') || '',
      service_id: defGr.getValue('service_id') || '',
      namespace: defGr.getValue('namespace') || '',
      doc_link: defGr.getValue('doc_link') || '',
      short_description: defGr.getValue('short_description') || '',
      version: defGr.getValue('version') || '',
      active: defGr.getValue('active') || 'true',
      base_uri: defGr.getValue('base_uri') || '',
      produces: defGr.getValue('produces') || 'application/json',
      consumes: defGr.getValue('consumes') || 'application/json',
      enforce_acl: defGr.getValue('enforce_acl') || ''
    };
  }

  if (!result.definition) {
    gs.print('###RESULTS###');
    gs.print(JSON.stringify({ error: 'API definition not found' }));
    gs.print('###END###');
    return;
  }

  // Get all operations for this API
  var opGr = new GlideRecord('sys_ws_operation');
  opGr.addQuery('web_service_definition', '${sysId}');
  opGr.orderBy('relative_path');
  opGr.query();

  while (opGr.next()) {
    var opSysId = opGr.getUniqueValue();
    var operation = {
      sys_id: opSysId,
      name: opGr.getValue('name') || '',
      http_method: opGr.getValue('http_method') || 'GET',
      relative_path: opGr.getValue('relative_path') || '',
      short_description: opGr.getValue('short_description') || '',
      requires_authentication: opGr.getValue('requires_authentication') || 'true',
      requires_acl_authorization: opGr.getValue('requires_acl_authorization') || '',
      requires_snc_internal_role: opGr.getValue('requires_snc_internal_role') || '',
      active: opGr.getValue('active') || 'true',
      produces: opGr.getValue('produces') || '',
      consumes: opGr.getValue('consumes') || '',
      request_example: opGr.getValue('request_example') || '',
      operation_script: opGr.getValue('operation_script') || ''
    };
    result.operations.push(operation);
    result.parameters[opSysId] = [];
  }

  // Get query parameters for all operations
  var paramGr = new GlideRecord('sys_ws_query_parameter');
  paramGr.addQuery('web_service_operation.web_service_definition', '${sysId}');
  paramGr.query();

  while (paramGr.next()) {
    var opRef = paramGr.getValue('web_service_operation');
    if (result.parameters[opRef]) {
      result.parameters[opRef].push({
        name: paramGr.getValue('name') || '',
        example: paramGr.getValue('example') || '',
        required: paramGr.getValue('required') || 'false',
        type: paramGr.getValue('type') || 'string',
        short_description: paramGr.getValue('short_description') || ''
      });
    }
  }

  gs.print('###RESULTS###');
  gs.print(JSON.stringify(result));
  gs.print('###END###');
}

getApiDefinition();`;
    },

    /**
     * Generate Postman collection from API data
     * @param {Object} apiData - The API definition and operations data
     * @param {string} instanceUrl - the platform instance URL
     * @returns {Object} - Postman collection object
     */
    generatePostmanCollection(apiData, instanceUrl) {
      const { definition, operations, parameters } = apiData;
      
      // Build base URL
      const baseUrl = instanceUrl.replace(/\/$/, '');
      const apiPath = definition.base_uri || `/api/${definition.namespace}/${definition.service_id}`;
      
      // Create collection structure
      const collection = {
        info: {
          _postman_id: this.generateUUID(),
          name: definition.name || definition.service_id || 'Platform API',
          description: definition.short_description || `API: ${definition.name}`,
          schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
        },
        auth: {
          type: 'basic',
          basic: [
            {
              key: 'password',
              value: '{{password}}',
              type: 'string'
            },
            {
              key: 'username',
              value: '{{username}}',
              type: 'string'
            }
          ]
        },
        variable: [
          {
            key: 'instance',
            value: baseUrl,
            type: 'string'
          },
          {
            key: 'username',
            value: '',
            type: 'string'
          },
          {
            key: 'password',
            value: '',
            type: 'string'
          }
        ],
        item: []
      };

      // Add operations as requests
      operations.forEach(op => {
        if (op.active === 'false') return;

        const opParams = parameters[op.sys_id] || [];
        
        // Build URL with path variables
        let relativePath = op.relative_path || '';
        const pathVariables = [];
        
        // Extract path variables like {id} or {tableName}
        const pathVarMatches = relativePath.match(/\{([^}]+)\}/g);
        if (pathVarMatches) {
          pathVarMatches.forEach(match => {
            const varName = match.replace(/[{}]/g, '');
            pathVariables.push({
              key: varName,
              value: '',
              description: `Path variable: ${varName}`
            });
          });
          // Convert {var} to :var for Postman
          relativePath = relativePath.replace(/\{([^}]+)\}/g, ':$1');
        }

        // Build query parameters
        const queryParams = opParams.map(param => ({
          key: param.name,
          value: param.example || '',
          description: param.short_description || (param.required === 'true' ? 'Required' : 'Optional'),
          disabled: param.required !== 'true'
        }));

        // Build request body for POST/PUT/PATCH
        let body = null;
        const methodsWithBody = ['POST', 'PUT', 'PATCH'];
        if (methodsWithBody.includes(op.http_method.toUpperCase())) {
          let rawBody = '{}';
          if (op.request_example) {
            try {
              // Try to parse and re-stringify for formatting
              const parsed = JSON.parse(op.request_example);
              rawBody = JSON.stringify(parsed, null, 2);
            } catch (e) {
              rawBody = op.request_example;
            }
          }
          body = {
            mode: 'raw',
            raw: rawBody,
            options: {
              raw: {
                language: 'json'
              }
            }
          };
        }

        // Build the request item
        const requestItem = {
          name: op.name || op.relative_path || op.http_method,
          request: {
            method: op.http_method.toUpperCase(),
            header: [
              {
                key: 'Content-Type',
                value: op.consumes || definition.consumes || 'application/json'
              },
              {
                key: 'Accept',
                value: op.produces || definition.produces || 'application/json'
              }
            ],
            url: {
              raw: `{{instance}}${apiPath}${relativePath}`,
              host: ['{{instance}}'],
              path: (apiPath + relativePath).split('/').filter(p => p),
              query: queryParams,
              variable: pathVariables
            },
            description: op.short_description || ''
          },
          response: []
        };

        if (body) {
          requestItem.request.body = body;
        }

        collection.item.push(requestItem);
      });

      return collection;
    },

    /**
     * Generate a UUID for Postman collection
     * @returns {string}
     */
    generateUUID() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    },

    /**
     * Download the collection as a JSON file
     * @param {Object} collection - Postman collection object
     * @param {string} fileName - File name for download
     */
    downloadCollection(collection, fileName) {
      const json = JSON.stringify(collection, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    /**
     * Execute the postman command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;

      // Check if we're on a sys_ws_definition form
      if (!this.isOnApiDefinitionForm()) {
        ui.showError('Please navigate to a sys_ws_definition record form first.');
        return;
      }

      // Get the current record's sys_id
      const sysId = this.getCurrentSysId();
      if (!sysId) {
        ui.showError('Unable to detect the current record sys_id. Please ensure you are on a sys_ws_definition form.');
        return;
      }

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      try {
        ui.showInfo('Fetching API definition...');

        // Execute background script to get API data
        const script = this.buildFetchScript(sysId);
        const results = await window.GlassBackgroundScript.executeAndParse(
          script,
          '###RESULTS###',
          '###END###',
          { instanceUrl }
        );

        if (!results || results.length === 0) {
          ui.showError('Failed to fetch API definition data.');
          return;
        }

        const apiData = results[0];

        if (apiData.error) {
          ui.showError(apiData.error);
          return;
        }

        if (!apiData.definition) {
          ui.showError('API definition not found.');
          return;
        }

        ui.showInfo('Generating Postman collection...');

        // Generate the Postman collection
        const collection = this.generatePostmanCollection(apiData, instanceUrl);

        // Generate filename
        const apiName = apiData.definition.name || apiData.definition.service_id || 'api';
        const safeName = apiName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${safeName}_postman_collection.json`;

        // Download the collection
        this.downloadCollection(collection, fileName);

        ui.showSuccess(`Postman collection "${apiName}" downloaded successfully!`);
        
        // Show summary in results page
        const resultsPage = window.GlassResultsPage;
        if (resultsPage) {
          const statsHtml = resultsPage.buildStats([
            { value: apiData.operations.length, label: 'Endpoints' },
            { value: Object.values(apiData.parameters).flat().length, label: 'Parameters' }
          ]);

          const operationCards = apiData.operations.map(op => ({
            title: `${op.http_method.toUpperCase()} ${op.relative_path || '/'}`,
            subtitle: op.short_description || op.name,
            badge: op.active === 'true' ? '' : 'Inactive'
          }));

          const content = `
            ${resultsPage.buildSection('API Details', resultsPage.buildCard({
              title: apiData.definition.name || apiData.definition.service_id,
              subtitle: apiData.definition.short_description || 'No description',
              meta: `Namespace: ${apiData.definition.namespace} | Version: ${apiData.definition.version || '1.0'}`
            }))}
            ${statsHtml}
            ${resultsPage.buildSection('Endpoints', resultsPage.buildCardGrid(operationCards))}
            ${resultsPage.buildSection('Import Instructions', `
              <div class="glass-card">
                <div class="glass-card-title">How to Import</div>
                <div class="glass-card-subtitle">
                  1. Open Postman<br>
                  2. Click <span class="glass-code">Import</span> button<br>
                  3. Select the downloaded <span class="glass-code">${fileName}</span> file<br>
                  4. Set your <span class="glass-code">username</span> and <span class="glass-code">password</span> variables<br>
                  5. Start making API calls!
                </div>
              </div>
            `)}
          `;

          const html = resultsPage.buildPage({
            title: 'Postman Collection Generated',
            subtitle: `${apiData.definition.name || apiData.definition.service_id}`,
            content: content
          });

          resultsPage.openPage(html);
        }

        ui.hide();

      } catch (error) {
        ui.showError(`Failed to generate Postman collection: ${error.message}`);
      }
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();

