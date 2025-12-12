/**
 * Code / Script Command
 *
 * Search script-capable fields for a term.
 * By default, ignores matches that occur only inside comments (best-effort).
 *
 * Defaults:
 *   --per-field defaults to 250
 *
 * Flags:
 *   --include-comments       Do not strip comments
 *   --per-field <N>          Max rows returned per (table,field)
 *   --max-hits <N>           Max total hits emitted (all fields combined)
 *
 * Usage:
 *   code <term> [--include-comments] [--per-field N] [--max-hits N]
 *   script <term> [--include-comments] [--per-field N] [--max-hits N]
 *
 * Examples:
 *   script "setWorkflow(false)"
 *   script "setWorkflow(false)" --per-field 1000 --max-hits 10000
 *   code "gs.eventQueue" --include-comments
 */

(function () {
    'use strict';
  
    /* ===========================
     * Config
     * =========================== */
    const FIELD_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
    const FIELD_CACHE_VERSION = 1;
  
    const DEFAULT_PER_FIELD = 250;
    const DEFAULT_MAX_HITS = 5000;
  
    /* ===========================
     * Utils
     * =========================== */
    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    function parseArgs(args) {
      const flags = {
        includeComments: false,
        perField: DEFAULT_PER_FIELD,
        maxHits: DEFAULT_MAX_HITS
      };
  
      const terms = [];
  
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
  
        if (a === '--include-comments') {
          flags.includeComments = true;
          continue;
        }
  
        if (a === '--per-field' || a === '--perfield') {
          const n = Number(args[i + 1]);
          if (Number.isFinite(n) && n > 0) flags.perField = n;
          i++;
          continue;
        }
  
        if (a === '--max-hits' || a === '--maxhits') {
          const n = Number(args[i + 1]);
          if (Number.isFinite(n) && n > 0) flags.maxHits = n;
          i++;
          continue;
        }
  
        terms.push(a);
      }
  
      return { term: terms.join(' ').trim(), flags };
    }
  
    function cacheKey(instanceUrl) {
      return `glass:scriptFields:${FIELD_CACHE_VERSION}:${instanceUrl}`;
    }
  
    function loadFieldCache(instanceUrl) {
      try {
        const raw = localStorage.getItem(cacheKey(instanceUrl));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.ts || !Array.isArray(parsed.fields)) return null;
        if (Date.now() - parsed.ts > FIELD_CACHE_TTL_MS) return null;
        return parsed.fields;
      } catch (e) {
        return null;
      }
    }
  
    function saveFieldCache(instanceUrl, fields) {
      try {
        localStorage.setItem(
          cacheKey(instanceUrl),
          JSON.stringify({ ts: Date.now(), fields })
        );
      } catch (e) {}
    }
  
    /* ===========================
     * Background Script Builder
     * =========================== */
    function buildScriptFieldSearchScript(term, flags, cachedFields, options) {
      const perFieldLimit = Number(options.perFieldLimit || DEFAULT_PER_FIELD);
      const maxHits = Number(options.maxHits || DEFAULT_MAX_HITS);
  
      const termJson = JSON.stringify(term);
      const fieldsJson = JSON.stringify(Array.isArray(cachedFields) ? cachedFields : null);
      const includeComments = flags.includeComments === true;
  
      // NOTE: We cannot perfectly strip JS comments with regex (strings can contain //),
      // but this is best-effort and very useful in practice.
      return `
  (function() {
    var TERM = ${termJson};
    var INCLUDE_COMMENTS = ${includeComments};
    var PER_FIELD_LIMIT = ${perFieldLimit};
    var MAX_HITS = ${maxHits};
  
    function stripJsComments(code) {
      if (!code) return '';
      // remove /* ... */ blocks
      code = code.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');
      // remove // line comments (best-effort; avoids stripping URLs with "http://")
      code = code.replace(/(^|[^:])\\/\\/.*$/gm, '$1');
      return code;
    }
  
    function startsWithAny(s, prefixes) {
      for (var i = 0; i < prefixes.length; i++) {
        if (s.indexOf(prefixes[i]) === 0) return true;
      }
      return false;
    }
  
    function tableLabel(tableName) {
      try {
        var o = new GlideRecord('sys_db_object');
        o.addQuery('name', tableName);
        o.setLimit(1);
        o.query();
        if (o.next()) return (o.getValue('label') || tableName) + '';
      } catch (e) {}
      return tableName + '';
    }
  
    function discoverFields() {
      var out = [];
      var skipPrefixes = ['sys_', 'ts_', 'sysx_', 'v_', 'pa_', 'sys_rollback_', 'sys_email_', 'syslog_'];
  
      try {
        var d = new GlideRecord('sys_dictionary');
  
        // Broad but practical: script* + a couple related types
        d.addEncodedQuery(
          "internal_typeSTARTSWITHscript" +
          "^ORinternal_type=condition_string" +
          "^ORinternal_type=expression"
        );
  
        d.addNotNullQuery('element');
        d.orderBy('name');
        d.orderBy('element');
        d.query();
  
        while (d.next()) {
          var table = (d.getValue('name') || '') + '';
          var element = (d.getValue('element') || '') + '';
          if (!table || !element) continue;
          if (startsWithAny(table, skipPrefixes)) continue;
  
          // validate table + field
          try {
            var grTest = new GlideRecord(table);
            if (!grTest.isValid() || !grTest.isValidField(element)) continue;
          } catch (ex) { continue; }
  
          out.push({
            table: table,
            element: element,
            internal_type: (d.getValue('internal_type') || '') + '',
            column_label: (d.getValue('column_label') || '') + ''
          });
        }
      } catch (e) {}
  
      return out;
    }
  
    var fields = ${fieldsJson} || discoverFields();
  
    var totalHits = 0;
    var fieldsScanned = 0;
    var fieldsWithHits = 0;
  
    gs.print('###RESULTS###');
    gs.print(JSON.stringify({
      type: 'meta',
      term: TERM,
      include_comments: INCLUDE_COMMENTS,
      per_field_limit: PER_FIELD_LIMIT,
      max_hits: MAX_HITS,
      fields_found: fields.length,
      fields_source: (${fieldsJson} ? 'cache' : 'discovered')
    }));
  
    for (var i = 0; i < fields.length; i++) {
      if (totalHits >= MAX_HITS) break;
  
      var f = fields[i];
      fieldsScanned++;
  
      try {
        var gr = new GlideRecord(f.table);
        if (!gr.isValid() || !gr.isValidField(f.element)) continue;
  
        // Broad DB prefilter
        gr.addQuery(f.element, 'CONTAINS', TERM);
  
        // Deterministic-ish ordering
        if (gr.isValidField('sys_updated_on')) gr.orderByDesc('sys_updated_on');
  
        gr.setLimit(PER_FIELD_LIMIT);
        gr.queryNoDomain();
        gr.query();
  
        var hitForField = false;
  
        while (gr.next()) {
          var raw = (gr.getValue(f.element) || '') + '';
          var hay = INCLUDE_COMMENTS ? raw : stripJsComments(raw);
  
          // If stripping comments removed the match, ignore it
          if (hay.indexOf(TERM) === -1) continue;
  
          hitForField = true;
          totalHits++;
  
          var sysId = gr.getUniqueValue() + '';
          var display = gr.getDisplayValue() + '';
          var number = '';
          try {
            if (gr.isValidField('number')) number = (gr.getValue('number') || '') + '';
          } catch (e2) {}
  
          // Build list query for easy validation in UI
          // (Best effort: no encoding here; client just concatenates instanceUrl + path)
          var listQuery = f.element + 'LIKE' + TERM;
  
          gs.print(JSON.stringify({
            type: 'hit',
            table: f.table,
            table_label: tableLabel(f.table),
            field: f.element,
            field_label: f.column_label || f.element,
            internal_type: f.internal_type,
            sys_id: sysId,
            display: display,
            number: number,
            record_path: '/' + f.table + '.do?sys_id=' + sysId,
            list_path: '/' + f.table + '_list.do?sysparm_query=' + listQuery
          }));
  
          if (totalHits >= MAX_HITS) break;
        }
  
        if (hitForField) fieldsWithHits++;
  
      } catch (e) {}
    }
  
    gs.print(JSON.stringify({
      type: 'stats',
      fields_scanned: fieldsScanned,
      fields_with_hits: fieldsWithHits,
      total_hits: totalHits,
  
      // allow client to cache discovered fields
      fields_cacheable: true,
      fields_payload: fields
    }));
    gs.print('###END###');
  })();
  `;
    }
  
    /* ===========================
     * Results Page
     * =========================== */
    function renderResultsPage(instanceUrl, meta, hits, stats) {
      const title = 'Script / Code Search';
  
      const subtitle =
        `Term: <span class="glass-code">${escapeHtml(meta?.term || '')}</span> ` +
        `<span class="glass-code">${escapeHtml(meta?.fields_source || '')}</span> ` +
        (meta?.include_comments ? '(comments included)' : '(comments excluded)') +
        ` — per-field: <span class="glass-code">${escapeHtml(String(meta?.per_field_limit ?? DEFAULT_PER_FIELD))}</span>` +
        ` — max-hits: <span class="glass-code">${escapeHtml(String(meta?.max_hits ?? DEFAULT_MAX_HITS))}</span>`;
  
      const statsCards = [
        { value: String(meta?.fields_found ?? 0), label: 'Script fields' },
        { value: String(stats?.fields_scanned ?? 0), label: 'Fields scanned' },
        { value: String(stats?.fields_with_hits ?? 0), label: 'Fields with hits' },
        { value: String(stats?.total_hits ?? 0), label: 'Total hits' }
      ];
  
      const cards = hits.map((h) => {
        const display = h.number || h.display || h.sys_id;
  
        const recordUrl = instanceUrl + (h.record_path || '');
        const listUrl = instanceUrl + (h.list_path || '');
  
        const subtitleLine =
          `${escapeHtml(h.table_label || h.table)} <span class="glass-code">${escapeHtml(h.table)}</span><br>` +
          `${escapeHtml(h.field_label || h.field)} <span class="glass-code">${escapeHtml(h.field)}</span> ` +
          `<span class="glass-code">${escapeHtml(h.internal_type || '')}</span>`;
  
        const links =
          `<a href="${escapeHtml(recordUrl)}" target="_blank" rel="noopener">Open record</a>` +
          ` &nbsp;|&nbsp; ` +
          `<a href="${escapeHtml(listUrl)}" target="_blank" rel="noopener">Open list (field LIKE)</a>`;
  
        return {
          title: escapeHtml(display),
          subtitle: subtitleLine,
          meta: `${escapeHtml(h.sys_id)}<br>${links}`
        };
      });
  
      const content =
        window.GlassResultsPage.buildSection(
          'Stats',
          window.GlassResultsPage.buildStats(statsCards)
        ) +
        window.GlassResultsPage.buildSection(
          'Results',
          cards.length
            ? window.GlassResultsPage.buildCardGrid(cards)
            : `<div class="glass-card">
                 <div class="glass-card-title">No results</div>
                 <div class="glass-card-subtitle">
                   Either the term isn't present, or it only appears inside comments and you didn't pass <span class="glass-code">--include-comments</span>.
                 </div>
               </div>`
        );
  
      const html = window.GlassResultsPage.buildPage({
        title,
        subtitle,
        content,
        footer: 'Glass CLI — code / script'
      });
  
      window.GlassResultsPage.openPage(html);
    }
  
    /* ===========================
     * Command
     * =========================== */
    const command = {
      name: 'code',
      aliases: ['script'],
      description: 'Search script-capable fields (comment matches excluded by default)',
      usage: 'code <term> [--include-comments] [--per-field N] [--max-hits N]',
      examples: [
        'script "setWorkflow(false)"',
        'script "setWorkflow(false)" --per-field 1000 --max-hits 10000',
        'code "gs.eventQueue" --include-comments'
      ],
  
      validate(args) {
        const { term } = parseArgs(args);
        if (!term) return 'Usage: code <term> [--include-comments] [--per-field N] [--max-hits N]';
        if (term.length < 2) return 'Search term too short.';
        return true;
      },
  
      async execute(args, ctx) {
        const { ui, context } = ctx;
        const { term, flags } = parseArgs(args);
  
        const instanceUrl = await context.getInstanceUrl();
        if (!instanceUrl) {
          ui.showError('Unable to detect instance.');
          return;
        }
  
        if (!window.GlassBackgroundScript) {
          ui.showError('GlassBackgroundScript not available.');
          return;
        }
        if (!window.GlassResultsPage) {
          ui.showError('GlassResultsPage not available.');
          return;
        }
  
        const cachedFields = loadFieldCache(instanceUrl);
  
        ui.showInfo(cachedFields ? 'Searching script fields (cached field list)...' : 'Searching script fields (discovering fields)...');
  
        const script = buildScriptFieldSearchScript(
          term,
          flags,
          cachedFields,
          { perFieldLimit: flags.perField, maxHits: flags.maxHits }
        );
  
        try {
          const rows = await window.GlassBackgroundScript.executeAndParse(
            script,
            '###RESULTS###',
            '###END###',
            { instanceUrl, timeout: 240000 }
          );
  
          let meta = null;
          let stats = null;
          const hits = [];
  
          for (const r of rows) {
            if (r && r.type === 'meta') meta = r;
            else if (r && r.type === 'stats') stats = r;
            else if (r && r.type === 'hit') hits.push(r);
          }
  
          // Cache fields if we discovered them this run
          if (stats?.fields_payload && !cachedFields) {
            saveFieldCache(instanceUrl, stats.fields_payload);
          }
  
          ui.showSuccess(`Done. Hits: ${stats?.total_hits ?? hits.length}`);
          ui.hide();
  
          renderResultsPage(instanceUrl, meta, hits, stats);
        } catch (error) {
          ui.showError(`Script search failed: ${error.message}`);
        }
      }
    };
  
    window.GlassCommandRegistry?.register(command);
  })();
  