/**
 * ============================================================================
 * JSON Formatter, Validator & Tree Visualizer — Gamility Tools
 * Standalone pure client-side JSON engineering studio.
 * Copyright © 2026 Gamility (All Rights Reserved)
 * ============================================================================
 */

(function () {
  'use strict';

  // --- Constants & Storage ---
  const STORAGE_KEY_CONTENT = 'gamility_json_draft';
  const STORAGE_KEY_INDENT = 'gamility_json_indent';
  const STORAGE_KEY_VIEW = 'gamility_json_view_mode';

  // --- DOM Elements ---
  const jsonInput = document.getElementById('json-input');
  const editorLineCol = document.getElementById('editor-line-col');
  const splitWorkspace = document.getElementById('split-workspace');
  const validationPill = document.getElementById('validation-pill');
  const validationText = document.getElementById('validation-text');
  
  // Error Banner Elements
  const errorBanner = document.getElementById('error-banner');
  const errorTitle = document.getElementById('error-title');
  const errorCoords = document.getElementById('error-coords');
  const errorSnippet = document.getElementById('error-snippet');

  // Tree View Elements
  const treeRoot = document.getElementById('tree-root');
  const treeSearch = document.getElementById('tree-search');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const btnExpandAll = document.getElementById('btn-expand-all');
  const btnCollapseAll = document.getElementById('btn-collapse-all');

  // Metric Elements
  const statSize = document.getElementById('stat-size');
  const statNodes = document.getElementById('stat-nodes');
  const statKeys = document.getElementById('stat-keys');
  const statArrays = document.getElementById('stat-arrays');
  const statDepth = document.getElementById('stat-depth');

  // Toolbar & Control Buttons
  const btnFormat2 = document.getElementById('btn-format-2');
  const btnFormat4 = document.getElementById('btn-format-4');
  const btnFormatTab = document.getElementById('btn-format-tab');
  const btnMinify = document.getElementById('btn-minify');
  const btnRepair = document.getElementById('btn-repair');
  const btnSample = document.getElementById('btn-sample');
  const fileUpload = document.getElementById('file-upload');
  const viewPills = document.querySelectorAll('.view-pill');
  const btnClearInput = document.getElementById('btn-clear-input');
  const btnCopyFormatted = document.getElementById('btn-copy-formatted');
  const btnCopyMinified = document.getElementById('btn-copy-minified');
  const btnDownload = document.getElementById('btn-download');
  const editorWrapper = document.getElementById('editor-wrapper');

  // Toast Elements
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  // State
  let currentIndent = '2'; // '2' | '4' | 'tab'
  let parsedJsonCache = null;
  let toastTimer = null;
  let parseDebounceTimer = null;
  let searchFilterTerm = '';

  // --- Sample JSON Payload ---
  const SAMPLE_JSON = {
    "project": "Gamility Tools Suite",
    "version": "2.4.0",
    "description": "Smart, privacy-first client-side utilities and web games",
    "privacyGuaranteed": true,
    "rating": 4.95,
    "metrics": {
      "activeTools": 12,
      "cloudUploads": 0,
      "latencyMs": 0.12,
      "storageQuota": null
    },
    "features": [
      "Offline Responsive PWA",
      "Zero Telemetry Tracking",
      "Instant Clipboard & File Export",
      "Visual Tree Hierarchy Inspection"
    ],
    "team": [
      {
        "id": 101,
        "name": "Alex Mercer",
        "role": "Lead Architect",
        "verified": true,
        "skills": ["JavaScript", "Web Audio API", "HTML5 Canvas"]
      },
      {
        "id": 102,
        "name": "Elena Rostova",
        "role": "Interface & UX Designer",
        "verified": true,
        "skills": ["CSS Glassmorphism", "Micro-Interactions", "Accessibility"]
      }
    ],
    "configuration": {
      "theme": "nebula-dark",
      "autoSave": true,
      "maxHistoryRecords": 50,
      "debugMode": false
    }
  };

  // --- Size Formatter ---
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // --- Metric Calculator ---
  function calculateMetrics(obj, rawText) {
    let totalNodes = 0;
    let totalKeys = 0;
    let arrayCount = 0;
    let maxDepth = 0;

    function traverse(node, depth) {
      totalNodes++;
      if (depth > maxDepth) maxDepth = depth;

      if (node && typeof node === 'object') {
        if (Array.isArray(node)) {
          arrayCount++;
          node.forEach(item => traverse(item, depth + 1));
        } else {
          const keys = Object.keys(node);
          totalKeys += keys.length;
          keys.forEach(key => traverse(node[key], depth + 1));
        }
      }
    }

    if (obj !== null && obj !== undefined) {
      traverse(obj, 1);
    }

    const byteLen = new Blob([rawText]).size;
    statSize.textContent = formatBytes(byteLen);
    statNodes.textContent = totalNodes.toLocaleString();
    statKeys.textContent = totalKeys.toLocaleString();
    statArrays.textContent = arrayCount.toLocaleString();
    statDepth.textContent = maxDepth.toLocaleString();
  }

  function resetMetrics(rawText) {
    const byteLen = new Blob([rawText || '']).size;
    statSize.textContent = formatBytes(byteLen);
    statNodes.textContent = '0';
    statKeys.textContent = '0';
    statArrays.textContent = '0';
    statDepth.textContent = '0';
  }

  // --- Syntax Error Diagnostic Engine ---
  function extractErrorCoordinates(text, errorMsg) {
    let line = 1;
    let col = 1;
    let pos = -1;

    // Try extracting position from standard Error messages
    // e.g. "at position 142" or "line 4 column 12"
    const posMatch = errorMsg.match(/position\s+(\d+)/i);
    const lineColMatch = errorMsg.match(/line\s+(\d+)\s+column\s+(\d+)/i);

    if (lineColMatch) {
      line = parseInt(lineColMatch[1], 10);
      col = parseInt(lineColMatch[2], 10);
    } else if (posMatch) {
      pos = parseInt(posMatch[1], 10);
      const textUpToPos = text.substring(0, pos);
      const lines = textUpToPos.split('\n');
      line = lines.length;
      col = lines[lines.length - 1].length + 1;
    } else {
      // Fallback: search for first syntax aberration
      const lines = text.split('\n');
      line = lines.length;
      col = lines[lines.length - 1].length;
    }

    // Build Context Snippet (1-2 lines before and after with pointer)
    const allLines = text.split('\n');
    const startLine = Math.max(0, line - 2);
    const endLine = Math.min(allLines.length - 1, line + 1);
    
    let snippetLines = [];
    for (let l = startLine; l <= endLine; l++) {
      const lineNumStr = String(l + 1).padStart(4, ' ');
      const content = allLines[l];
      snippetLines.push(`${lineNumStr} | ${content}`);
      if (l === line - 1) {
        // Add pointer under offending character
        const pointerPad = ' '.repeat(Math.max(0, col + 6));
        snippetLines.push(`${pointerPad}^ Error here`);
      }
    }

    return {
      line,
      col,
      snippet: snippetLines.join('\n')
    };
  }

  // --- Parsing & Validation Pipeline ---
  function validateAndProcess(sourceText) {
    const text = sourceText.trim();

    if (!text) {
      validationPill.className = 'validation-status-pill status-valid';
      validationText.textContent = 'Empty Buffer';
      errorBanner.classList.add('hidden');
      treeRoot.innerHTML = '<div style="color:var(--text-dim);font-style:italic;padding:1rem;">Tree view will appear once valid JSON is entered.</div>';
      parsedJsonCache = null;
      resetMetrics('');
      return;
    }

    try {
      const parsed = JSON.parse(text);
      parsedJsonCache = parsed;

      // Update validation badge
      validationPill.className = 'validation-status-pill status-valid';
      validationText.textContent = 'Valid JSON';
      errorBanner.classList.add('hidden');

      // Update metrics & tree
      calculateMetrics(parsed, sourceText);
      renderTreeView(parsed, searchFilterTerm);

      // Autosave draft
      try {
        localStorage.setItem(STORAGE_KEY_CONTENT, sourceText);
      } catch (e) {}

    } catch (err) {
      parsedJsonCache = null;

      // Update validation badge
      validationPill.className = 'validation-status-pill status-invalid';
      validationText.textContent = 'Invalid JSON';

      // Parse error details
      const coords = extractErrorCoordinates(sourceText, err.message);
      errorTitle.textContent = err.message;
      errorCoords.textContent = `Line ${coords.line}, Col ${coords.col}`;
      errorSnippet.textContent = coords.snippet;
      errorBanner.classList.remove('hidden');

      treeRoot.innerHTML = `<div style="color:var(--accent-rose);padding:1rem;background:rgba(244,63,94,0.06);border-radius:8px;border:1px dashed rgba(244,63,94,0.25);">
        <strong>Cannot build visual tree:</strong> Correct the JSON syntax errors on the left or click "🪄 Repair" to auto-fix.
      </div>`;

      resetMetrics(sourceText);
    }
  }

  // --- Interactive Tree Visualizer Engine ---
  function renderTreeView(data, filter) {
    treeRoot.innerHTML = '';
    const rootNode = createTreeNode(null, data, true, filter);
    treeRoot.appendChild(rootNode);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlightMatches(text, term) {
    const escaped = escapeHtml(text);
    if (!term) return escaped;
    const regex = new RegExp(`(${term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<span class="tree-highlight">$1</span>');
  }

  function createTreeNode(key, val, isRoot, filter) {
    const container = document.createElement('div');
    container.className = 'tree-node';

    const row = document.createElement('div');
    row.className = 'tree-node-row';

    const isObject = val !== null && typeof val === 'object';
    const isArray = Array.isArray(val);

    if (isObject) {
      // Toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'tree-toggle-btn';
      toggleBtn.type = 'button';
      toggleBtn.innerHTML = '▼';
      row.appendChild(toggleBtn);

      // Key if not root
      if (key !== null) {
        const keySpan = document.createElement('span');
        keySpan.className = 'tree-key';
        keySpan.innerHTML = `"${highlightMatches(key, filter)}"`;
        row.appendChild(keySpan);

        const colon = document.createElement('span');
        colon.className = 'tree-colon';
        colon.textContent = ':';
        row.appendChild(colon);
      }

      // Opening Bracket
      const openBracket = document.createElement('span');
      openBracket.className = 'tree-bracket';
      openBracket.textContent = isArray ? '[' : '{';
      row.appendChild(openBracket);

      // Count badge
      const count = isArray ? val.length : Object.keys(val).length;
      const countBadge = document.createElement('span');
      countBadge.className = 'tree-count-badge';
      countBadge.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
      row.appendChild(countBadge);

      container.appendChild(row);

      // Children container
      const childrenWrapper = document.createElement('div');
      childrenWrapper.className = 'tree-children';

      if (isArray) {
        val.forEach((item, idx) => {
          childrenWrapper.appendChild(createTreeNode(idx, item, false, filter));
        });
      } else {
        Object.keys(val).forEach(childKey => {
          childrenWrapper.appendChild(createTreeNode(childKey, val[childKey], false, filter));
        });
      }

      // Closing bracket row
      const closeRow = document.createElement('div');
      closeRow.className = 'tree-node-row';
      const spacer = document.createElement('span');
      spacer.className = 'tree-toggle-spacer';
      closeRow.appendChild(spacer);
      const closeBracket = document.createElement('span');
      closeBracket.className = 'tree-bracket';
      closeBracket.textContent = isArray ? ']' : '}';
      closeRow.appendChild(closeBracket);
      childrenWrapper.appendChild(closeRow);

      container.appendChild(childrenWrapper);

      // Toggle functionality
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = childrenWrapper.classList.toggle('collapsed');
        toggleBtn.innerHTML = isCollapsed ? '▶' : '▼';
      });

    } else {
      // Primitive Leaf Node
      const spacer = document.createElement('span');
      spacer.className = 'tree-toggle-spacer';
      row.appendChild(spacer);

      if (key !== null) {
        const keySpan = document.createElement('span');
        keySpan.className = 'tree-key';
        keySpan.innerHTML = `"${highlightMatches(key, filter)}"`;
        row.appendChild(keySpan);

        const colon = document.createElement('span');
        colon.className = 'tree-colon';
        colon.textContent = ':';
        row.appendChild(colon);
      }

      const valSpan = document.createElement('span');
      if (typeof val === 'string') {
        valSpan.className = 'tree-val-string';
        valSpan.innerHTML = `"${highlightMatches(val, filter)}"`;
      } else if (typeof val === 'number') {
        valSpan.className = 'tree-val-number';
        valSpan.innerHTML = highlightMatches(String(val), filter);
      } else if (typeof val === 'boolean') {
        valSpan.className = 'tree-val-boolean';
        valSpan.innerHTML = highlightMatches(String(val), filter);
      } else if (val === null) {
        valSpan.className = 'tree-val-null';
        valSpan.textContent = 'null';
      }
      row.appendChild(valSpan);
      container.appendChild(row);
    }

    return container;
  }

  // --- Auto-Repair Engine ---
  function repairJson(raw) {
    let text = raw;

    // 1. Remove Single-line comments (// ...)
    text = text.replace(/\/\/[^\n\r]*/g, '');

    // 2. Remove Multi-line comments (/* ... */)
    text = text.replace(/\/\*[\s\S]*?\*\//g, '');

    // 3. Convert single quotes to double quotes around string literals & keys
    // Avoid replacing apostrophes inside words by checking quote delimiters
    text = text.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

    // 4. Quote unquoted object keys (e.g., { foo: "bar" } => { "foo": "bar" })
    text = text.replace(/([{,]\s*)([a-zA-Z0-9_$-]+)\s*:/g, '$1"$2":');

    // 5. Remove trailing commas before } or ]
    text = text.replace(/,\s*([}\]])/g, '$1');

    // 6. Replace undefined with null
    text = text.replace(/:\s*undefined\b/g, ': null');

    // 7. Replace NaN or Infinity with null
    text = text.replace(/:\s*(?:NaN|Infinity|-Infinity)\b/g, ': null');

    return text;
  }

  // --- Formatter & Minifier ---
  function formatCurrentJson(indentSetting) {
    const raw = jsonInput.value;
    let obj = null;

    try {
      obj = JSON.parse(raw);
    } catch (e) {
      // Try repair if initial parse fails
      try {
        const repaired = repairJson(raw);
        obj = JSON.parse(repaired);
        showToast('JSON auto-repaired before formatting!');
      } catch (err2) {
        showToast('Cannot format invalid JSON. Check errors.');
        return;
      }
    }

    const indent = indentSetting === 'tab' ? '\t' : parseInt(indentSetting, 10);
    const formatted = JSON.stringify(obj, null, indent);
    jsonInput.value = formatted;
    validateAndProcess(formatted);
    updateCursorPosition();
    showToast(`Formatted with ${indentSetting === 'tab' ? 'Tabs' : indentSetting + ' spaces'}!`);
  }

  function minifyCurrentJson() {
    const raw = jsonInput.value;
    let obj = null;

    try {
      obj = JSON.parse(raw);
    } catch (e) {
      try {
        obj = JSON.parse(repairJson(raw));
      } catch (err2) {
        showToast('Cannot minify invalid JSON. Check errors.');
        return;
      }
    }

    const minified = JSON.stringify(obj);
    jsonInput.value = minified;
    validateAndProcess(minified);
    updateCursorPosition();
    showToast('JSON compressed & minified!');
  }

  // --- Indentation Style Switcher ---
  function setIndentStyle(indent) {
    currentIndent = indent;
    [btnFormat2, btnFormat4, btnFormatTab].forEach(btn => btn.classList.remove('active-indent'));
    if (indent === '2') btnFormat2.classList.add('active-indent');
    if (indent === '4') btnFormat4.classList.add('active-indent');
    if (indent === 'tab') btnFormatTab.classList.add('active-indent');

    try {
      localStorage.setItem(STORAGE_KEY_INDENT, indent);
    } catch (e) {}

    formatCurrentJson(indent);
  }

  // --- View Mode Controls ---
  function setViewMode(mode) {
    splitWorkspace.classList.remove('view-split', 'view-code', 'view-tree');
    splitWorkspace.classList.add(`view-${mode}`);

    viewPills.forEach(pill => {
      if (pill.dataset.view === mode) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    try {
      localStorage.setItem(STORAGE_KEY_VIEW, mode);
    } catch (e) {}
  }

  // --- Cursor Line & Column Tracker ---
  function updateCursorPosition() {
    const pos = jsonInput.selectionStart;
    const val = jsonInput.value.substring(0, pos);
    const lines = val.split('\n');
    const lineNum = lines.length;
    const colNum = lines[lines.length - 1].length + 1;
    editorLineCol.textContent = `Line ${lineNum}, Col ${colNum}`;
  }

  // --- Toast Notification ---
  function showToast(msg) {
    toastMessage.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  function copyToClipboard(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(successMsg);
      }).catch(() => {
        fallbackCopy(text, successMsg);
      });
    } else {
      fallbackCopy(text, successMsg);
    }
  }

  function fallbackCopy(text, successMsg) {
    const temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.select();
    try {
      document.execCommand('copy');
      showToast(successMsg);
    } catch (err) {
      showToast('Copy failed. Please copy manually.');
    }
    document.body.removeChild(temp);
  }

  function downloadJsonFile(filename, content) {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}!`);
  }

  // --- Event Listeners Setup ---
  function initEvents() {
    // Input typing with debounced validator
    jsonInput.addEventListener('input', () => {
      clearTimeout(parseDebounceTimer);
      parseDebounceTimer = setTimeout(() => {
        validateAndProcess(jsonInput.value);
      }, 150);
      updateCursorPosition();
    });

    jsonInput.addEventListener('click', updateCursorPosition);
    jsonInput.addEventListener('keyup', updateCursorPosition);

    // Tab key inside textarea
    jsonInput.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = jsonInput.selectionStart;
        const end = jsonInput.selectionEnd;
        const indentStr = currentIndent === 'tab' ? '\t' : ' '.repeat(parseInt(currentIndent, 10) || 2);
        jsonInput.setRangeText(indentStr, start, end, 'end');
        validateAndProcess(jsonInput.value);
        updateCursorPosition();
      }
    });

    // Formatting Toolbar Buttons
    btnFormat2.addEventListener('click', () => setIndentStyle('2'));
    btnFormat4.addEventListener('click', () => setIndentStyle('4'));
    btnFormatTab.addEventListener('click', () => setIndentStyle('tab'));
    btnMinify.addEventListener('click', minifyCurrentJson);

    // Auto-Repair Button
    btnRepair.addEventListener('click', () => {
      const raw = jsonInput.value;
      if (!raw.trim()) {
        showToast('Editor is empty.');
        return;
      }
      const repaired = repairJson(raw);
      try {
        const obj = JSON.parse(repaired);
        const indent = currentIndent === 'tab' ? '\t' : parseInt(currentIndent, 10) || 2;
        jsonInput.value = JSON.stringify(obj, null, indent);
        validateAndProcess(jsonInput.value);
        showToast('Successfully repaired & formatted JSON!');
      } catch (err) {
        jsonInput.value = repaired;
        validateAndProcess(repaired);
        showToast('Repaired common errors. Remaining syntax issues flagged.');
      }
    });

    // Sample JSON Button
    btnSample.addEventListener('click', () => {
      const indent = currentIndent === 'tab' ? '\t' : parseInt(currentIndent, 10) || 2;
      jsonInput.value = JSON.stringify(SAMPLE_JSON, null, indent);
      validateAndProcess(jsonInput.value);
      updateCursorPosition();
      showToast('Loaded sample JSON payload!');
    });

    // File Upload Handler
    fileUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        jsonInput.value = event.target.result;
        validateAndProcess(jsonInput.value);
        updateCursorPosition();
        showToast(`Loaded ${file.name}!`);
      };
      reader.readAsText(file);
      fileUpload.value = '';
    });

    // Drag and Drop Files onto Editor
    editorWrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      editorWrapper.style.outline = '2px dashed var(--accent-cyan)';
    });

    editorWrapper.addEventListener('dragleave', () => {
      editorWrapper.style.outline = 'none';
    });

    editorWrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      editorWrapper.style.outline = 'none';
      const file = e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        jsonInput.value = event.target.result;
        validateAndProcess(jsonInput.value);
        updateCursorPosition();
        showToast(`Imported ${file.name}!`);
      };
      reader.readAsText(file);
    });

    // Clear Button
    btnClearInput.addEventListener('click', () => {
      if (!jsonInput.value.trim() || confirm('Clear the JSON input buffer?')) {
        jsonInput.value = '';
        validateAndProcess('');
        updateCursorPosition();
        showToast('Buffer cleared.');
      }
    });

    // View Pills
    viewPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const mode = pill.dataset.view;
        if (mode) setViewMode(mode);
      });
    });

    // Tree Controls
    btnExpandAll.addEventListener('click', () => {
      const wrappers = treeRoot.querySelectorAll('.tree-children');
      wrappers.forEach(w => w.classList.remove('collapsed'));
      const toggles = treeRoot.querySelectorAll('.tree-toggle-btn');
      toggles.forEach(t => t.innerHTML = '▼');
      showToast('Expanded all tree nodes.');
    });

    btnCollapseAll.addEventListener('click', () => {
      const wrappers = treeRoot.querySelectorAll('.tree-children');
      wrappers.forEach(w => w.classList.add('collapsed'));
      const toggles = treeRoot.querySelectorAll('.tree-toggle-btn');
      toggles.forEach(t => t.innerHTML = '▶');
      showToast('Collapsed all tree nodes.');
    });

    // Tree Search Filter
    treeSearch.addEventListener('input', () => {
      searchFilterTerm = treeSearch.value.trim();
      btnClearSearch.classList.toggle('hidden', !searchFilterTerm);
      if (parsedJsonCache) {
        renderTreeView(parsedJsonCache, searchFilterTerm);
      }
    });

    btnClearSearch.addEventListener('click', () => {
      treeSearch.value = '';
      searchFilterTerm = '';
      btnClearSearch.classList.add('hidden');
      if (parsedJsonCache) {
        renderTreeView(parsedJsonCache, '');
      }
    });

    // Copy Actions
    btnCopyFormatted.addEventListener('click', () => {
      if (!jsonInput.value.trim()) {
        showToast('Nothing to copy.');
        return;
      }
      copyToClipboard(jsonInput.value, 'Formatted JSON copied to clipboard!');
    });

    btnCopyMinified.addEventListener('click', () => {
      if (!parsedJsonCache) {
        showToast('Cannot copy minified invalid JSON.');
        return;
      }
      copyToClipboard(JSON.stringify(parsedJsonCache), 'Minified JSON copied to clipboard!');
    });

    // Download .json
    btnDownload.addEventListener('click', () => {
      if (!jsonInput.value.trim()) {
        showToast('Nothing to download.');
        return;
      }
      downloadJsonFile('data.json', jsonInput.value);
    });
  }

  // --- Bootstrap ---
  function initApp() {
    initEvents();

    // Restore Indentation Preference
    try {
      const savedIndent = localStorage.getItem(STORAGE_KEY_INDENT);
      if (savedIndent && ['2', '4', 'tab'].includes(savedIndent)) {
        currentIndent = savedIndent;
        [btnFormat2, btnFormat4, btnFormatTab].forEach(b => b.classList.remove('active-indent'));
        if (savedIndent === '2') btnFormat2.classList.add('active-indent');
        if (savedIndent === '4') btnFormat4.classList.add('active-indent');
        if (savedIndent === 'tab') btnFormatTab.classList.add('active-indent');
      }
    } catch (e) {}

    // Restore View Mode
    try {
      const savedView = localStorage.getItem(STORAGE_KEY_VIEW);
      if (savedView && ['split', 'code', 'tree'].includes(savedView)) {
        setViewMode(savedView);
      }
    } catch (e) {}

    // Restore Content or load sample
    try {
      const savedContent = localStorage.getItem(STORAGE_KEY_CONTENT);
      if (savedContent !== null && savedContent.length > 0) {
        jsonInput.value = savedContent;
      } else {
        const indent = currentIndent === 'tab' ? '\t' : parseInt(currentIndent, 10) || 2;
        jsonInput.value = JSON.stringify(SAMPLE_JSON, null, indent);
      }
    } catch (e) {
      const indent = currentIndent === 'tab' ? '\t' : parseInt(currentIndent, 10) || 2;
      jsonInput.value = JSON.stringify(SAMPLE_JSON, null, indent);
    }

    validateAndProcess(jsonInput.value);
    updateCursorPosition();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
