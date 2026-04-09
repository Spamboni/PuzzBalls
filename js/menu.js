window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_BUILD_TIMESTAMP = '04/09/2026 v1577 WHITE-BG';
window.PUZZBALLS_FILE_VERSION['menu.js'] = 1577;
// menu.js — Main menu / level selector screen

var LEVEL_CATALOG = [
  {
    id:          'test_level',
    name:        'Test Level',
    description: 'Experiment with all ball types and physics',
    difficulty:  'Tutorial',
    stars:       0,
    locked:      false,
  },
  {
    id:          'level_2_buttons',
    name:        'Button Challenge',
    description: 'Hit the glowing button to open the gate, then sink your bouncer',
    difficulty:  'Easy',
    stars:       0,
    locked:      false,
  },
  {
    id:          'level_3_bricks',
    name:        'Brick Breaker',
    description: 'Smash both breakable bricks to open the path — use your Exploders wisely',
    difficulty:  'Easy',
    stars:       0,
    locked:      false,
  },
  {
    id:          'level_4_turnstile',
    name:        'Turnstile Gauntlet',
    description: 'Three spinning turnstiles stand between you and the target',
    difficulty:  'Medium',
    stars:       0,
    locked:      false,
  },
  {
    id:          'level_5_port',
    name:        'Power the Grid',
    description: 'Plug the Gravity ball into the electrical port to open the gate',
    difficulty:  'Hard',
    stars:       0,
    locked:      false,
  },
];

var Menu = (function() {

  var _container = null;
  var _onPlay    = null;  // callback(levelId, presetId)

  function init(container, onPlayCallback) {
    _container = container;
    _onPlay    = onPlayCallback;
    _render();
  }

  function show() {
    if (_container) _container.style.display = 'flex';
  }

  function hide() {
    if (_container) _container.style.display = 'none';
  }

  function _render() {
    _container.innerHTML = '';
    _container.className = 'menu-screen';

    // ── Header ──────────────────────────────────────────────────────────────
    var header = _el('div', 'menu-header');
    var _ver = window.PUZZBALLS_FILE_VERSION && window.PUZZBALLS_FILE_VERSION['game.js'];
    var _verStr = _ver ? ('v' + String(_ver).slice(0,2) + '.' + String(_ver).slice(2)) : 'v?';
    var _BUILD_TIME = window.PUZZBALLS_BUILD_TIMESTAMP || '';
    header.innerHTML = '<div class="menu-logo">PUZZBALLS</div><div class="menu-tagline">Physics • Puzzles • Mayhem</div><div class="menu-version" style="color:#ffff00">' + _verStr + ' · ' + _BUILD_TIME + '</div>';
    _container.appendChild(header);

    // ── Preset selector ──────────────────────────────────────────────────────
    var presetBar = _el('div', 'menu-preset-bar');
    var presetLabel = _el('span', 'preset-bar-label');
    presetLabel.textContent = 'PHYSICS PRESET:';
    presetBar.appendChild(presetLabel);

    var presetSelect = document.createElement('select');
    presetSelect.className = 'preset-select';
    _refreshPresetSelect(presetSelect);
    presetBar.appendChild(presetSelect);
    _container.appendChild(presetBar);

    // ── Level cards (built-in + custom) ──────────────────────────────────────
    var grid = _el('div', 'level-grid');
    LEVEL_CATALOG.forEach(function(level) {
      grid.appendChild(_makeLevelCard(level, presetSelect));
    });

    // Load custom levels from localStorage
    try {
      var customLevels = JSON.parse(localStorage.getItem('puzzballs_custom_levels') || '[]');
      if (customLevels.length > 0) {
        var customHeader = _el('div', 'menu-section-header');
        customHeader.textContent = '⭐ YOUR LEVELS';
        customHeader.style.cssText = 'color:#88aaff;font-size:11px;letter-spacing:2px;padding:8px 4px 4px;width:100%;text-align:center;font-family:Share Tech Mono,monospace;';
        grid.appendChild(customHeader);
        customLevels.forEach(function(level) {
          var card = _makeLevelCard({ id: level.id, name: level.name, description: 'Custom level', difficulty: 'Custom', stars: 0, locked: false, custom: true }, presetSelect);
          // Add delete button to card
          var delBtn = _el('button', 'card-delete-btn');
          delBtn.textContent = '✕';
          delBtn.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(180,0,0,0.7);border:1px solid #ff4444;color:#ff8888;border-radius:3px;padding:2px 6px;font-size:10px;cursor:pointer;z-index:10;';
          delBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('Delete "' + level.name + '"?')) {
              var saved = JSON.parse(localStorage.getItem('puzzballs_custom_levels') || '[]');
              saved = saved.filter(function(l) { return l.id !== level.id; });
              localStorage.setItem('puzzballs_custom_levels', JSON.stringify(saved));
              _render();
            }
          });
          card.style.position = 'relative';
          card.appendChild(delBtn);
          grid.appendChild(card);
        });
      }
    } catch(e) { /* localStorage unavailable */ }

    _container.appendChild(grid);

    // Register refresh callback for game to call after saving
    window._menuRefreshCallback = _render;

    // ── Footer ───────────────────────────────────────────────────────────────
    var footer = _el('div', 'menu-footer');
    footer.textContent = 'v0.2 — Phase 2';
    _container.appendChild(footer);
  }

  function _refreshPresetSelect(sel) {
    sel.innerHTML = '';
    var presets = Presets.getAll();
    presets.forEach(function(p) {
      var opt = document.createElement('option');
      opt.value       = p.id;
      opt.textContent = p.name + (p.builtIn ? '' : ' ★');
      sel.appendChild(opt);
    });
  }

  function _makeLevelCard(level, presetSelect) {
    var card = _el('div', 'level-card' + (level.locked ? ' locked' : ''));

    var diff = _el('div', 'card-difficulty diff-' + level.difficulty.toLowerCase());
    diff.textContent = level.difficulty;
    card.appendChild(diff);

    var name = _el('div', 'card-name');
    name.textContent = level.name;
    card.appendChild(name);

    var desc = _el('div', 'card-desc');
    desc.textContent = level.description;
    card.appendChild(desc);

    if (!level.locked) {
      var btn = _el('button', 'card-play-btn');
      btn.textContent = '▶  PLAY';
      function doPlay(e) {
        e.preventDefault(); e.stopPropagation();
        if (_onPlay) _onPlay(level.id, presetSelect.value);
      }
      btn.addEventListener('click',    doPlay);
      btn.addEventListener('touchend', doPlay);
      card.appendChild(btn);
    } else {
      var lock = _el('div', 'card-lock');
      lock.textContent = '🔒 LOCKED';
      card.appendChild(lock);
    }

    return card;
  }

  function _el(tag, cls) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  // Call after saving a new preset so the dropdown refreshes
  function refreshPresets() {
    var sel = _container ? _container.querySelector('.preset-select') : null;
    if (sel) _refreshPresetSelect(sel);
  }

  return { init, show, hide, refreshPresets };
})();

window.Menu = Menu;
window.LEVEL_CATALOG = LEVEL_CATALOG;
