// ui.js — PuzzBalls in-game HUD + settings with preset system

class UI {
  constructor(opts) {
    this.canvas       = opts.canvas;
    this.onReset      = opts.onReset;
    this.onBackToMenu = opts.onBackToMenu;

    this._scoreEl    = document.getElementById('score');
    this._collEl     = document.getElementById('collisions');
    this._levelTitle = document.getElementById('level-title');
    this._msgEl      = document.getElementById('message-overlay');
    this._msgTitle   = document.getElementById('message-title');
    this._msgSub     = document.getElementById('message-sub');
    this._objPanel   = document.getElementById('objectives-panel');
    this._btnReset   = document.getElementById('btn-reset');
    this._btnBack    = document.getElementById('btn-back');
    this._btnSettings = document.getElementById('btn-settings');
    this._settingsPanel = document.getElementById('settings-panel');

    var self = this;

    function doReset(e)  { e.preventDefault(); e.stopPropagation(); opts.onReset(); }
    function doBack(e)   { e.preventDefault(); e.stopPropagation(); opts.onBackToMenu(); }
    function doSettings(e) {
      e.preventDefault(); e.stopPropagation();
      if (!self._panelBuilt) { self._buildSettingsPanel(); self._panelBuilt = true; }
      self._settingsPanel.classList.toggle('open');
    }

    this._btnReset.addEventListener('click',    doReset);
    this._btnReset.addEventListener('touchend', doReset);
    this._btnBack.addEventListener('click',    doBack);
    this._btnBack.addEventListener('touchend', doBack);
    this._btnSettings.addEventListener('click',    doSettings);
    this._btnSettings.addEventListener('touchend', doSettings);

    function closeIfOutside(e) {
      if (!self._settingsPanel.classList.contains('open')) return;
      if (!self._settingsPanel.contains(e.target) && e.target !== self._btnSettings) {
        self._settingsPanel.classList.remove('open');
      }
    }
    document.addEventListener('click', closeIfOutside);
    document.addEventListener('touchstart', closeIfOutside, { passive: true });

    this._panelBuilt = false;
    this.canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  }

  // ── Public setters ─────────────────────────────────────────────────────────

  setScore(n)      { if(this._scoreEl)    this._scoreEl.textContent = n; }
  setCollisions(n) { if(this._collEl)     this._collEl.textContent  = n; }
  setLevel(name)   { if(this._levelTitle) this._levelTitle.textContent = name; }

  setObjectives(objectives) {
    if (!this._objPanel) return;
    this._objPanel.innerHTML = '';
    objectives.forEach(function(o) {
      var row = document.createElement('div');
      row.className = 'obj-row' + (o.met ? ' obj-met' : '');
      row.textContent = (o.met ? '✓ ' : '○ ') + o.description;
      this._objPanel.appendChild(row);
    }, this);
  }

  showWin(title, sub) {
    this._msgTitle.textContent = title || 'LEVEL COMPLETE!';
    this._msgSub.textContent   = sub   || '';
    this._msgEl.classList.add('show');
  }

  hideWin() { this._msgEl.classList.remove('show'); }
  attachObjects(objects) { this._objects = objects; }

  // ── Settings panel ─────────────────────────────────────────────────────────

  _buildSettingsPanel() {
    var panel = this._settingsPanel;
    panel.innerHTML = '';

    var title = _el('div', 'settings-title');
    title.textContent = 'PHYSICS SETTINGS';
    panel.appendChild(title);

    // Preset selector row
    var presetRow = _el('div', 'preset-row');

    var presetLabel = _el('span', 'preset-row-label');
    presetLabel.textContent = 'PRESET:';
    presetRow.appendChild(presetLabel);

    var sel = document.createElement('select');
    sel.className = 'preset-select';
    this._populatePresetSelect(sel);
    presetRow.appendChild(sel);

    var loadBtn = _el('button', 'preset-load-btn');
    loadBtn.textContent = 'LOAD';
    function doLoad(e) {
      e.preventDefault(); e.stopPropagation();
      var preset = Presets.getById(sel.value);
      Presets.applyPreset(preset);
      // Rebuild sliders to reflect new values
      panel.innerHTML = '';
      this._buildSettingsPanel();
      this._settingsPanel.classList.add('open');
    }
    loadBtn.addEventListener('click',    doLoad.bind(this));
    loadBtn.addEventListener('touchend', doLoad.bind(this));
    presetRow.appendChild(loadBtn);
    panel.appendChild(presetRow);

    // Save preset row
    var saveRow = _el('div', 'save-row');
    var nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.placeholder = 'Preset name…'; nameInput.className = 'preset-name-input';
    var saveBtn = _el('button', 'preset-save-btn');
    saveBtn.textContent = 'SAVE';
    function doSave(e) {
      e.preventDefault(); e.stopPropagation();
      var name = nameInput.value.trim() || ('Custom ' + Date.now());
      var preset = Presets.captureFromCurrent(name);
      Presets.save(preset);
      nameInput.value = '';
      this._populatePresetSelect(sel);
      if (window.Menu) Menu.refreshPresets();
    }
    saveBtn.addEventListener('click',    doSave.bind(this));
    saveBtn.addEventListener('touchend', doSave.bind(this));
    saveRow.appendChild(nameInput); saveRow.appendChild(saveBtn);
    panel.appendChild(saveRow);

    // Divider
    var div = _el('div', 'settings-divider'); panel.appendChild(div);

    // Tabs
    var tabBar     = _el('div', 'tab-bar'); panel.appendChild(tabBar);
    var tabContent = _el('div', 'tab-content'); panel.appendChild(tabContent);

    var tabs = [
      { id:'global',   label:'🌍 GLOBAL'  },
      { id:'bouncer',  label:'⚪ BOUNCE'  },
      { id:'exploder', label:'💥 EXPLODE' },
      { id:'sticky',   label:'🟢 STICKY'  },
      { id:'splitter', label:'🟣 SPLIT'   },
      { id:'gravity',  label:'🔵 GRAVITY' },
    ];

    var panes = {}, self = this;
    tabs.forEach(function(t, idx) {
      var btn = _el('button', 'tab-btn' + (idx===0?' active':''));
      btn.textContent = t.label;
      tabBar.appendChild(btn);

      var pane = _el('div', 'tab-pane');
      pane.style.display = idx===0 ? 'block' : 'none';
      tabContent.appendChild(pane);
      panes[t.id] = pane;

      function activate(e) {
        e.preventDefault(); e.stopPropagation();
        tabBar.querySelectorAll('.tab-btn').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        Object.keys(panes).forEach(function(k){ panes[k].style.display='none'; });
        pane.style.display = 'block';
      }
      btn.addEventListener('click', activate); btn.addEventListener('touchend', activate);

      if (t.id === 'global') {
        _addSlider(pane,'Gravity','Settings','gravityMult',0.3,2.0,0.05,function(v){return Math.round(v*100)+'%';});
      } else {
        var bs = BallSettings[t.id];
        _addSlider(pane,'Size',     null, null, 6, 30,  1,   function(v){return v+'px';},       t.id, 'size');
        _addSlider(pane,'Velocity', null, null, 0.3,3.0,0.05,function(v){return Math.round(v*100)+'%';},t.id,'velocity');
        _addSlider(pane,'Bounce',   null, null, 0.0,2.0,0.05,function(v){return Math.round(v*100)+'%';},t.id,'bounciness');
        _addSlider(pane,'Ground Roll', null, null, 0.50,0.99,0.01,function(v){return Math.round(v*100)+'%';},t.id,'groundFriction');
        if (t.id==='exploder')  { _addSlider(pane,'Blast Radius',null,null,40,250,5,function(v){return v+'px';},t.id,'blastRadius'); _addSlider(pane,'Blast Force',null,null,4,40,1,function(v){return v;},t.id,'blastForce'); }
        if (t.id==='sticky')    { _addSlider(pane,'Stick Strength',null,null,0.1,1.0,0.05,function(v){return Math.round(v*100)+'%';},t.id,'stickyStrength'); _addSlider(pane,'Stick Speed',null,null,1,20,0.5,function(v){return v+' px/f';},t.id,'stickThreshold'); }
        if (t.id==='splitter')  { _addSlider(pane,'Split Count',null,null,1,5,1,function(v){return v+' balls';},t.id,'splitCount'); }
        if (t.id==='gravity')   { _addSlider(pane,'Pull Range',null,null,50,280,5,function(v){return v+'px';},t.id,'gravRange'); _addSlider(pane,'Pull Strength',null,null,0.05,2.0,0.05,function(v){return v.toFixed(2);},t.id,'gravPull'); }
      }
    });

    // Reset defaults
    var resetBtn = _el('button', 'settings-reset-btn');
    resetBtn.textContent = 'RESET ALL DEFAULTS';
    function doReset(e) {
      e.preventDefault();
      Presets.applyPreset(Presets.getById('default'));
      panel.innerHTML = '';
      this._buildSettingsPanel();
      this._settingsPanel.classList.add('open');
    }
    resetBtn.addEventListener('click', doReset.bind(this));
    resetBtn.addEventListener('touchend', doReset.bind(this));
    panel.appendChild(resetBtn);
  }

  _populatePresetSelect(sel) {
    sel.innerHTML = '';
    Presets.getAll().forEach(function(p) {
      var opt = document.createElement('option');
      opt.value = p.id; opt.textContent = p.name + (p.builtIn ? '' : ' ★');
      sel.appendChild(opt);
    });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _el(tag, cls) { var e = document.createElement(tag); if(cls) e.className=cls; return e; }

function _addSlider(container, label, objKey, propKey, min, max, step, fmt, ballType, ballProp) {
  var row = _el('div', 'setting-row');
  var lbl = _el('div', 'setting-label');
  var nameSpan = _el('span'); nameSpan.textContent = label.toUpperCase();
  var valSpan  = _el('span', 'setting-val');

  var target  = ballType ? BallSettings[ballType] : (objKey === 'Settings' ? Settings : window[objKey]);
  var key     = ballType ? ballProp : propKey;
  var current = target ? target[key] : 0;
  valSpan.textContent = fmt(current);

  lbl.appendChild(nameSpan); lbl.appendChild(valSpan);

  var slider = document.createElement('input');
  slider.type='range'; slider.min=min; slider.max=max; slider.step=step; slider.value=current;

  slider.addEventListener('input', function() {
    var v = parseFloat(slider.value);
    if (ballType) BallSettings[ballType][ballProp] = v;
    else if (objKey === 'Settings') Settings[key] = v;
    valSpan.textContent = fmt(v);
  });

  row.appendChild(lbl); row.appendChild(slider);
  container.appendChild(row);
}

window.UI = UI;
