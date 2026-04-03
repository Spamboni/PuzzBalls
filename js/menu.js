window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['menu.js'] = 1201;
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
    header.innerHTML = '<div class="menu-logo">PUZZBALLS</div><div class="menu-tagline">Physics • Puzzles • Mayhem</div>';
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

    // ── Level cards ──────────────────────────────────────────────────────────
    var grid = _el('div', 'level-grid');
    LEVEL_CATALOG.forEach(function(level) {
      grid.appendChild(_makeLevelCard(level, presetSelect));
    });
    _container.appendChild(grid);

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
