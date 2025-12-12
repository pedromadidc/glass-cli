/**
 * Keyword Command
 *
 * Search across all text-indexed tables (sys_dictionary collection where text_index=true)
 * using keyword search pseudo-field: 123TEXTQUERY321
 *
 * Usage:
 *   keyword <term>
 *
 * Examples:
 *   keyword "RITM0284161"
 *   keyword vpn timeout
 */

(function () {
    'use strict';
  
    const TABLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
    const TABLE_CACHE_VERSION = 1;
  
    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  
    function cacheKey(instanceUrl) {
      return `glass:keywordTables:${TABLE_CACHE_VERSION}:${instanceUrl}`;
    }
  
    function loadTableCache(instanceUrl) {
      try {
        const raw = localStorage.getItem(cacheKey(instanceUrl));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.ts || !Array.isArray(parsed.tables)) return null;
        if (Date.now() - parsed.ts > TABLE_CACHE_TTL_MS) return null;
        return parsed.tables;
      } catch (e) {
        return null;
      }
    }
  
    function saveTableCache(instanceUrl, tables) {
      try {
        localStorage.setItem(
          cacheKey(instanceUrl),
          JSON.stringify({ ts: Date.now(), tables })
        );
      } catch (e) {}
    }
  
    /**
     * Build one background script that:
     *  1) Finds text-indexed tables (unless a cached list was provided)
     *  2) Runs keyword search (123TEXTQUERY321=<term>) per table
     *  3) Emits JSON lines between ###RESULTS### and ###END###
     */
    function buildKeywordSearchScript(term, cachedTables, options) {
      const perTableLimit = Number(options.perTableLimit || 5);
      const maxTables = Number(options.maxTables || 250);
      const maxHits = Number(options.maxHits || 300);
  
      const termJson = JSON.stringify(term);
      const tablesJson = JSON.stringify(Array.isArray(cachedTables) ? cachedTables : null);
  
      return `
  (function() {
    var TERM = ${termJson};
    var PER_TABLE_LIMIT = ${perTableLimit};
    var MAX_TABLES = ${maxTables};
    var MAX_HITS = ${maxHits};
  
    function startsWithAny(s, prefixes) {
      for (var i = 0; i < prefixes.length; i++) {
        if (s.indexOf(prefixes[i]) === 0) return true;
      }
      return false;
    }
  
    function tableLabel(tableName) {
      try {
        var obj = new GlideRecord('sys_db_object');
        obj.addQuery('name', tableName);
        obj.setLimit(1);
        obj.query();
        if (obj.next()) return (obj.getValue('label') || tableName) + '';
      } catch (e) {}
      return tableName + '';
    }
  
    var skipPrefixes = [
      'sys_', 'ts_', 'sysx_', 'v_', 'pa_',
      'sys_rollback_', 'sys_email_', 'syslog_'
    ];
  
    function discoverTables() {
      var out = [];
      try {
        var d = new GlideRecord('sys_dictionary');
        d.addQuery('internal_type', 'collection');
        d.addQuery('text_index', true);
        d.addEncodedQuery('nameNOT LIKEsys_rollback_^nameNOT LIKEsys_email_^nameNOT LIKEsyslog_');
        d.orderBy('name');
        d.query();
  
        while (d.next()) {
          var t = (d.getValue('name') || '') + '';
          if (!t) continue;
          if (startsWithAny(t, skipPrefixes)) continue;
  
          // Validate table exists
          try {
            var grTest = new GlideRecord(t);
            if (!grTest.isValid()) continue;
          } catch (e0) { continue; }
  
          out.push(t);
          if (out.length >= MAX_TABLES) break;
        }
      } catch (e) {}
      return out;
    }
  
    var tableList = ${tablesJson} || discoverTables();
  
    // hard cap server-side too
    if (tableList.length > MAX_TABLES) tableList = tableList.slice(0, MAX_TABLES);
  
    var tablesScanned = 0;
    var tablesWithHits = 0;
    var totalHits = 0;
  
    gs.print('###RESULTS###');
    gs.print(JSON.stringify({
      type: 'meta',
      term: TERM,
      per_table_limit: PER_TABLE_LIMIT,
      max_tables: MAX_TABLES,
      max_hits: MAX_HITS,
      tables_found: tableList.length,
      tables_source: (${tablesJson} ? 'cache' : 'discovered')
    }));
  
    for (var i = 0; i < tableList.length; i++) {
      if (totalHits >= MAX_HITS) break;
  
      var table = tableList[i];
      tablesScanned++;
  
      try {
        var gr = new GlideRecord(table);
        if (!gr.isValid()) continue;
  
        gr.addQuery('123TEXTQUERY321', TERM);
        gr.setLimit(PER_TABLE_LIMIT);
        gr.queryNoDomain();
        gr.query();
  
        var hitCountForTable = 0;
        while (gr.next()) {
          hitCountForTable++;
          totalHits++;
  
          var sysId = gr.getUniqueValue() + '';
          var display = gr.getDisplayValue() + '';
          var number = '';
          try {
            if (gr.isValidField('number')) number = (gr.getValue('number') || '') + '';
          } catch (e2) {}
  
          gs.print(JSON.stringify({
            type: 'hit',
            table: table,
            table_label: tableLabel(table),
            sys_id: sysId,
            display: display,
            number: number,
            record_path: '/' + table + '.do?sys_id=' + sysId,
            list_path: '/' + table + '_list.do?sysparm_query=' + encodeURIComponent('123TEXTQUERY321=' + TERM)
          }));
  
          if (totalHits >= MAX_HITS) break;
        }
  
        if (hitCountForTable > 0) tablesWithHits++;
  
      } catch (e) {}
    }
  
    gs.print(JSON.stringify({
      type: 'stats',
      tables_scanned: tablesScanned,
      tables_with_hits: tablesWithHits,
      total_hits: totalHits,
  
      // tell the client it can cache (and include payload)
      tables_cacheable: true,
      tables_payload: tableList
    }));
    gs.print('###END###');
  })();
  `;
    }
  
    function renderResultsPage(instanceUrl, meta, hits, stats) {
      const title = `Keyword Search`;
      const subtitle = meta?.term
        ? `Search term: <span class="glass-code">${escapeHtml(meta.term)}</span> ` +
          `<span class="glass-code">${escapeHtml(meta.tables_source || '')}</span>`
        : '';
  
      const statsCards = [
        { value: String(meta?.tables_found ?? 0), label: 'Keyword tables' },
        { value: String(stats?.tables_scanned ?? 0), label: 'Tables scanned' },
        { value: String(stats?.tables_with_hits ?? 0), label: 'Tables with hits' },
        { value: String(stats?.total_hits ?? 0), label: 'Total hits' }
      ];
  
      const cards = hits.map((h) => {
        const display = h.number || h.display || h.sys_id;
        const recordUrl = instanceUrl + (h.record_path || '');
        const listUrl = instanceUrl + (h.list_path || '');
  
        const tableLine = `${escapeHtml(h.table_label || h.table)} <span class="glass-code">${escapeHtml(h.table)}</span>`;
        const links =
          `<a href="${escapeHtml(recordUrl)}" target="_blank" rel="noopener">Open record</a>` +
          ` &nbsp;|&nbsp; ` +
          `<a href="${escapeHtml(listUrl)}" target="_blank" rel="noopener">Open list (keyword)</a>`;
  
        return {
          title: escapeHtml(display),
          subtitle: tableLine,
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
                 <div class="glass-card-subtitle">Try a more specific term, or confirm the table(s) are text-indexed.</div>
               </div>`
        );
  
      const html = window.GlassResultsPage.buildPage({
        title,
        subtitle,
        content,
        footer: `Glass CLI - keyword`
      });
  
      window.GlassResultsPage.openPage(html);
    }
  
    const command = {
      name: 'keyword',
      aliases: ['k', 'kw', 'search'],
      description: 'Search all text-indexed tables for a keyword',
      usage: 'keyword <term>',
      examples: ['keyword RITM0284161', 'keyword vpn timeout'],
  
      validate(args) {
        if (!args.length) return 'Usage: keyword <term>';
        const term = args.join(' ').trim();
        if (!term) return 'Please provide a search term.';
        if (term.length < 2) return 'Search term too short.';
        return true;
      },
  
      async execute(args, ctx) {
        const { ui, context } = ctx;
        const term = args.join(' ').trim();
  
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
  
        const cachedTables = loadTableCache(instanceUrl);
  
        const opts = {
          perTableLimit: 5,
          maxTables: 250,
          maxHits: 300
        };
  
        try {
          ui.showInfo(cachedTables ? 'Searching keyword (cached table list)...' : 'Searching keyword (discovering tables)...');
  
          const script = buildKeywordSearchScript(term, cachedTables, opts);
  
          const rows = await window.GlassBackgroundScript.executeAndParse(
            script,
            '###RESULTS###',
            '###END###',
            { instanceUrl, timeout: 120000 }
          );
  
          let meta = null;
          let stats = null;
          const hits = [];
  
          for (const r of rows) {
            if (r && r.type === 'meta') meta = r;
            else if (r && r.type === 'stats') stats = r;
            else if (r && r.type === 'hit') hits.push(r);
          }
  
          if (stats?.tables_payload && !cachedTables) {
            saveTableCache(instanceUrl, stats.tables_payload);
          }
  
          ui.showSuccess(`Done. Hits: ${stats?.total_hits ?? hits.length}`);
          ui.hide();
  
          renderResultsPage(instanceUrl, meta, hits, stats);
        } catch (error) {
          ui.showError(`Keyword search failed: ${error.message}`);
        }
      }
    };
  
    window.GlassCommandRegistry?.register(command);
  })();
  