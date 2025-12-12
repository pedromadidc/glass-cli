/**
 * Explode Command
 *
 * Show technical names for platform form fields, list columns, and option values.
 * Also reveals hidden platform form fields.
 *
 * Also adds a 🔗 link icon next to:
 *  - Each UI Action button in the form header (opens sys_ui_action)
 *  - Each Related Link (opens sys_ui_action)
 *
 * Usage: explode
 */

(function() {
  const command = {
    name: 'explode',
    aliases: ['ex', 'reveal', 'tn'],
    description: 'Show technical names for fields, columns, and option values',
    usage: 'explode',
    examples: [
      'explode   - Show all technical field names and option values'
    ],

    async execute(args, ctx) {
      const { ui } = ctx;

      ui.showSuccess('Exploding...');
      ui.hide();

      // Toggle off if already exploded
      if (this._checkAlreadyExploded()) {
        this._cleanupAll();
        return;
      }

      // Process main document and iframes
      this._processDocument(document);
      this._processAllIframes();
      this._addSummary();
    },

    _checkAlreadyExploded() {
      // any explode artifact counts
      if (document.querySelectorAll('.glass-tn, .glass-uia-link').length > 0) return true;
      for (const iframe of this._getAllIframes()) {
        try {
          if (iframe.contentDocument?.querySelectorAll('.glass-tn, .glass-uia-link').length > 0) return true;
        } catch (e) {}
      }
      return false;
    },

    _getAllIframes() {
      let iframes = [...document.querySelectorAll('iframe')];
      const gsftMain = document.getElementById('gsft_main');
      if (gsftMain && !iframes.includes(gsftMain)) iframes.unshift(gsftMain);
      try {
        const polarisNav = document.querySelector('[global-navigation-config]');
        if (polarisNav?.shadowRoot) {
          iframes = [...iframes, ...polarisNav.shadowRoot.querySelectorAll('iframe')];
        }
        const macroponent = document.querySelector('[macroponent-namespace]');
        if (macroponent?.shadowRoot) {
          const gsft = macroponent.shadowRoot.querySelector('#gsft_main');
          if (gsft) iframes.unshift(gsft);
        }
      } catch (e) {}
      return iframes;
    },

    _processAllIframes() {
      this._getAllIframes().forEach(iframe => {
        try {
          if (iframe.contentDocument) this._processDocument(iframe.contentDocument);
        } catch (e) {}
      });
    },

    _processDocument(doc) {
      this._injectStyles(doc);
      this._explodeFormFields(doc);
      this._explodeSelectOptions(doc);
      this._explodeListColumns(doc);
      this._explodeRelatedLists(doc);
      this._unhideFormFields(doc);

      // NEW: add sys_ui_action 🔗 links
      this._addUiActionLinks(doc);
    },

    _injectStyles(doc) {
      if (doc.getElementById('glass-explode-styles')) return;
      const style = doc.createElement('style');
      style.id = 'glass-explode-styles';
      style.textContent = `
        .glass-tn {
          font-family: 'SF Mono', 'Monaco', 'Consolas', monospace !important;
          font-size: 10px !important;
          font-weight: 500 !important;
          display: inline !important;
        }
        .glass-tn-field {
          color: #1565c0 !important;
          background: rgba(33, 150, 243, 0.12) !important;
          padding: 1px 4px !important;
          border-radius: 3px !important;
          margin-left: 4px !important;
        }
        .glass-tn-option {
          color: #7b1fa2 !important;
          background: rgba(156, 39, 176, 0.12) !important;
          padding: 0 3px !important;
          border-radius: 2px !important;
          margin-left: 4px !important;
          font-size: 9px !important;
        }
        .glass-tn-column {
          display: block !important;
          color: #7b1fa2 !important;
          background: rgba(156, 39, 176, 0.1) !important;
          padding: 2px 6px !important;
          border-radius: 3px !important;
          margin-top: 2px !important;
          margin-left: 25px !important;
          font-weight: normal !important;
        }
        .glass-tn-table {
          color: #2e7d32 !important;
          background: rgba(76, 175, 80, 0.12) !important;
          padding: 1px 4px !important;
          border-radius: 3px !important;
          margin-left: 4px !important;
        }
        .glass-unhidden {
          border-left: 3px solid #ff9800 !important;
          background-color: rgba(255, 152, 0, 0.05) !important;
        }
        .glass-unhidden-icon {
          color: #ff9800 !important;
          margin-right: 4px !important;
        }
        .glass-explode-summary {
          position: fixed !important;
          top: 20px !important;
          right: 20px !important;
          background: rgba(33, 150, 243, 0.95) !important;
          color: white !important;
          padding: 12px 16px !important;
          border-radius: 8px !important;
          font-family: 'SF Mono', monospace !important;
          font-size: 12px !important;
          z-index: 10002 !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
          cursor: pointer !important;
        }
        .glass-explode-summary:hover { background: rgba(33, 150, 243, 1) !important; }
        .glass-explode-summary .close-btn { float: right !important; margin-left: 8px !important; cursor: pointer !important; }

        /* NEW: UI Action sys_ui_action link icon */
        .glass-uia-link {
          display: inline-block !important;
          margin-left: 6px !important;
          font-size: 12px !important;
          line-height: 1 !important;
          text-decoration: none !important;
          opacity: 0.75 !important;
          vertical-align: middle !important;
          cursor: pointer !important;
        }
        .glass-uia-link:hover {
          opacity: 1 !important;
          text-decoration: none !important;
        }
      `;
      doc.head.appendChild(style);
    },

    /**
     * Add field names to platform form labels
     * Looks for element.tablename.fieldname and label.tablename.fieldname patterns
     */
    _explodeFormFields(doc) {
      // Pattern 1: Form groups with id="element.tablename.fieldname"
      doc.querySelectorAll('[id^="element."]').forEach(el => {
        try {
          const parts = el.id.split('.');
          if (parts.length < 3) return;
          const fieldName = parts.slice(2).join('.');
          const labelText = el.querySelector('.label-text');
          if (labelText && !labelText.querySelector('.glass-tn')) {
            const badge = doc.createElement('span');
            badge.className = 'glass-tn glass-tn-field';
            badge.textContent = ` | ${fieldName}`;
            labelText.appendChild(badge);
          }
        } catch (e) {}
      });

      // Pattern 2: Label divs with id="label.tablename.fieldname"
      doc.querySelectorAll('[id^="label."][data-type="label"]').forEach(el => {
        try {
          const parts = el.id.split('.');
          if (parts.length < 3) return;
          const fieldName = parts.slice(2).join('.');
          const labelText = el.querySelector('.label-text');
          if (labelText && !labelText.querySelector('.glass-tn')) {
            const badge = doc.createElement('span');
            badge.className = 'glass-tn glass-tn-field';
            badge.textContent = ` | ${fieldName}`;
            labelText.appendChild(badge);
          }
        } catch (e) {}
      });
    },

    /**
     * Show value attribute for platform select options
     * Only for selects that have platform-style IDs (tablename.fieldname)
     */
    _explodeSelectOptions(doc) {
      doc.querySelectorAll('select[id*="."], select[name*="."]').forEach(select => {
        try {
          select.querySelectorAll('option').forEach(option => {
            if (option.querySelector('.glass-tn')) return;
            const value = option.getAttribute('value');
            const text = option.textContent.trim();
            if (value !== null && value !== '' && value !== text) {
              const badge = doc.createElement('span');
              badge.className = 'glass-tn glass-tn-option';
              badge.textContent = `[${value}]`;
              option.appendChild(badge);
            }
          });
        } catch (e) {}
      });
    },

    /**
     * Show column names in platform list headers
     */
    _explodeListColumns(doc) {
      const selectors = ['th.list_hdr', 'th.table-column-header', 'th.list_hdrembedded'];
      selectors.forEach(selector => {
        try {
          doc.querySelectorAll(selector).forEach(header => {
            if (header.querySelector('.glass-tn')) return;
            const colName = header.getAttribute('name') || header.getAttribute('data-column-name');
            if (colName) {
              const badge = doc.createElement('div');
              badge.className = 'glass-tn glass-tn-column';
              badge.textContent = colName;
              header.appendChild(badge);
            }
          });
        } catch (e) {}
      });
    },

    /**
     * Show table names for related lists
     */
    _explodeRelatedLists(doc) {
      const selectors = [
        '#related_lists_wrapper .navbar-title',
        'h1.navbar-title.embedded',
        '.list_nav_top .navbar-title'
      ];
      selectors.forEach(selector => {
        try {
          doc.querySelectorAll(selector).forEach(header => {
            if (header.querySelector('.glass-tn')) return;
            const link = header.querySelector('a[data-list_id]');
            let listId = link?.getAttribute('data-list_id') || link?.dataset?.list_id;

            if (!listId) {
              const embedded = header.closest('div.embedded[tab_list_name_raw]');
              if (embedded) listId = embedded.getAttribute('tab_list_name_raw');
            }

            if (listId) {
              const parts = listId.split('.');
              const tbl = parts.length > 1 ? parts[1] : parts[0];
              const badge = doc.createElement('span');
              badge.className = 'glass-tn glass-tn-table';
              badge.textContent = ` | ${tbl}`;
              header.style.display = 'inline';
              header.appendChild(badge);
            }
          });
        } catch (e) {}
      });
    },

    /**
     * Unhide hidden platform form fields
     */
    _unhideFormFields(doc) {
      doc.querySelectorAll('[id^="element."].form-group').forEach(fg => {
        try {
          const style = fg.getAttribute('style') || '';
          if (
            (style.includes('display') && style.includes('none')) ||
            (style.includes('visibility') && style.includes('hidden'))
          ) {
            fg.style.display = 'block';
            fg.style.visibility = 'visible';
            fg.classList.add('glass-unhidden');

            const label = fg.querySelector('label:not(.checkbox-label)');
            if (label && !label.querySelector('.glass-unhidden-icon')) {
              const icon = doc.createElement('span');
              icon.className = 'glass-unhidden-icon';
              icon.textContent = '💡';
              icon.title = 'Hidden field revealed by Glass';
              label.insertBefore(icon, label.firstChild);
            }
          }
        } catch (e) {}
      });

      doc.querySelectorAll('.section-content').forEach(section => {
        try {
          const style = section.getAttribute('style') || '';
          if (style.includes('display') && style.includes('none')) {
            section.style.display = 'block';
            section.classList.add('glass-unhidden');
          }
        } catch (e) {}
      });
    },

    /* ===========================
     * NEW: UI Action link icons
     * =========================== */

    _getUiActionSysIdFromElement(el) {
      // Your HTML examples show sys_id in:
      //  - button[value="sys_id"]
      //  - button[gsft_id="sys_id"]
      //  - a.navigation_link[gsft_id="sys_id"]
      const v = (el.getAttribute('value') || '').trim();
      if (this._looksLikeSysId(v)) return v;

      const gsft = (el.getAttribute('gsft_id') || '').trim();
      if (this._looksLikeSysId(gsft)) return gsft;

      const idAttr = (el.getAttribute('id') || '').trim();
      // sometimes id can be sys_id, sometimes it's action name; only accept if sys_id-like
      if (this._looksLikeSysId(idAttr)) return idAttr;

      return null;
    },

    _looksLikeSysId(s) {
      return typeof s === 'string' && /^[0-9a-f]{32}$/i.test(s);
    },

    _makeUiActionLink(doc, sysId) {
      const a = doc.createElement('a');
      a.className = 'glass-uia-link';
      a.textContent = '🔗';
      a.href = `/sys_ui_action.do?sys_id=${sysId}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.title = 'Open sys_ui_action';
      a.addEventListener('click', (e) => {
        // avoid triggering parent button/link handlers
        e.stopPropagation();
      });
      return a;
    },

    _addUiActionLinks(doc) {
      try {
        // 1) Form header UI Actions (buttons typically inside .navbar_ui_actions)
        doc.querySelectorAll('.navbar_ui_actions button, .navbar_ui_actions a').forEach((el) => {
          try {
            const sysId = this._getUiActionSysIdFromElement(el);
            if (!sysId) return;

            // Avoid duplicates for the same sysId in the same container
            const parent = el.parentElement;
            if (!parent) return;
            if (parent.querySelector(`.glass-uia-link[data-sysid="${sysId}"]`)) return;

            const link = this._makeUiActionLink(doc, sysId);
            link.setAttribute('data-sysid', sysId);

            // Insert immediately after the element
            if (el.nextSibling) parent.insertBefore(link, el.nextSibling);
            else parent.appendChild(link);
          } catch (e) {}
        });

        // 2) Related Links (anchors inside .related_links_container)
        doc.querySelectorAll('.related_links_container a.navigation_link, .related_links_container a.action_context').forEach((el) => {
          try {
            const sysId = this._getUiActionSysIdFromElement(el);
            if (!sysId) return;

            const parent = el.parentElement;
            if (!parent) return;
            if (parent.querySelector(`.glass-uia-link[data-sysid="${sysId}"]`)) return;

            const link = this._makeUiActionLink(doc, sysId);
            link.setAttribute('data-sysid', sysId);

            if (el.nextSibling) parent.insertBefore(link, el.nextSibling);
            else parent.appendChild(link);
          } catch (e) {}
        });
      } catch (e) {}
    },

    /* ===========================
     * Summary + Cleanup
     * =========================== */

    _addSummary() {
      let counts = { fields: 0, options: 0, columns: 0, unhidden: 0, uiaLinks: 0 };

      const countIn = (doc) => {
        try {
          counts.fields += doc.querySelectorAll('.glass-tn-field').length;
          counts.options += doc.querySelectorAll('.glass-tn-option').length;
          counts.columns += doc.querySelectorAll('.glass-tn-column').length;
          counts.unhidden += doc.querySelectorAll('.glass-unhidden').length;
          counts.uiaLinks += doc.querySelectorAll('.glass-uia-link').length;
        } catch (e) {}
      };

      countIn(document);
      this._getAllIframes().forEach(iframe => {
        try { if (iframe.contentDocument) countIn(iframe.contentDocument); } catch (e) {}
      });

      const summary = document.createElement('div');
      summary.id = 'glass-explode-summary';
      summary.className = 'glass-explode-summary';

      let html = `<span class="close-btn" onclick="window.GlassExplodeCleanup()">×</span><strong>Exploded</strong><br>`;
      if (counts.fields > 0) html += `Fields: ${counts.fields}<br>`;
      if (counts.options > 0) html += `Options: ${counts.options}<br>`;
      if (counts.columns > 0) html += `Columns: ${counts.columns}<br>`;
      if (counts.unhidden > 0) html += `Unhidden: ${counts.unhidden}<br>`;
      if (counts.uiaLinks > 0) html += `UIA links: ${counts.uiaLinks}<br>`;
      html += `<small>Click to toggle off</small>`;

      summary.innerHTML = html;
      summary.onclick = (e) => {
        if (!e.target.classList.contains('close-btn')) this._cleanupAll();
      };

      document.body.appendChild(summary);
      setTimeout(() => document.getElementById('glass-explode-summary')?.remove(), 10000);
    },

    _cleanupDocument(doc) {
      try {
        doc.getElementById('glass-explode-styles')?.remove();
        doc.querySelectorAll('.glass-tn').forEach(el => el.remove());
        doc.querySelectorAll('.glass-uia-link').forEach(el => el.remove());
        doc.querySelectorAll('.glass-unhidden').forEach(el => el.classList.remove('glass-unhidden'));
        doc.querySelectorAll('.glass-unhidden-icon').forEach(el => el.remove());
      } catch (e) {}
    },

    _cleanupAll() {
      this._cleanupDocument(document);
      document.getElementById('glass-explode-summary')?.remove();
      this._getAllIframes().forEach(iframe => {
        try { if (iframe.contentDocument) this._cleanupDocument(iframe.contentDocument); } catch (e) {}
      });
    }
  };

  window.GlassExplodeCleanup = () => command._cleanupAll();

  if (window.GlassCommandRegistry) {
    window.GlassCommandRegistry.register(command);
  }
})();
