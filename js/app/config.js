// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

define(['i18n!nls/main', 'lodash'], function (t, _) {

  var mobile_width = 1024
    , is_in_iframe = top.location != self.location
    , is_blink = (window.chrome || window.Intl && Intl.v8BreakIterator)
        && 'CSS' in window
    , callbacks = {};

  var config = {

    mobile_width: mobile_width,
    is_in_iframe: is_in_iframe,
    is_blink: is_blink,

    presets: {
      full: {
        annotations: true,
        square_hl: true,
        show_roads: true,
        show_axis_labels: true,
        show_flat_counts: true,
        show_branches: true,
        show_current_move: false,
        show_unplayed_pieces: true,
        show_play_controls: false
      },
      minimal: {
        annotations: true,
        show_axis_labels: false,
        show_flat_counts: false,
        show_current_move: false,
        show_unplayed_pieces: true,
        show_play_controls: false
      },
      edit_mode: {
        annotations: false,
        square_hl: true,
        show_roads: true,
        show_axis_labels: true,
        show_flat_counts: true,
        show_branches: true,
        show_current_move: false,
        show_unplayed_pieces: false,
        show_play_controls: false
      },
      play_mode: {
        annotations: true,
        square_hl: true,
        show_roads: false,
        show_axis_labels: false,
        show_flat_counts: true,
        show_branches: true,
        show_current_move: false,
        show_unplayed_pieces: true,
        show_play_controls: false
      }
    },

    defaults: {
      edit: {
        board_opacity: 35,
        show_parse_errors: true
      },

      play: {
        speed: 60 // BPM
      },

      // Board
      player1: t.Player1_name,
      player2: t.Player2_name,
      board_size: 5,
      board_rotation: [0, 0.85, 0.85],
      board_max_angle: 30,
      board_rotate_sensitivity: 3,
      board_3d: is_blink,
      board_shadows: window.innerWidth > mobile_width,
      animate_board: true,
      animate_ui: true,
      show_fab: true,
      branch_numbering: true,
      last_session: ''
    },

    toggle: function (prop, mode, initiator) {
      this.set(
        prop,
        mode ? !this[mode][prop] : !this[prop],
        mode,
        initiator
      );
    },

    set: function (prop, value, mode, initiator) {
      var is_first_change;

      if (mode) {
        is_first_change = _.isUndefined(localStorage[mode+'.'+prop]);
        if (this[mode][prop] != value) {
          this[mode][prop] = value;
          localStorage[mode+'.'+prop] = JSON.stringify(value);
        }
      } else {
        is_first_change = _.isUndefined(localStorage[prop]);
        if (this[prop] != value) {
          this[prop] = value;
          localStorage[prop] = JSON.stringify(value);
        }
      }

      this.on_change(prop, null, mode, initiator, is_first_change);
    },

    set_css_flag: function (prop, value) {
      if (app.$html && _.isBoolean(value)) {
        if (value) {
          app.$html.addClass(prop.replace(/_/g, '-'));
        } else {
          app.$html.removeClass(prop.replace(/_/g, '-'));
        }
      }
    },

    update_flags: function () {
      var prop, value;

      for (prop in this[app.mode]) {
        value = this[app.mode][prop];
        this.set_css_flag(prop, value);
      }
    },

    load_preset: function (preset, mode, silent) {
      _.assignIn(this[mode], this.presets[preset]);
      if (!silent && mode == app.mode) {
        this.update_flags();
      }
    },

    load: function () {
      var i = 0, prop, stored, mode;

      _.assignIn(this, this.defaults);
      config.load_preset('edit_mode', 'edit', true);
      config.load_preset('play_mode', 'play', true);

      while (prop = localStorage.key(i++)) {
        stored = localStorage[prop];
        mode = prop.match(/(\w+)\./);
        if (mode) {
          mode = mode[1];
          prop = prop.substr(mode.length + 1);
        }
        try {
          this.set(prop, JSON.parse(stored), mode);
        } catch (e) {}
      }
    },

    on_change: function (prop, fn, mode, initiator, is_first_change) {
      var value, i;

      function _listen(prop) {
        if (!_.has(callbacks, prop)) {
          callbacks[prop] = [fn];
        } else {
          callbacks[prop].push(fn);
        }
      }

      if (_.isFunction(fn)) {
        if (_.isArray(prop)) {
          _.each(prop, _listen);
        } else {
          _listen(prop);
        }
      } else {
        value = mode ? this[mode][prop] : this[prop];

        // Update CSS flags when any config changes
        if (!mode || mode == app.mode) {
          this.set_css_flag(prop, value);
        }

        if (_.has(callbacks, prop)) {
          for (i = 0; i < callbacks[prop].length; i++) {
            callbacks[prop][i].call(
              this,
              value,
              prop,
              mode,
              initiator,
              is_first_change
            );
          }
        }
      }

      return this;
    }

  };

  config.load();

  return config;

});
