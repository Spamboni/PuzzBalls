window.PUZZBALLS_FILE_VERSION = window.PUZZBALLS_FILE_VERSION || {}; window.PUZZBALLS_FILE_VERSION['events.js'] = 1578;
// events.js — PuzzBalls Event & Trigger System
// Decoupled event dispatcher: objects don't know about each other;
// the EventManager connects them via level-defined triggers.

var EventManager = (function() {

  var _listeners  = {};   // eventId → [ triggerDef, ... ]
  var _targets    = {};   // objectId → object reference
  var _timers     = [];   // pending { fn, delay } deferred calls

  // ── Registration ──────────────────────────────────────────────────────────

  function registerTarget(id, obj) {
    _targets[id] = obj;
  }

  function subscribe(eventId, triggerDef) {
    if (!_listeners[eventId]) _listeners[eventId] = [];
    _listeners[eventId].push(triggerDef);
  }

  function reset() {
    _listeners = {};
    _targets   = {};
    _timers    = [];
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────

  function dispatch(eventId) {
    var list = _listeners[eventId];
    if (!list) return;
    for (var i = 0; i < list.length; i++) {
      _execute(list[i]);
    }
  }

  function _execute(trigger) {
    var game = window._gameInstance;
    var type = trigger.actionType;

    switch (type) {

      case 'open_door': {
        var target = _targets[trigger.targetId];
        if (target && target.openDoor) {
          target.openDoor();
          if (trigger.duration) {
            var closeTarget = target;
            setTimeout(function() { if (closeTarget.closeDoor) closeTarget.closeDoor(); }, trigger.duration);
          }
        }
        break;
      }

      case 'close_door': {
        var target = _targets[trigger.targetId];
        if (target && target.closeDoor) target.closeDoor();
        break;
      }

      case 'toggle_door': {
        var target = _targets[trigger.targetId];
        if (target) {
          if (target.isOpen) { if (target.closeDoor) target.closeDoor(); }
          else               { if (target.openDoor)  target.openDoor();  }
        }
        break;
      }

      case 'activate_spawner': {
        var target = _targets[trigger.targetId];
        if (target && target.activate) target.activate();
        break;
      }

      case 'disable_spawner': {
        var target = _targets[trigger.targetId];
        if (target && target.deactivate) target.deactivate();
        break;
      }

      case 'toggle_turnstile': {
        var target = _targets[trigger.targetId];
        if (target && target.toggleRotation) target.toggleRotation();
        break;
      }

      case 'set_port_active': {
        var target = _targets[trigger.targetId];
        if (target && target.setActive) target.setActive(true);
        break;
      }

      case 'set_port_inactive': {
        var target = _targets[trigger.targetId];
        if (target && target.setActive) target.setActive(false);
        break;
      }

      case 'win_condition': {
        if (game && game.checkWinCondition) game.checkWinCondition();
        break;
      }

      case 'respawn_all_balls': {
        if (game && game.respawnAllBalls) game.respawnAllBalls();
        break;
      }

      case 'broadcast': {
        // Chain-fire another event
        if (trigger.broadcastId) dispatch(trigger.broadcastId);
        break;
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  return {
    registerTarget: registerTarget,
    subscribe:      subscribe,
    dispatch:       dispatch,
    reset:          reset,
  };

}());

window.EventManager = EventManager;
