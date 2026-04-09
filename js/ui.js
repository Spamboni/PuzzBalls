window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['ui.js'] = 1578;
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
    this._btnBack     = document.getElementById('btn-back');
    this._btnSettings = document.getElementById('btn-settings');
    this._btnEditor   = null;  // moved to canvas corner button
    this._btnArrows   = null;  // moved to canvas corner button
    this._settingsPanel = document.getElementById('settings-panel');

    var self = this;

    function doReset(e)  { e.preventDefault(); e.stopPropagation(); if(window.Sound&&Sound.uiReset)Sound.uiReset(); opts.onReset(); }
    function doBack(e)   { e.preventDefault(); e.stopPropagation(); opts.onBackToMenu(); }
    function doSettings(e) {
      e.preventDefault(); e.stopPropagation();
      if (!self._panelBuilt) { self._buildSettingsPanel(); self._panelBuilt = true; }
      var opening = !self._settingsPanel.classList.contains('open');
      if(window.Sound&&Sound.uiTap) Sound.uiTap(opening ? 0.35 : 0.22);
      self._settingsPanel.classList.toggle('open');
    }

    this._btnBack.addEventListener('click',    doBack);
    this._btnBack.addEventListener('touchend', doBack);
    this._btnSettings.addEventListener('click',    doSettings);
    this._btnSettings.addEventListener('touchend', doSettings);

    var btnSave = document.getElementById('btn-save-level');
    var btnLoad = document.getElementById('btn-load-level');
    if (btnSave && opts.game) {
      function doSave(e) { e.preventDefault(); e.stopPropagation(); opts.game._saveCustomLevel(); }
      btnSave.addEventListener('click', doSave);
      btnSave.addEventListener('touchend', doSave);
    }
    if (btnLoad && opts.game) {
      function doLoad(e) { e.preventDefault(); e.stopPropagation(); opts.game._showLoadLevelOverlay(); }
      btnLoad.addEventListener('click', doLoad);
      btnLoad.addEventListener('touchend', doLoad);
    }

    if (this._btnEditor && opts.game) {
      function doEditor(e) { e.preventDefault(); e.stopPropagation(); opts.game.toggleEditor(); }
      this._btnEditor.addEventListener('click',    doEditor);
      this._btnEditor.addEventListener('touchend', doEditor);
    }

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
    // Ensure globals exist before building any sliders that reference them
    window.Settings      = window.Settings      || { gravityMult: 1.0, squiggly: { amp:18, freq:0.08, fade:0, delay:0, wave:'sine' }, splatter: { type:'goo', size:11, drips:3, duration:0, maxSplats:20 }, cube: { hp:4, spin:1.0, chaos:0.6, mass:1.4, size:1.0, orbSize:0.35, orbColor:'#ff3300', innerBallType:'gravity', innerBallSize:0.55, innerSpeedBoost:1.4, innerInvinc:30 } };
    window.AudioSettings = window.AudioSettings || { masterVol: 1.0, impactVol: 1.0, impactScaling: true, pitchScaling: true, explosionVol: 1.0 };
    window.BrickDefaults = window.BrickDefaults || {
      rectHP: 100, rectRegen: 2000, rectW: 70, rectH: 22,
      circularHP: 100, circularRegen: 2000, circularR: 22,
      density: 1.0, maxTravel: 60, decel: 0.88, wallBounce: 0.45,
      rotSpeed: 0.3, rotDecel: 0.88,
    };
    window._gridSize = window._gridSize || 10;
    window.SoundVariants = window.SoundVariants || {};
    window.SoundVolumes  = window.SoundVolumes  || {};

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
      { id:'version',  label:'📋 VERSION' },
      { id:'global',   label:'🌍 GLOBAL'  },
      { id:'bouncer',  label:'⚪ BOUNCE'  },
      { id:'exploder', label:'💥 EXPLODE' },
      { id:'sticky',   label:'🟢 STICKY'  },
      { id:'splitter', label:'🟣 SPLIT'   },
      { id:'squiggly', label:'〰️ SQUIGGLY' },
      { id:'cube',     label:'🔲 CUBE'     },
      { id:'splatter', label:'💦 SPLATTER' },
      { id:'gravity',  label:'🔵 GRAVITY' },
      { id:'bricks',   label:'🧱 BRICKS'  },
      { id:'audio',    label:'🔊 AUDIO'   },
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

      if (t.id === 'version') {
        // ── Version info pane ──────────────────────────────────────────────
        var files = [
          'index.html', 'css/styles.css',
          'game.js','balls.js','physics.js','objects.js',
          'ui.js','sound.js','events.js','presets.js','menu.js'
        ];
        var vRow = _el('div', 'version-header');
        var _gv = window.PUZZBALLS_FILE_VERSION && window.PUZZBALLS_FILE_VERSION['game.js'];
        var _gvStr = _gv ? ('v' + String(_gv).slice(0,2) + '.' + String(_gv).slice(2)) : 'v?';
        vRow.innerHTML = '<b>PuzzBalls ' + _gvStr + '</b>';
        vRow.style.cssText = 'color:#00ffee;font-size:13px;padding:6px 0 10px;text-align:center;';
        pane.appendChild(vRow);

        var hint = _el('div','version-hint');
        hint.textContent = 'If a file shows wrong version, hard-reload: hold reload button → "Clear cache & reload"';
        hint.style.cssText = 'color:#aaa;font-size:9px;line-height:1.4;padding:0 4px 10px;';
        pane.appendChild(hint);

        var tbl = _el('div','version-table');
        tbl.style.cssText = 'font-size:10px;';

        files.forEach(function(f) {
          var key    = f.indexOf('/') >= 0 ? f.split('/').pop() : f;
          var fvObj  = window.PUZZBALLS_FILE_VERSION || {};
          var loaded = fvObj[key];
          var row    = _el('div','version-row');
          row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:3px 4px;border-bottom:1px solid rgba(255,255,255,0.06);';
          var nameEl = _el('span','');
          nameEl.textContent = key;
          nameEl.style.cssText = 'color:#cde;';
          var verEl = _el('span','');
          if (loaded === undefined) {
            verEl.textContent = f === 'index.html' ? (_gvStr + ' (this page)') : 'not stamped';
            verEl.style.color = '#888';
          } else if (loaded === window.PUZZBALLS_FILE_VERSION['game.js']) {
            verEl.textContent = _gvStr + ' ✓';
            verEl.style.color = '#44ff88';
          } else {
            verEl.textContent = 'v' + loaded + ' ⚠ old!';
            verEl.style.color = '#ffaa00';
          }
          row.appendChild(nameEl); row.appendChild(verEl);
          tbl.appendChild(row);
        });
        pane.appendChild(tbl);

        // Cache clear instructions
        var instrRow = _el('div','');
        instrRow.style.cssText = 'margin-top:10px;padding:6px 4px;background:rgba(0,30,60,0.5);border-radius:6px;font-size:9px;color:#aaddff;line-height:1.5;';
        instrRow.innerHTML = '<b style="color:#00ffee">⚠ If files show old version:</b><br>' +
          'Android Chrome: tap ⋮ → Settings → Privacy → Clear browsing data → Cached images/files<br><br>' +
          'Or open the URL then add <b>?v=1546</b> to the end and reload.';
        pane.appendChild(instrRow);

      } else if (t.id === 'bricks') {
        window.BrickDefaults = window.BrickDefaults || {
          rectHP: 100, rectRegen: 2000, rectW: 70, rectH: 22,
          circularHP: 100, circularRegen: 2000, circularR: 22,
          density: 1.0, maxTravel: 60, decel: 0.88, wallBounce: 0.45,
          rotSpeed: 0.3, rotDecel: 0.88,
        };
        var bd = window.BrickDefaults;

        var bHdr = _el('div',''); bHdr.textContent = '▬ RECTANGULAR BRICK';
        bHdr.style.cssText = 'color:#4488ff;font-size:10px;font-weight:bold;padding:4px 0 2px;';
        pane.appendChild(bHdr);
        _addSlider(pane,'HP',       'BrickDefaults','rectHP',    10, 500, 10,  function(v){return v+' hp';});
        _addSlider(pane,'Width',    'BrickDefaults','rectW',     20, 200, 5,   function(v){return v+'px';});
        _addSlider(pane,'Height',   'BrickDefaults','rectH',     8,  60,  2,   function(v){return v+'px';});
        _addSlider(pane,'Regen',    'BrickDefaults','rectRegen', 200, 10000, 200, function(v){ return (v/1000).toFixed(1)+'s'; });

        var bHdr2 = _el('div',''); bHdr2.textContent = '● CIRCULAR BRICK';
        bHdr2.style.cssText = 'color:#44ff88;font-size:10px;font-weight:bold;padding:8px 0 2px;';
        pane.appendChild(bHdr2);
        _addSlider(pane,'HP',       'BrickDefaults','circularHP',    10, 500, 10,  function(v){return v+' hp';});
        _addSlider(pane,'Radius',   'BrickDefaults','circularR',     8,  80,  2,   function(v){return v+'px';});
        _addSlider(pane,'Regen',    'BrickDefaults','circularRegen', 200, 10000, 200, function(v){ return (v/1000).toFixed(1)+'s'; });

        var bHdr3 = _el('div',''); bHdr3.textContent = '⚙ MOVABLE BRICK DEFAULTS';
        bHdr3.style.cssText = 'color:#ffaa44;font-size:10px;font-weight:bold;padding:8px 0 2px;';
        pane.appendChild(bHdr3);
        _addSlider(pane,'Mass',   'BrickDefaults','density',   0.5, 5.0, 0.5, function(v){return v.toFixed(1)+'x';});
        _addSlider(pane,'Max Travel','BrickDefaults','maxTravel',  0,  900,  10,  function(v){return v+'px';});
        _addSlider(pane,'Decelerate','BrickDefaults','decel',     0.5, 0.99, 0.01,function(v){return Math.round(v*100)+'%';});

        var bHdr5 = _el('div',''); bHdr5.textContent = '⊞ EDITOR GRID';
        bHdr5.style.cssText = 'color:#00ccff;font-size:10px;font-weight:bold;padding:8px 0 2px;';
        pane.appendChild(bHdr5);
        // Grid size slider — directly updates window._gridSize
        (function(thePane) {
          var row = _el('div','setting-row');
          var lbl = _el('div','setting-label');
          var nm = _el('span'); nm.textContent = 'GRID SIZE';
          var vs = _el('span','setting-val');
          vs.textContent = (window._gridSize || 10) + 'px';
          lbl.appendChild(nm); lbl.appendChild(vs);
          var slider = document.createElement('input');
          slider.type='range'; slider.min=2; slider.max=20; slider.step=1; slider.value=window._gridSize||10;
          slider.addEventListener('input', function() {
            window._gridSize = parseInt(slider.value);
            vs.textContent = slider.value + 'px';
          });
          row.appendChild(lbl); row.appendChild(slider); thePane.appendChild(row);
        })(pane);

        // Brick presets
        var bHdr6 = _el('div',''); bHdr6.textContent = '🧱 BRICK PRESETS';
        bHdr6.style.cssText = 'color:#ffaa44;font-size:10px;font-weight:bold;padding:8px 0 4px;';
        pane.appendChild(bHdr6);
        (function(thePane) {
          var PRESET_KEY = 'puzzballs_brick_presets';
          function loadPresets() { try { return JSON.parse(localStorage.getItem(PRESET_KEY)||'{}'); } catch(e){return {};} }
          function savePresets(o) { try { localStorage.setItem(PRESET_KEY, JSON.stringify(o)); } catch(e){} }
          function renderPresets() {
            list.innerHTML = '';
            var ps = loadPresets(), names = Object.keys(ps);
            if (!names.length) {
              var empty = document.createElement('div');
              empty.textContent = 'No saved presets yet';
              empty.style.cssText = 'color:#446688;font-size:10px;padding:4px 0;';
              list.appendChild(empty); return;
            }
            names.forEach(function(name) {
              var r2 = document.createElement('div');
              r2.style.cssText = 'display:flex;gap:4px;align-items:center;margin-bottom:4px;';
              var lbl2 = document.createElement('span');
              lbl2.textContent = name;
              lbl2.style.cssText = 'flex:1;color:#aaccff;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
              var loadBtn = document.createElement('button');
              loadBtn.textContent = 'LOAD';
              loadBtn.style.cssText = 'background:rgba(0,80,160,0.7);border:1px solid #0088ff;color:#44aaff;font-size:9px;padding:2px 6px;border-radius:3px;cursor:pointer;';
              loadBtn.addEventListener('click', function() {
                if (window._gameRef) window._gameRef._editorLastSettings = JSON.parse(JSON.stringify(ps[name]));
              });
              var delBtn = document.createElement('button');
              delBtn.textContent = '✕';
              delBtn.style.cssText = 'background:rgba(120,0,0,0.7);border:1px solid #cc2222;color:#ff8888;font-size:9px;padding:2px 5px;border-radius:3px;cursor:pointer;';
              delBtn.addEventListener('click', function() { var p2=loadPresets(); delete p2[name]; savePresets(p2); renderPresets(); });
              r2.appendChild(lbl2); r2.appendChild(loadBtn); r2.appendChild(delBtn); list.appendChild(r2);
            });
          }
          var saveRow = document.createElement('div');
          saveRow.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;';
          var inp = document.createElement('input');
          inp.type='text'; inp.placeholder='Preset name...';
          inp.style.cssText = 'flex:1;background:rgba(0,15,40,0.9);border:1px solid #336688;color:#aaddff;font-size:10px;padding:3px 6px;border-radius:3px;';
          var saveBtn = document.createElement('button');
          saveBtn.textContent = 'SAVE';
          saveBtn.style.cssText = 'background:rgba(0,60,30,0.8);border:1px solid #00aa44;color:#00ff88;font-size:9px;padding:2px 8px;border-radius:3px;cursor:pointer;';
          saveBtn.addEventListener('click', function() {
            var n = inp.value.trim(); if (!n) return;
            var snap = (window._gameRef && window._gameRef._editorLastSettings)
              ? JSON.parse(JSON.stringify(window._gameRef._editorLastSettings))
              : JSON.parse(JSON.stringify(window.BrickDefaults||{}));
            var p3 = loadPresets(); p3[n] = snap; savePresets(p3); inp.value = ''; renderPresets();
          });
          saveRow.appendChild(inp); saveRow.appendChild(saveBtn); thePane.appendChild(saveRow);
          var list = document.createElement('div'); thePane.appendChild(list);
          renderPresets();
        })(pane);

        // Brick sound variant pickers
        var bHdr4 = _el('div',''); bHdr4.textContent = 'BRICK SOUNDS';
        bHdr4.style.cssText = 'color:#aaddff;font-size:10px;font-weight:bold;padding:8px 0 4px;';
        pane.appendChild(bHdr4);

        window.SoundVariants = window.SoundVariants || {};
        var brickSounds = [
          { key:'brick_hit',   label:'Brick hit (ball)' },
          { key:'brick_brick', label:'Brick-on-brick' },
          { key:'brick_break', label:'Brick destroyed' },
        ];
        var variantNames2 = [
          'Default','Soft thud','Hard crack','Glass ping','Metallic clank',
          'Deep boom','Hollow knock','Plastic pop','🎵 Boing!','💫 Zap!'
        ];
        brickSounds.forEach(function(item2) {
          var row3 = _el('div','slider-row');
          row3.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:3px 4px;';
          var lbl3 = _el('span',''); lbl3.textContent = item2.label;
          lbl3.style.cssText = 'font-size:9px;color:#aaddff;flex:1;';
          row3.appendChild(lbl3);
          var sel3 = document.createElement('select');
          sel3.style.cssText = 'background:rgba(0,20,50,0.9);color:#aaddff;border:1px solid #336;border-radius:4px;font-size:9px;padding:2px 4px;max-width:110px;';
          variantNames2.forEach(function(vn2, vi2) {
            var opt3 = document.createElement('option');
            opt3.value = vi2; opt3.textContent = vn2; sel3.appendChild(opt3);
          });
          sel3.value = window.SoundVariants[item2.key] || 0;
          sel3.addEventListener('change', function() { window.SoundVariants[item2.key] = parseInt(sel3.value); });
          row3.appendChild(sel3); pane.appendChild(row3);
        });

      } else if (t.id === 'audio') {
        window.AudioSettings = window.AudioSettings || { masterVol: 1.0, impactVol: 1.0, impactScaling: true, pitchScaling: true, explosionVol: 1.0 };
        window.SoundVariants  = window.SoundVariants  || {};

        _addSlider(pane,'Master Volume','AudioSettings','masterVol',0,1.0,0.05,function(v){return Math.round(v*100)+'%';});
        _addSlider(pane,'Ball Hit Volume','AudioSettings','impactVol',0,2.0,0.1,function(v){return Math.round(v*100)+'%';});
        _addSlider(pane,'Explosion Vol','AudioSettings','explosionVol',0,2.0,0.1,function(v){return Math.round(v*100)+'%';});

        ['impactScaling','pitchScaling'].forEach(function(key) {
          var labels = { impactScaling: 'Impact Vol Scaling', pitchScaling: 'Pitch by Density' };
          var row = _el('div','slider-row');
          var lbl = _el('span','slider-label'); lbl.textContent = labels[key]; row.appendChild(lbl);
          var btn = _el('button','toggle-btn');
          btn.style.cssText = 'padding:3px 10px;font-size:10px;border-radius:4px;border:1px solid #00aaff;background:rgba(0,20,50,0.8);color:#00ccff;cursor:pointer;';
          btn.textContent = AudioSettings[key] ? 'ON' : 'OFF';
          function makeToggle(k, b) {
            function doToggle(e) { e.preventDefault(); AudioSettings[k] = !AudioSettings[k]; b.textContent = AudioSettings[k] ? 'ON' : 'OFF'; b.style.color = AudioSettings[k] ? '#00ffaa' : '#ff4444'; }
            b.addEventListener('click', doToggle); b.addEventListener('touchend', doToggle);
          }
          makeToggle(key, btn);
          row.appendChild(btn); pane.appendChild(row);
        });

        // ── Sound variant picker ─────────────────────────────────────────────
        var divider = _el('div','settings-divider'); divider.style.margin = '8px 0 4px'; pane.appendChild(divider);

        var soundHdr = _el('div','');
        soundHdr.textContent = 'SOUND VARIANTS';
        soundHdr.style.cssText = 'color:#00ffee;font-size:10px;font-weight:bold;padding:2px 0 6px;';
        pane.appendChild(soundHdr);

        var soundItems = [
          { key:'bouncer',  label:'⚪ Bouncer hit',   color:'#4488ff' },
          { key:'exploder', label:'💥 Exploder hit',  color:'#ff6600' },
          { key:'sticky',   label:'🟢 Sticky hit',   color:'#44ff88' },
          { key:'splitter', label:'🟣 Splitter hit',  color:'#ff44ff' },
          { key:'gravity',  label:'🔵 Gravity hit',  color:'#00ffee' },
          { key:'explosion',label:'💣 Explosion',    color:'#ff4400' },
          { key:'brick_hit',label:'🧱 Brick hit',    color:'#ffaa44' },
          { key:'brick_brick',label:'🧱🧱 Brick-on-brick', color:'#cc8833' },
        ];

        var variantNames = [
          'Default', 'Soft thud', 'Hard crack', 'Glass ping',
          'Metallic clank', 'Deep boom', 'Hollow knock', 'Plastic pop',
          '🎵 Boing!', '💫 Zap!', '🔇 None'
        ];

        // Default sound name lookup (what "Default" actually is per ball type)
        var defaultSoundNames = {
          bouncer:    'sine bounce',   exploder:   'heavy thud',
          sticky:     'dull thump',    splitter:   'crisp click',
          gravity:    'resonant hum',  explosion:  'deep boom',
          brick_hit:  'glass crack',   brick_brick:'stone thud',
        };

        soundItems.forEach(function(item) {
          var row2 = _el('div','');
          row2.style.cssText = 'padding:3px 4px 0;';

          // Label row
          var labelRow = _el('div','');
          labelRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';
          var lbl2 = _el('span','');
          var defName = defaultSoundNames[item.key] || 'default';
          lbl2.textContent = item.label + ' (default: ' + defName + ')';
          lbl2.style.cssText = 'font-size:9px;color:' + item.color + ';flex:1;';
          labelRow.appendChild(lbl2);

          var sel2 = document.createElement('select');
          sel2.style.cssText = 'background:rgba(0,20,50,0.9);color:#aaddff;border:1px solid #336;border-radius:4px;font-size:9px;padding:2px 4px;max-width:100px;';
          variantNames.forEach(function(vn, vi) {
            var opt2 = document.createElement('option');
            opt2.value = vi === 10 ? -1 : vi; // -1 = None
            opt2.textContent = vn;
            sel2.appendChild(opt2);
          });
          var curV = window.SoundVariants[item.key];
          sel2.value = curV === undefined ? 0 : curV;
          sel2.addEventListener('change', function() {
            window.SoundVariants[item.key] = parseInt(sel2.value);
          });
          labelRow.appendChild(sel2);
          row2.appendChild(labelRow);

          // Volume slider for this sound
          window.SoundVolumes = window.SoundVolumes || {};
          var volRow = _el('div','');
          volRow.style.cssText = 'display:flex;align-items:center;gap:6px;padding:2px 0 4px;';
          var volLbl = _el('span','');
          volLbl.textContent = 'Vol:';
          volLbl.style.cssText = 'font-size:8px;color:#668899;';
          volRow.appendChild(volLbl);
          var volSlider = document.createElement('input');
          volSlider.type = 'range'; volSlider.min = 0; volSlider.max = 200; volSlider.step = 5;
          volSlider.value = (window.SoundVolumes[item.key] !== undefined) ? window.SoundVolumes[item.key] : 100;
          volSlider.style.cssText = 'flex:1;height:14px;accent-color:' + item.color + ';';
          var volVal = _el('span','');
          volVal.textContent = volSlider.value + '%';
          volVal.style.cssText = 'font-size:8px;color:#aaddff;min-width:30px;';
          volSlider.addEventListener('input', function() {
            window.SoundVolumes[item.key] = parseInt(volSlider.value);
            volVal.textContent = volSlider.value + '%';
          });
          volRow.appendChild(volSlider); volRow.appendChild(volVal);
          row2.appendChild(volRow);
          pane.appendChild(row2);
        });

        // Reset sound settings button
        var resetSoundBtn = _el('button', 'settings-reset-btn');
        resetSoundBtn.textContent = 'RESET SOUND SETTINGS';
        resetSoundBtn.style.marginTop = '10px';
        function doResetSounds(e) {
          e.preventDefault();
          window.SoundVariants = {};
          window.SoundVolumes  = {};
          panel.innerHTML = '';
          self._buildSettingsPanel();
          self._settingsPanel.classList.add('open');
        }
        resetSoundBtn.addEventListener('click', doResetSounds);
        resetSoundBtn.addEventListener('touchend', doResetSounds);
        pane.appendChild(resetSoundBtn);
      } else if (t.id === 'global') {
        _addSlider(pane,'Gravity','Settings','gravityMult',0.3,2.0,0.05,function(v){return Math.round(v*100)+'%';});
      } else {
        var bs = BallSettings[t.id];
        _addSlider(pane,'Size',       null, null, 6, 30,  1,    function(v){return v+'px';},       t.id, 'size');
        _addSlider(pane,'Velocity',   null, null, 0.3,3.0,0.05, function(v){return Math.round(v*100)+'%';},t.id,'velocity');
        _addSlider(pane,'Bounce',     null, null, 0.0,2.0,0.05, function(v){return Math.round(v*100)+'%';},t.id,'bounciness');
        _addSlider(pane,'Bounce Decay',null,null, 0.05,0.95,0.02, function(v){return v.toFixed(2);},   t.id,'bounceDecay');
        _addSlider(pane,'Mass',    null, null, 0.2,4.0,0.1,  function(v){return v.toFixed(1)+'x';}, t.id,'density');
        _addSlider(pane,'Ground Roll',null, null, 0.50,0.99,0.01,function(v){return Math.round(v*100)+'%';},t.id,'groundFriction');
        _addSlider(pane,'Brick Dmg',  null, null, 5, 60, 1,    function(v){return v+' hp';},        t.id,'baseDamage');
        if (t.id==='exploder') { _addSlider(pane,'Blast Radius',null,null,40,250,5,function(v){return v+'px';},t.id,'blastRadius'); _addSlider(pane,'Blast Force',null,null,4,40,1,function(v){return v;},t.id,'blastForce'); _addSlider(pane,'Explode Damage',null,null,0,100,5,function(v){return v+' hp';},t.id,'explosionDamage'); }
        if (t.id==='sticky')   { _addSlider(pane,'Stickiness',null,null,10,100,5,function(v){return v;},t.id,'stickiness'); _addSlider(pane,'Stick Threshold',null,null,2,25,0.5,function(v){return v+' px/f';},t.id,'stickThreshold'); _addSlider(pane,'Bounce Height Y',null,null,10,200,5,function(v){return v+'px';},t.id,'bounceHeightY'); _addSlider(pane,'Bounce Dist X',null,null,0,150,5,function(v){return v+'px';},t.id,'bounceDistanceX'); _addSlider(pane,'Dead Zone %',null,null,0,100,5,function(v){return v+'%';},t.id,'deadZonePercent'); }
        if (t.id==='splitter') { _addSlider(pane,'Split Count',null,null,1,5,1,function(v){return v+' balls';},t.id,'splitCount'); }
        if (t.id==='cube') {
          window.Settings.cube = window.Settings.cube || {hp:4,spin:1.0,chaos:0.6,mass:1.4,size:1.0};
          _addSlider(pane,'Size','Settings','cube.size',0.33,2.0,0.05,function(v){return Math.round(v*100)+'%';});
          _addSlider(pane,'Orb Size','Settings','cube.orbSize',0.05,0.95,0.05,function(v){return Math.round(v*100)+'%';});
          // Orb color picker
          var orbColorRow = document.createElement('div');
          orbColorRow.style.cssText = 'display:flex;gap:4px;margin:4px 0;flex-wrap:wrap;align-items:center;';
          var orbColors = [{hex:'#ff3300',name:'RED'},{hex:'#ff8800',name:'ORNG'},{hex:'#ffff00',name:'YLW'},{hex:'#00ff88',name:'GRN'},{hex:'#00ccff',name:'CYAN'},{hex:'#aa44ff',name:'PURP'},{hex:'#ffffff',name:'WHT'}];
          var orbLbl = document.createElement('span');
          orbLbl.textContent='ORB:'; orbLbl.style.cssText='color:#aaa;font-size:8px;font-family:Share Tech Mono,monospace;margin-right:2px;';
          orbColorRow.appendChild(orbLbl);
          orbColors.forEach(function(oc) {
            var ob = document.createElement('button');
            ob.style.cssText='width:22px;height:22px;border-radius:50%;border:2px solid '+oc.hex+'55;background:'+oc.hex+'44;cursor:pointer;';
            var updateOrbBtn = function() {
              var cur = (window.Settings&&window.Settings.cube&&window.Settings.cube.orbColor)||'#ff3300';
              ob.style.borderColor = cur===oc.hex ? oc.hex : oc.hex+'44';
              ob.style.background  = cur===oc.hex ? oc.hex+'99' : oc.hex+'22';
            };
            updateOrbBtn();
            function setOrbColor(e) {
              e.preventDefault();
              window.Settings=window.Settings||{}; window.Settings.cube=window.Settings.cube||{};
              window.Settings.cube.orbColor=oc.hex;
              document.querySelectorAll('.orb-color-btn').forEach(function(b){ b.style.borderColor=b._orbHex+'44'; b.style.background=b._orbHex+'22'; });
              ob.style.borderColor=oc.hex; ob.style.background=oc.hex+'99';
            }
            ob._orbHex = oc.hex;
            ob.classList.add('orb-color-btn');
            ob.addEventListener('click',setOrbColor); ob.addEventListener('touchend',setOrbColor);
            orbColorRow.appendChild(ob);
          });
          pane.appendChild(orbColorRow);
          _addSlider(pane,'HP (hits to shatter)','Settings','cube.hp',1,12,1,function(v){return v+' hits';});
          _addSlider(pane,'Spin Speed','Settings','cube.spin',0.1,8.0,0.1,function(v){return v.toFixed(1)+'x';});
          _addSlider(pane,'Chaos (spin randomness)','Settings','cube.chaos',0,1,0.05,function(v){return Math.round(v*100)+'%';});
          _addSlider(pane,'Mass','Settings','cube.mass',0.5,3.0,0.1,function(v){return v.toFixed(1)+'x';});
          // Inner ball section
          var ibLabel = document.createElement('div');
          ibLabel.textContent = '── INNER BALL ──';
          ibLabel.style.cssText = 'color:#00ccff88;font-size:8px;font-family:Share Tech Mono,monospace;margin:6px 0 2px;text-align:center;';
          pane.appendChild(ibLabel);
          _addSlider(pane,'Inner Ball Size','Settings','cube.innerBallSize',0.2,1.2,0.05,function(v){return Math.round(v*100)+'%';});
          _addSlider(pane,'Speed Boost on Release','Settings','cube.innerSpeedBoost',0,3.0,0.1,function(v){return v===0?'OFF':v.toFixed(1)+'x';});
          _addSlider(pane,'Invincibility (frames)','Settings','cube.innerInvinc',0,120,5,function(v){return v===0?'OFF':v+'f';});
          // Inner ball type picker
          var ibRow = document.createElement('div');
          ibRow.style.cssText = 'display:flex;gap:3px;margin:4px 0;flex-wrap:wrap;';
          var ibTypes = [
            {id:'gravity',label:'GRV',col:'#00ffee'},
            {id:'bouncer',label:'BNC',col:'#4488ff'},
            {id:'sticky', label:'STK',col:'#44ff44'},
            {id:'exploder',label:'EXP',col:'#ff4400'},
            {id:'squiggly',label:'SQG',col:'#ffcc00'},
            {id:'splitter',label:'SPL',col:'#ff44ff'},
          ];
          ibTypes.forEach(function(ib) {
            var ibb = document.createElement('button');
            ibb.textContent = ib.label;
            ibb.style.cssText = 'flex:1;min-width:36px;padding:4px 2px;font-family:Share Tech Mono,monospace;font-size:9px;border-radius:4px;cursor:pointer;border:1px solid '+ib.col+'44;background:rgba(0,0,0,0.2);color:'+ib.col+'88;';
            var updateIBBtn = function() {
              var cur = (window.Settings&&window.Settings.cube&&window.Settings.cube.innerBallType)||'gravity';
              ibb.style.borderColor = cur===ib.id ? ib.col : ib.col+'33';
              ibb.style.background  = cur===ib.id ? 'rgba(0,40,60,0.6)' : 'rgba(0,0,0,0.2)';
              ibb.style.color       = cur===ib.id ? ib.col : ib.col+'66';
            };
            updateIBBtn();
            function setIBType(e) {
              e.preventDefault();
              window.Settings=window.Settings||{}; window.Settings.cube=window.Settings.cube||{};
              window.Settings.cube.innerBallType = ib.id;
              document.querySelectorAll('.ib-type-btn').forEach(function(b){ b.style.background='rgba(0,0,0,0.2)'; });
              ibb.style.borderColor=ib.col; ibb.style.background='rgba(0,40,60,0.6)'; ibb.style.color=ib.col;
            }
            ibb.classList.add('ib-type-btn');
            ibb.addEventListener('click',setIBType); ibb.addEventListener('touchend',setIBType);
            ibRow.appendChild(ibb);
          });
          pane.appendChild(ibRow);
        }
        if (t.id==='splatter') {
          // Type picker
          var splatRow = document.createElement('div');
          splatRow.style.cssText = 'display:flex;gap:4px;margin-bottom:8px;';
          var splatTypes = [{id:'dead',label:'💀 DEAD',col:'#aa6600'},{id:'boost',label:'⚡ BOOST',col:'#ddcc00'},{id:'goo',label:'🟢 GOO',col:'#44aa00'}];
          // Init splatter sub-settings — must be before any property access
          window.Settings.splatter = window.Settings.splatter || {type:'goo',size:11,drips:3,duration:0,maxSplats:20};
          window.Settings.splatter.deadGravMult = window.Settings.splatter.deadGravMult !== undefined ? window.Settings.splatter.deadGravMult : 8;
          window.Settings.splatter.deadGravDur  = window.Settings.splatter.deadGravDur  !== undefined ? window.Settings.splatter.deadGravDur  : 90;
          window.Settings.splatter.boostMult    = window.Settings.splatter.boostMult    !== undefined ? window.Settings.splatter.boostMult    : 2.2;
          window.Settings.splatter.gooStickiness= window.Settings.splatter.gooStickiness!== undefined ? window.Settings.splatter.gooStickiness: 50;
          window.Settings.splatter.gooPermanent = window.Settings.splatter.gooPermanent  !== undefined ? window.Settings.splatter.gooPermanent : false;
          splatTypes.forEach(function(st) {
            var sb2 = document.createElement('button');
            sb2.textContent = st.label;
            sb2.style.cssText = 'flex:1;padding:6px 2px;font-family:Share Tech Mono,monospace;font-size:9px;border-radius:4px;cursor:pointer;border:1px solid '+st.col+'55;background:rgba(0,0,0,0.2);color:'+st.col+'99;';
            var updateSplatBtn = function() {
              var cur = (window.Settings && window.Settings.splatter && window.Settings.splatter.type) || 'dead';
              sb2.style.borderColor = cur===st.id ? st.col : st.col+'33';
              sb2.style.background  = cur===st.id ? 'rgba(100,60,0,0.3)' : 'rgba(0,0,0,0.2)';
              sb2.style.color       = cur===st.id ? st.col : st.col+'66';
            };
            updateSplatBtn();
            function setSplatType(e) {
              e.preventDefault();
              window.Settings = window.Settings || {};
              window.Settings.splatter = window.Settings.splatter || {};
              window.Settings.splatter.type = st.id;
              document.querySelectorAll('.splat-type-btn').forEach(function(b){ b.style.borderColor=''; b.style.background='rgba(0,0,0,0.2)'; });
              sb2.style.borderColor=st.col; sb2.style.background='rgba(100,60,0,0.3)'; sb2.style.color=st.col;
            }
            sb2.classList.add('splat-type-btn');
            sb2.addEventListener('click', setSplatType);
            sb2.addEventListener('touchend', setSplatType);
            splatRow.appendChild(sb2);
          });
          pane.appendChild(splatRow);
          _addSlider(pane,'Size (core radius)','Settings','splatter.size',4,60,1,function(v){return v+'px';});
          _addSlider(pane,'Drips','Settings','splatter.drips',0,8,1,function(v){return v;});
          _addSlider(pane,'Duration (sec, 0=∞)','Settings','splatter.duration',0,60,1,function(v){return v===0?'∞ forever':v+'s';});
          _addSlider(pane,'Max Splats','Settings','splatter.maxSplats',1,20,1,function(v){return v;});

          // Divider
          var _sd = document.createElement('div');
          _sd.style.cssText='color:#88aacc66;font-size:8px;font-family:Share Tech Mono,monospace;margin:6px 0 2px;text-align:center;';
          _sd.textContent='── DEAD SETTINGS ──'; pane.appendChild(_sd);
          _addSlider(pane,'Gravity Mult (on hit)','Settings','splatter.deadGravMult',1,20,0.5,function(v){return v.toFixed(1)+'x';});
          _addSlider(pane,'Gravity Duration (0=perm)','Settings','splatter.deadGravDur',0,300,10,function(v){return v===0?'PERM':v+'f';});

          var _sd2 = document.createElement('div');
          _sd2.style.cssText='color:#88aacc66;font-size:8px;font-family:Share Tech Mono,monospace;margin:6px 0 2px;text-align:center;';
          _sd2.textContent='── BOOST SETTINGS ──'; pane.appendChild(_sd2);
          _addSlider(pane,'Boost Multiplier','Settings','splatter.boostMult',1,10,0.5,function(v){return v.toFixed(1)+'x';});

          var _sd3 = document.createElement('div');
          _sd3.style.cssText='color:#88aacc66;font-size:8px;font-family:Share Tech Mono,monospace;margin:6px 0 2px;text-align:center;';
          _sd3.textContent='── GOO SETTINGS ──'; pane.appendChild(_sd3);
          _addSlider(pane,'Goo Stickiness','Settings','splatter.gooStickiness',10,100,5,function(v){return v;});
          // Permanent toggle
          var _permRow = document.createElement('div');
          _permRow.style.cssText='display:flex;align-items:center;gap:8px;margin:4px 0;';
          var _permLbl = document.createElement('span');
          _permLbl.textContent='PERMANENT (no escape)';
          _permLbl.style.cssText='color:#aaa;font-size:9px;font-family:Share Tech Mono,monospace;flex:1;';
          var _permBtn = document.createElement('button');
          var updatePermBtn = function() {
            var on = !!(window.Settings&&window.Settings.splatter&&window.Settings.splatter.gooPermanent);
            _permBtn.textContent = on ? 'ON' : 'OFF';
            _permBtn.style.cssText='padding:4px 10px;font-size:9px;font-family:Share Tech Mono,monospace;border-radius:4px;cursor:pointer;border:1px solid '+(on?'#44ff44':'#446644')+';background:'+(on?'rgba(0,60,0,0.7)':'rgba(0,20,0,0.4)')+';color:'+(on?'#44ff44':'#668866')+';';
          };
          updatePermBtn();
          function togglePerm(e) {
            e.preventDefault();
            window.Settings=window.Settings||{}; window.Settings.splatter=window.Settings.splatter||{};
            window.Settings.splatter.gooPermanent = !window.Settings.splatter.gooPermanent;
            updatePermBtn();
          }
          _permBtn.addEventListener('click',togglePerm); _permBtn.addEventListener('touchend',togglePerm);
          _permRow.appendChild(_permLbl); _permRow.appendChild(_permBtn); pane.appendChild(_permRow);
        }
        if (t.id==='gravity')  { _addSlider(pane,'Pull Range',null,null,50,280,5,function(v){return v+'px';},t.id,'gravRange'); _addSlider(pane,'Pull Strength',null,null,0.05,5.0,0.05,function(v){return v.toFixed(2);},t.id,'gravPull'); }
        if (t.id==='squiggly') {
          window.Settings.squiggly = window.Settings.squiggly || {amp:18,freq:0.08,fade:0,delay:0,wave:'sine'};
          _addSlider(pane,'Amplitude (AMP)','Settings','squiggly.amp',2,80,1,function(v){return v+'px';});
          _addSlider(pane,'Frequency (FREQ)','Settings','squiggly.freq',0.01,0.3,0.005,function(v){return v.toFixed(3);});
          _addSlider(pane,'Fade (end dampens)','Settings','squiggly.fade',0,1,0.05,function(v){return Math.round(v*100)+'%';});
          _addSlider(pane,'Delay (start late)','Settings','squiggly.delay',0,0.9,0.05,function(v){return Math.round(v*100)+'%';});
          // Wave shape picker
          var waveRow = document.createElement('div');
          waveRow.style.cssText = 'display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;';
          var waves = ['sine','zigzag','square','chaos'];
          var waveLabels = ['SINE','ZIGZAG','SQUARE','CHAOS'];
          waves.forEach(function(w, wi) {
            var wb = document.createElement('button');
            wb.textContent = waveLabels[wi];
            wb.style.cssText = 'flex:1;min-width:50px;padding:5px;font-family:Share Tech Mono,monospace;font-size:9px;border-radius:4px;cursor:pointer;border:1px solid #ffcc0055;background:rgba(255,200,0,0.05);color:#ffcc0099;';
            var updateWaveBtn = function() {
              var cur = (window.Settings && window.Settings.squiggly && window.Settings.squiggly.wave) || 'sine';
              wb.style.borderColor = cur===w ? '#ffcc00' : '#ffcc0033';
              wb.style.background  = cur===w ? 'rgba(255,200,0,0.2)' : 'rgba(255,200,0,0.05)';
              wb.style.color       = cur===w ? '#ffdd44' : '#ffcc0077';
            };
            updateWaveBtn();
            function setWave(e) {
              e.preventDefault();
              window.Settings = window.Settings || {};
              window.Settings.squiggly = window.Settings.squiggly || {};
              window.Settings.squiggly.wave = w;
              waves.forEach(function(_, i) { }); // trigger re-render
              document.querySelectorAll('.wave-btn').forEach(function(b){ b.style.borderColor='#ffcc0033'; b.style.background='rgba(255,200,0,0.05)'; b.style.color='#ffcc0077'; });
              wb.style.borderColor='#ffcc00'; wb.style.background='rgba(255,200,0,0.2)'; wb.style.color='#ffdd44';
            }
            wb.classList.add('wave-btn');
            wb.addEventListener('click', setWave);
            wb.addEventListener('touchend', setWave);
            waveRow.appendChild(wb);
          });
          pane.appendChild(waveRow);
        }

        // Per-ball reset button
        (function(ballId, thePane, self2) {
          var rbtn = _el('button', 'settings-reset-btn');
          rbtn.textContent = 'RESET ' + ballId.toUpperCase() + ' DEFAULTS';
          rbtn.style.marginTop = '8px';
          function doResetBall(e) {
            e.preventDefault();
            var defaults = Presets.getById('default');
            if (defaults.balls && defaults.balls[ballId]) {
              Presets.applyPreset({ balls: { [ballId]: defaults.balls[ballId] } });
            }
            panel.innerHTML = '';
            self2._buildSettingsPanel();
            self2._settingsPanel.classList.add('open');
          }
          rbtn.addEventListener('click', doResetBall);
          rbtn.addEventListener('touchend', doResetBall);
          thePane.appendChild(rbtn);
        })(t.id, pane, self);
      }
    });

    // Global reset all
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

  // Support dot-notation for nested Settings keys e.g. 'squiggly.amp'
  var target, key;
  if (ballType) {
    target = BallSettings[ballType]; key = ballProp;
  } else if (objKey === 'Settings' && propKey.indexOf('.') > -1) {
    var parts = propKey.split('.');
    target = Settings[parts[0]] = Settings[parts[0]] || {};
    key = parts[1];
  } else {
    target = objKey === 'Settings' ? Settings : window[objKey];
    key = propKey;
  }

  var current = target ? (target[key] !== undefined ? target[key] : 0) : 0;
  valSpan.textContent = fmt(current);

  lbl.appendChild(nameSpan); lbl.appendChild(valSpan);

  var slider = document.createElement('input');
  slider.type='range'; slider.min=min; slider.max=max; slider.step=step; slider.value=current;

  slider.addEventListener('input', function() {
    var v = parseFloat(slider.value);
    if (ballType) BallSettings[ballType][ballProp] = v;
    else if (target) target[key] = v;
    valSpan.textContent = fmt(v);
  });

  row.appendChild(lbl); row.appendChild(slider);
  container.appendChild(row);
}

window.UI = UI;
