/**
 * ACL Command
 *
 * Check ACL permissions for a user on a table/record/field.
 * Runs a background script to evaluate ACLs and shows detailed results.
 *
 * Usage: acl <username> <table> [record_sys_id] [field]
 * Example: acl admin incident
 *          acl admin incident a1b2c3d4
 *          acl admin incident a1b2c3d4 short_description
 */

(function() {
  const command = {
    name: 'acl',
    aliases: ['security', 'permissions'],
    description: 'Check ACL permissions for a user on a table/record/field',
    usage: 'acl <username> <table> [record_sys_id] [field]',
    examples: [
      'acl admin incident                   - Check ACLs for admin user on incident table',
      'acl admin incident a1b2c3d4...            - Check ACLs for admin on specific record',
      'acl admin incident a1b2c3d4... state      - Check field-level ACLs'
    ],

    /**
     * Validate arguments
     */
    validate(args) {
      if (args.length === 0 || args[0].toLowerCase() === 'help') {
        return 'Usage: acl <username> <table> [record_sys_id] [field]\n\nExamples:\n  acl admin incident\n  acl admin incident abc123\n  acl admin incident abc123 state';
      }
      if (args.length < 2) {
        return 'Usage: acl <username> <table> [record_sys_id] [field]\nBoth username and table are required.';
      }
      return true;
    },

    /**
     * Build the background script to check ACLs
     * @param {string} userIdentifier - Username (not sys_id)
     * @param {string} table - Internal table name
     * @param {string} recordSysId - Record sys_id (optional)
     * @param {string} fieldName - Internal field name (optional)
     * @returns {string} - The GlideRecord script
     */
    buildAclScript(userIdentifier, table, recordSysId, fieldName) {
      return `
(function () {
  var USER_IDENTIFIER = "${userIdentifier}";
  var TABLE = "${table}";
  var RECORD_SYS_ID = "${recordSysId || ''}";
  var FIELD_NAME = "${fieldName || ''}";
  var SCRIPT_PREVIEW_CHARS = 800;

  function bool(v) { return v === true; }

  function splitCsv(s) {
    if (!s) return [];
    var p = ("" + s).split(",");
    var o = [];
    for (var i = 0; i < p.length; i++) if (p[i]) o.push(p[i]);
    return o;
  }

  function resolveUserSysId(identifier) {
    if (!identifier) {
      return gs.getUserID();
    }
    if (identifier.length === 32 && /^[a-f0-9]+$/.test(identifier)) {
      return identifier;
    }
    var gr = new GlideRecord("sys_user");
    gr.addQuery("user_name", identifier);
    gr.setLimit(1);
    gr.query();
    if (gr.next()) {
      return gr.getUniqueValue();
    }
    gr = new GlideRecord("sys_user");
    gr.addQuery("sys_id", identifier);
    gr.setLimit(1);
    gr.query();
    if (gr.next()) {
      return gr.getUniqueValue();
    }
    return null;
  }

  function getUserInfo(userSysId) {
    var gr = new GlideRecord("sys_user");
    if (gr.get(userSysId)) {
      return {
        sys_id: gr.getUniqueValue(),
        user_name: "" + gr.user_name,
        name: "" + gr.name,
        email: "" + gr.email
      };
    }
    return null;
  }

  function getUserRoleNames(userSysId) {
    var roles = [];
    var gr = new GlideRecord("sys_user_has_role");
    gr.addQuery("user", userSysId);
    gr.query();
    while (gr.next()) roles.push("" + gr.role.name);
    roles.sort();
    return roles;
  }

  function getRoleNamesFromSysIds(roleIdsCsv) {
    var ids = splitCsv(roleIdsCsv);
    if (!ids.length) return [];
    var names = [];
    var gr = new GlideRecord("sys_user_role");
    gr.addQuery("sys_id", "IN", ids.join(","));
    gr.query();
    while (gr.next()) names.push("" + gr.name);
    names.sort();
    return names;
  }

  function userHasAnyRole(userRoles, requiredRoles) {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    var map = {};
    for (var i = 0; i < userRoles.length; i++) map[userRoles[i]] = true;
    for (var j = 0; j < requiredRoles.length; j++) {
      if (map[requiredRoles[j]]) return true;
    }
    return false;
  }

  function getMatchingAcls(table, operation, fieldName) {
    var names = [table];
    if (fieldName) {
      names.push(table + "." + fieldName);
      names.push(table + ".*");
    }
    var gr = new GlideRecord("sys_security_acl");
    gr.addQuery("active", true);
    gr.addQuery("operation", operation);
    var qc = gr.addQuery("name", names[0]);
    for (var i = 1; i < names.length; i++) qc.addOrCondition("name", names[i]);
    gr.orderByDesc("name");
    gr.query();
    var out = [];
    while (gr.next()) {
      out.push({
        sys_id: "" + gr.getUniqueValue(),
        name: "" + gr.name,
        operation: "" + gr.operation,
        type: "" + gr.type,
        roles_sys_ids: "" + (gr.roles || ""),
        condition: "" + (gr.condition || ""),
        script: "" + (gr.script || ""),
        admin_overrides: bool(gr.admin_overrides)
      });
    }
    return out;
  }

  function summarizeAcl(acl, userRoles) {
    var requiredRoles = getRoleNamesFromSysIds(acl.roles_sys_ids);
    var rolePass = userHasAnyRole(userRoles, requiredRoles);
    var hasCond = acl.condition && acl.condition.length > 0;
    var hasScript = acl.script && acl.script.length > 0;
    var preview = "";
    if (hasScript) {
      preview = acl.script;
      if (preview.length > SCRIPT_PREVIEW_CHARS) {
        preview = preview.substring(0, SCRIPT_PREVIEW_CHARS) + "\\n...<truncated>";
      }
    }
    return {
      acl_sys_id: acl.sys_id,
      acl_name: acl.name,
      operation: acl.operation,
      type: acl.type,
      admin_overrides: acl.admin_overrides,
      required_roles: requiredRoles,
      user_has_required_role: rolePass,
      has_condition: hasCond,
      condition: hasCond ? acl.condition : "",
      has_script: hasScript,
      script_preview: preview,
      likely_blocker: (!rolePass || hasCond || hasScript)
    };
  }

  function run() {
    var session = gs.getSession();
    var originalUserId = gs.getUserID();
    var userSysId = resolveUserSysId(USER_IDENTIFIER);

    if (!userSysId) {
      return {
        error: "User not found: " + USER_IDENTIFIER
      };
    }

    var userInfo = getUserInfo(userSysId);
    var out = {
      user: userInfo,
      table: TABLE,
      record: RECORD_SYS_ID || "(table-level)",
      field: FIELD_NAME || "",
      mode: RECORD_SYS_ID ? "record" : "table",
      user_roles: [],
      checks: {},
      acls: { read: [], write: [], create: [], "delete": [] }
    };

    try {
      session.impersonate(userSysId);
      out.user_roles = getUserRoleNames(userSysId);

      var gr = new GlideRecord(TABLE);
      if (RECORD_SYS_ID) {
        out.checks.found_record = gr.get(RECORD_SYS_ID);
        if (!out.checks.found_record) {
          out.checks.error = "Record not found or not accessible.";
          return out;
        }
      }

      out.checks.read = bool(gr.canRead());
      out.checks.write = bool(gr.canWrite());
      out.checks.create = bool(gr.canCreate());
      out.checks["delete"] = bool(gr.canDelete());

      out.checks.field_read = null;
      out.checks.field_write = null;
      if (FIELD_NAME) {
        try {
          var el = gr.getElement(FIELD_NAME);
          if (el) {
            if (typeof el.canRead == "function") out.checks.field_read = bool(el.canRead());
            if (typeof el.canWrite == "function") out.checks.field_write = bool(el.canWrite());
          }
        } catch (e1) {
          out.checks.field_error = "" + e1;
        }
      }

      var ops = ["read", "write", "create", "delete"];
      for (var i = 0; i < ops.length; i++) {
        var op = ops[i];
        var acls = getMatchingAcls(TABLE, op, FIELD_NAME);
        for (var k = 0; k < acls.length; k++) {
          out.acls[op].push(summarizeAcl(acls[k], out.user_roles));
        }
      }

      return out;
    } finally {
      session.impersonate(originalUserId);
    }
  }

  var result = run();
  gs.print('###GLASSRESULTS###' + JSON.stringify(result) + '###GLASSEND###');
})();`;
    },

    /**
     * Build HTML content for ACL results
     * @param {Object} data - ACL check results
     * @param {string} instanceUrl - instance URL
     * @returns {string} - HTML content
     */
    buildResultsContent(data, instanceUrl) {
      const resultsPage = window.GlassResultsPage;

      if (data.error) {
        return `<div class="glass-card" style="border-color: rgba(229, 115, 115, 0.5);">
          <div class="glass-card-title" style="color: #e57373;">Error</div>
          <div class="glass-card-subtitle">${this.escapeHtml(data.error)}</div>
        </div>`;
      }

      // Check for nested error in checks
      if (data.checks && data.checks.error) {
        return `<div class="glass-card" style="border-color: rgba(229, 115, 115, 0.5);">
          <div class="glass-card-title" style="color: #e57373;">Error</div>
          <div class="glass-card-subtitle">${this.escapeHtml(data.checks.error)}</div>
        </div>`;
      }

      let html = '';

      // User info section
      if (data.user) {
        html += resultsPage.buildSection('User', `
          <div class="glass-card">
            <div class="glass-card-title">${this.escapeHtml(data.user.name || data.user.user_name)}</div>
            <div class="glass-card-subtitle">Username: ${this.escapeHtml(data.user.user_name)}</div>
            <div class="glass-card-meta">Email: ${this.escapeHtml(data.user.email || 'N/A')}</div>
          </div>
        `);
      }

      // Stats section
      const checks = data.checks || {};
      const passCount = ['read', 'write', 'create', 'delete'].filter(op => checks[op]).length;
      const userRoles = data.user_roles || [];
      const statsHtml = resultsPage.buildStats([
        { value: this.escapeHtml(data.table), label: 'Table' },
        { value: data.mode === 'record' ? 'Record' : 'Table', label: 'Check Mode' },
        { value: `${passCount}/4`, label: 'Operations Passed' },
        { value: userRoles.length, label: 'User Roles' }
      ]);
      html += statsHtml;

      // Permission checks section
      const checkBadge = (val) => val === true 
        ? '<span style="color: #81c784;">✓ Allowed</span>' 
        : val === false 
          ? '<span style="color: #e57373;">✗ Denied</span>'
          : '<span style="color: rgba(255,255,255,0.5);">N/A</span>';

      let checksHtml = `
        <div class="glass-card">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 16px; text-align: center;">
            <div>
              <div style="font-size: 24px; margin-bottom: 4px;">${checkBadge(checks.read)}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6);">READ</div>
            </div>
            <div>
              <div style="font-size: 24px; margin-bottom: 4px;">${checkBadge(checks.write)}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6);">WRITE</div>
            </div>
            <div>
              <div style="font-size: 24px; margin-bottom: 4px;">${checkBadge(checks.create)}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6);">CREATE</div>
            </div>
            <div>
              <div style="font-size: 24px; margin-bottom: 4px;">${checkBadge(checks.delete)}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.6);">DELETE</div>
            </div>
          </div>
        </div>
      `;

      if (data.field) {
        checksHtml += `
          <div class="glass-card" style="margin-top: 12px;">
            <div class="glass-card-title">Field: ${this.escapeHtml(data.field)}</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; text-align: center;">
              <div>
                <div style="font-size: 20px; margin-bottom: 4px;">${checkBadge(checks.field_read)}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.6);">Field Read</div>
              </div>
              <div>
                <div style="font-size: 20px; margin-bottom: 4px;">${checkBadge(checks.field_write)}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.6);">Field Write</div>
              </div>
            </div>
          </div>
        `;
      }

      html += resultsPage.buildSection('Permission Checks', checksHtml);

      // User roles section
      if (userRoles.length > 0) {
        const rolesHtml = userRoles.map(role => 
          `<span style="display: inline-block; background: rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 12px; margin: 2px; font-size: 12px;">${this.escapeHtml(role)}</span>`
        ).join('');
        html += resultsPage.buildSection('User Roles', `<div class="glass-card">${rolesHtml}</div>`);
      }

      // ACL details for each operation
      const aclData = data.acls || {};
      const operations = ['read', 'write', 'create', 'delete'];
      for (const op of operations) {
        const acls = aclData[op] || [];
        if (acls.length > 0) {
          const aclCards = acls.map(acl => this.buildAclCard(acl, instanceUrl)).join('');
          html += resultsPage.buildSection(
            `${op.toUpperCase()} ACLs (${acls.length})`,
            aclCards
          );
        }
      }

      return html;
    },

    /**
     * Build HTML card for a single ACL
     * @param {Object} acl - ACL data
     * @param {string} instanceUrl - instance URL
     * @returns {string} - HTML card
     */
    buildAclCard(acl, instanceUrl) {
      const statusColor = acl.likely_blocker ? 'rgba(255, 183, 77, 0.8)' : 'rgba(129, 199, 132, 0.8)';
      const statusText = acl.likely_blocker ? '⚠ May Block' : '✓ Likely Pass';
      const rolePassColor = acl.user_has_required_role ? '#81c784' : '#e57373';
      const rolePassText = acl.user_has_required_role ? '✓ Has Role' : '✗ Missing Role';

      let cardHtml = `
        <div class="glass-card" style="border-left: 3px solid ${statusColor};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div class="glass-card-title">
                <a href="${instanceUrl}/sys_security_acl.do?sys_id=${acl.acl_sys_id}" target="_blank" 
                   style="color: rgba(200, 220, 255, 0.9); text-decoration: none;">
                  ${this.escapeHtml(acl.acl_name)}
                </a>
              </div>
              <div class="glass-card-subtitle">Type: ${this.escapeHtml(acl.type)}</div>
            </div>
            <div style="text-align: right;">
              <div style="color: ${statusColor}; font-size: 12px; font-weight: 500;">${statusText}</div>
            </div>
          </div>
          
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="margin-bottom: 8px;">
              <span style="color: rgba(255,255,255,0.6); font-size: 12px;">Required Roles:</span>
              <span style="color: ${rolePassColor}; font-size: 12px; margin-left: 8px;">${rolePassText}</span>
            </div>
            <div style="font-size: 12px;">
              ${acl.required_roles.length > 0 
                ? acl.required_roles.map(r => `<span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 8px; margin-right: 4px;">${this.escapeHtml(r)}</span>`).join('')
                : '<span style="color: rgba(255,255,255,0.4);">None (public)</span>'
              }
            </div>
          </div>
      `;

      if (acl.has_condition) {
        cardHtml += `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="color: rgba(255,255,255,0.6); font-size: 12px; margin-bottom: 4px;">Condition:</div>
            <code style="display: block; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; font-size: 11px; color: rgba(200, 220, 240, 0.9); word-break: break-all;">${this.escapeHtml(acl.condition)}</code>
          </div>
        `;
      }

      if (acl.has_script) {
        cardHtml += `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div style="color: rgba(255,255,255,0.6); font-size: 12px; margin-bottom: 4px;">Script:</div>
            <pre style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; font-size: 11px; max-height: 200px; overflow: auto; margin: 0;">${this.escapeHtml(acl.script_preview)}</pre>
          </div>
        `;
      }

      cardHtml += '</div>';
      return cardHtml;
    },

    /**
     * Escape HTML special characters
     * @param {string} str - String to escape
     * @returns {string} - Escaped string
     */
    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    /**
     * Execute the acl command
     */
    async execute(args, ctx) {
      const { ui, context } = ctx;
      const resultsPage = window.GlassResultsPage;

      const instanceUrl = await context.getInstanceUrl();
      if (!instanceUrl) {
        ui.showError('Unable to detect instance.');
        return;
      }

      // Parse arguments: username table [record_sys_id] [field]
      const user = args[0];
      const table = args[1];
      const recordSysId = args[2] || '';
      const fieldName = args[3] || '';

      // Table name should be internal name (no resolution needed)
      const tableName = table;

      try {
        ui.showInfo('Checking ACL permissions...');

        // Execute background script
        const script = this.buildAclScript(user, tableName, recordSysId, fieldName);
        const rawHtml = await window.GlassBackgroundScript.execute(script, { instanceUrl });
        
        // Parse results manually
        const cleanedHtml = window.GlassBackgroundScript.cleanHtmlOutput(rawHtml);
        
        const match = cleanedHtml.match(/###GLASSRESULTS###([\s\S]*?)###GLASSEND###/);
        if (!match) {
          ui.showError('No ACL data returned. Check the console for raw output.');
          return;
        }
        
        let results = [];
        try {
          const jsonStr = match[1].replace(/\*\*\* Script: /g, '').trim();
          results = [JSON.parse(jsonStr)];
        } catch (parseError) {
          ui.showError('Failed to parse ACL results. Check console.');
          return;
        }

        if (!results || results.length === 0) {
          ui.showError('No ACL data returned. Check if table exists.');
          return;
        }

        const data = results[0];

        if (data.error) {
          ui.showError(data.error);
          return;
        }

        if (data.checks && data.checks.error) {
          ui.showError(data.checks.error);
          return;
        }

        // Build the results page
        const content = this.buildResultsContent(data, instanceUrl);

        const subtitle = fieldName 
          ? `${tableName}.${fieldName} for ${data.user?.name || user || 'current user'}`
          : `${tableName} for ${data.user?.name || user || 'current user'}`;

        const html = resultsPage.buildPage({
          title: 'ACL Check Results',
          subtitle: subtitle,
          content: content
        });

        resultsPage.openPage(html);
        ui.hide();

      } catch (error) {
        ui.showError(`Failed to check ACLs: ${error.message}`);
      }
    }
  };

  // Register command
  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();

