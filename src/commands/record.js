/**
 * Record Command
 *
 * Open a record directly by sys_id or number.
 *
 * Usage: record <sys_id|number>
 * Examples:
 *   record 1234567890abcdef1234567890abcdef  - Open by sys_id
 *   record INC0010001                        - Open by incident number
 */

(function() {
  /**
   * Build the background script to find a sys_id across all tables
   * @param {string} sysId - The sys_id to search for
   * @returns {string} - The GlideRecord script
   */
  function buildSysIdFinderScript(sysId) {
    return `function findSysID(id) {
  function probeTable(name) {
    try {
      var gr = new GlideRecord(name);
      if (!gr.isValid()) return false;
      gr.addQuery("sys_id", id);
      gr.setLimit(1);
      gr.queryNoDomain();
      gr.query();
      if (gr.next()) {
        gs.print("###" + gr.getRecordClassName() + "^" + gr.getDisplayValue() + "###");
        return true;
      }
    } catch (e) {}
    return false;
  }

  // Preferred high-value tables first
  var preferred = ["sys_metadata", "task", "cmdb_ci", "sys_user", "kb_knowledge"];
  for (var i = 0; i < preferred.length; i++) {
    if (probeTable(preferred[i])) return;
  }

  // Fallback: iterate over scriptable tables
  var obj = new GlideRecord("sys_db_object");
  obj.addEncodedQuery("super_class=NULL^sys_update_nameISNOTEMPTY^nameNOT LIKE00^nameNOT LIKE$^scriptable_table=true^ORscriptable_tableISEMPTY");
  obj.query();
  while (obj.next()) {
    var name = obj.getValue("name") + "";
    if (name.startsWith("ts_") || name.startsWith("sysx_") || name.startsWith("v_") ||
        name.startsWith("sys_rollback_") || name.startsWith("pa_")) continue;
    if (probeTable(name)) return;
  }

  gs.print("###NOT_FOUND###");
}
findSysID("${sysId}");`;
  }

  /**
   * Parse the background script result
   * @param {string} payload - The extracted payload from ###...###
   * @returns {{ table: string, display: string } | null}
   */
  function parseResult(payload) {
    if (!payload || payload === 'NOT_FOUND') return null;
    const parts = payload.split('^');
    return {
      table: parts[0],
      display: parts[1] || ''
    };
  }

  const command = {
    name: 'record',
    aliases: ['open', 'goto'],
    description: 'Open a record directly by sys_id or number',
    usage: 'record <sys_id|number>',
    examples: [
      'record 1234567890abcdef1234567890abcdef - Open record by sys_id',
      'record INC0010001                       - Open incident by number'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      if (args.length !== 1) {
        return 'Usage: record <sys_id|number>';
      }
      if (!args[0] || args[0].trim() === '') {
        return 'Please provide a sys_id or record number.';
      }
      return true;
    },

    /**
     * Execute the record command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;
      const input = args[0].trim();

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      try {
        const recordInfo = this.parseRecordInput(input);

        if (!recordInfo) {
          ui.showError('Invalid input. Please provide a valid sys_id or record number.');
          return;
        }

        let recordUrl;

        if (recordInfo.table && recordInfo.sys_id) {
          // We have both table and sys_id
          recordUrl = `${instanceUrl}/${recordInfo.table}.do?sys_id=${recordInfo.sys_id}`;
        } else if (recordInfo.sys_id) {
          // We only have a sys_id: resolve via Background Script (headless)
          ui.showInfo('Resolving sys_id...');
          
          const script = buildSysIdFinderScript(recordInfo.sys_id);
          const payload = await window.GlassBackgroundScript.executeAndExtract(script, '###', '###', { instanceUrl });
          const result = parseResult(payload);

          if (!result || !result.table) {
            ui.showError('Could not find a record for this sys_id.');
            return;
          }

          recordUrl = `${instanceUrl}/${result.table}.do?sys_id=${recordInfo.sys_id}`;
        } else if (recordInfo.table && recordInfo.number) {
          // We have table and number - look up the sys_id via Table API
          try {
            const { api } = ctx;

            await api.ensureBridgeReady();

            const result = await api.tableGet(instanceUrl, recordInfo.table, {
              query: `number=${recordInfo.number}`,
              fields: ['sys_id'],
              limit: 1
            });

            if (result && result.length > 0) {
              recordUrl = `${instanceUrl}/${recordInfo.table}.do?sys_id=${result[0].sys_id}`;
            } else {
              ui.showError(`Record not found: ${recordInfo.number}`);
              return;
            }
          } catch (error) {
            recordUrl = `${instanceUrl}/${recordInfo.table}_list.do?sysparm_query=number=${recordInfo.number}`;
          }
        } else {
          ui.showError('Unable to construct record URL from input.');
          return;
        }

        ui.showSuccess('Opening record...');
        ui.hide();

        window.location.href = recordUrl;

      } catch (error) {
        ui.showError(`Failed to open record: ${error.message}`);
      }
    },

    /**
     * Parse the input to extract record information
     * @param {string} input - The input string
     * @returns {object|null} - Object with table, sys_id, and/or number properties
     */
    parseRecordInput(input) {
      // Pure sys_id
      if (/^[a-f0-9]{32}$/i.test(input)) {
        return { sys_id: input };
      }

      // Record number patterns (INC, CHG, etc.)
      const numberMatch = input.match(/^([A-Z]{2,5})(\d{5,})$/);
      if (numberMatch) {
        const [, prefix, number] = numberMatch;
        const table = this.getTableFromPrefix(prefix);
        if (table) {
          return { table, number: `${prefix}${number}` };
        }
      }

      return null;
    },

    /**
     * Get table name from record number prefix
     * @param {string} prefix - The prefix (INC, CHG, REQ, etc.)
     * @returns {string|null} - The table name or null if unknown
     */
    getTableFromPrefix(prefix) {
      const prefixMap = {
        'INC': 'incident',
        'CHG': 'change_request',
        'REQ': 'sc_request',
        'RITM': 'sc_req_item',
        'TASK': 'task',
        'PROB': 'problem',
        'PRB': 'problem',
        'KB': 'kb_knowledge',
        'CAT': 'sc_catalog',
        'CTASK': 'change_task',
        'STASK': 'sc_task'
      };

      return prefixMap[prefix.toUpperCase()] || null;
    }
  };

  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();