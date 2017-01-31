// PTN Ninja by Craig Laparo is licensed under a Creative Commons
// Attribution-NonCommercial-ShareAlike 4.0 International License.
// http://creativecommons.org/licenses/by-nc-sa/4.0/

'use strict';

requirejs({locale: navigator.language}, [
  'i18n!nls/main',
  'app/messages',
  'app/config',
  'app/app',
  'filesaver',
  'lodash',
  'jquery',
  'jquery.keymap',
  'jquery.aftertransition',
  'bililiteRange',
  'bililiteRange.undo',
  'bililiteRange.fancytext',
  'domReady!'
], function (t, Messages, config, app, saveAs, _, $) {

  window.app = app;
  window.t = t;


  // Templatize i18n strings
  (function () {
    function _templatize(parent) {
      for (var key in parent) {
        if (parent.hasOwnProperty(key)) {
          if (_.isString(parent[key])) {
            if (/<%/.test(parent[key])) {
              parent[key] = _.template(parent[key]);
            }
          } else {
            _templatize(parent[key])
          }
        }
      }
    }
    _templatize(t);
  })();


  // Long-click/press
  $.fn.longClick = function(selector, callback, normal_callback) {
    var timeout = 350
      , max_distance = 5
      , $this = $(this)
      , coords = {};

    if (_.isFunction(selector)) {
      if (_.isFunction(callback)) {
        normal_callback = callback;
      }
      callback = selector;
      selector = '';
    }

    function start(event) {
      if ($this.timer) {
        return;
      }

      coords.x = event.clientX;
      coords.y = event.clientY;

      if (event.type == 'touchstart') {
        $this.off('mousedown', selector, start);
        $this.on('touchend', selector, normal_click);
      } else {
        $this.on('mouseup', selector, normal_click);
      }

      app.$document.on('mousemove', selector, cancel_if_too_far);
      $this.on('mouseout', selector, cancel);

      $this.timer = setTimeout(function () {
        cancel();

        event.click_duration = timeout;
        event.preventDefault();
        event.stopPropagation();

        callback(event);
      }, timeout);
    }

    function cancel() {
      clearTimeout($this.timer);
      $this.timer = null;
      $this.off('touchend mouseup', selector, normal_click);
      app.$document.off('mousemove', selector, cancel_if_too_far);
      $this.off('mouseout', selector, cancel);
    }

    function cancel_if_too_far(event) {
      if (
        max_distance < Math.sqrt(
          Math.pow(coords.x - event.clientX, 2)
          + Math.pow(coords.y - event.clientY, 2)
        )
      ) {
        cancel();
      }
    }

    function normal_click(event) {
      if (_.isFunction(normal_callback)) {
        normal_callback(event);
      }
      cancel();
    }

    $this.on('touchstart mousedown', selector, start);

    return this;
  };


  $('title').text(t.app_title);


  // Initialize Menu
  app.menu.render();

  app.$window = $(window);
  app.$document = $(document);
  app.$html = $('html');
  app.$body = $('body');
  app.$ptn = $('#ptn');
  app.$viewer = $('#viewer');
  app.$board_view = app.$viewer.find('.table-wrapper');
  app.$controls = app.$viewer.find('.controls');
  app.$editor = $('#editor');
  app.$fab = $('#fab');
  app.$download = $('#download');
  app.$open = $('#open');
  app.$menu_edit = $('#menu-edit');
  app.$menu_play = $('#menu-play');
  app.m = new Messages('global');

  app.range = bililiteRange(app.$ptn[0]);
  app.range.undo(0);


  // Add boolean preferences to html class
  app.$html.addClass(
    _.map(_.keys(_.pickBy(app.config, _.isBoolean)), function (prop) {
      return app.config[prop] ? prop.replace(/_/g, '-') : '';
    }).join(' ')
  );


  // Initialize embed stuff
  if (app.is_in_iframe) {
    app.$html.addClass('embed');
  }


  // Initialize FAB
  app.$fab.on('touchstart click', function (event) {
    event.stopPropagation();
    event.preventDefault();
    if (app.$html.hasClass('error')) {
      if (app.game.is_editing) {
        config.toggle('show_parse_errors');
      } else {
        app.toggle_edit_mode(true);
      }
    } else {
      app.toggle_edit_mode();
    }
  }).mouseover(function () {
    app.$fab.attr('title',
      app.$html.hasClass('error') ? t.Show_Hide_Errors :
        app.game.is_editing ? t.Play_Mode : t.Edit_Mode
    );
  });


  // Initialize play controls
  app.$controls.find('.first')
      .on('touchstart click', app.board.first)
      .attr('title', t.First_Ply);
  app.$controls.find('.prev')
    .on('touchstart click', app.board.prev_ply)
    .attr('title', t.Previous_Ply);
  app.$controls.find('.play')
    .on('touchstart click', app.board.playpause)
    .attr('title', t.PlayPause);
  app.$controls.find('.next')
    .on('touchstart click', app.board.next_ply)
    .attr('title', t.Next_Ply);
  app.$controls.find('.last')
    .on('touchstart click', app.board.last)
    .attr('title', t.Last_Ply);


  // Re-render $ptn
  // Initialize board
  // Update Permalink
  app.$permalink = $('#permalink');
  app.game.on_parse_end(app.update_after_parse);


  // Re-render $viewer after board initialization
  app.board.on_init(function () {
    app.$board_view.empty().append(app.board.render());
    app.board.resize();
  });


  // Resize board after window resize and board config changes
  app.$window.on('resize', app.resize);
  app.config.on_change([
    'show_axis_labels',
    'show_flat_counts',
    'show_current_move',
    'show_unplayed_pieces',
    'show_play_controls'
  ], app.resize);


  // Update editor width after every board resize
  app.board.on_resize(function () {
    if (app.game.is_editing || !app.$editor.attr('style')) {
      app.set_editor_width(
        app.board.vw,
        app.board.width
      );
    }
  });


  // Update current ply display
  app.board.on_ply(app.update_after_ply);


  // Make playback speed respond immediately to speed changes
  config.on_change('speed', function (speed) {
    var now = new Date().getTime()
      , next_frame = app.board.play_timestamp + 6e4/speed;

    if (app.board.is_playing) {
      if (next_frame < now) {
        app.board.next();
      } else {
        clearTimeout(app.board.play_timer);
        setTimeout(app.board.next, next_frame - now);
      }
    }
  }, 'play');


  // Update opacity controls when value changes
  config.on_change('board_opacity', function (opacity) {
    app.$viewer.css('opacity', opacity/100);
  });
  config.on_change('board_opacity');

  // Update piece positioning after toggling 3D
  config.on_change('board_3d', app.board.reposition_pieces);
  config.on_change('board_3d', function (value, prop, n, i, is_first_change) {
    if (is_first_change) {
      if (!app.is_blink) {
        app.m.help(t.help.board_3d_experimental);
      }
      app.m.help(t.help.board_rotation);
    }
  });

  // Open menu on left edge touch
  app.$body.on('touchstart', function (event) {
    if (event.originalEvent.touches[0].clientX < 10) {
      app.menu.open();
      event.preventDefault();
      event.stopPropagation();
    }
  });

  // Rotate board in 3D mode
  config.on_change('board_rotation', app.board.rotate);
  app.$viewer.on(
    'mousedown touchstart',
    app.board.rotate_handler
  ).longClick(
    '.square.valid',
    app.board.select_square,
    app.board.select_square
  ).on('contextmenu', function (event) {
    event.preventDefault();
  }).longClick(app.board.reset_rotation)


  // Initialize Download Button
  app.$download.on('touchstart click', function (event) {
    event.stopPropagation();
    event.preventDefault();
    saveAs(
      new Blob([app.game.ptn], {type: "text/plain;charset=utf-8"}),
      (app.game.config.player1 || t.Player1) +
      ' vs ' +
      (app.game.config.player2 || t.Player2) +
      (
        app.game.config.result ?
        ' ' + app.game.config.result.text.replace(/\//g, '-')
        : ''
      ) +
      (
        app.game.config.date ?
        ' ' + app.game.config.date
        : ''
      ) +
      (
        app.game.config.time ?
        '-' + app.game.config.time.replace(/\D/g, '.')
        : ''
      )
      + '.ptn',
      true
    );
  });


  // Initialize Open Button
  app.$open.on('change', function (event) {
    event.stopPropagation();
    event.preventDefault();
    app.read_file(this.files[0]);
    $(this).val('');
    app.menu.close();
  });


  // Listen for dropped files and hash change
  if (window.File && window.FileReader && window.FileList && window.Blob) {
    app.$window.on('drop', function(event) {
      event.stopPropagation();
      event.preventDefault();
      app.read_file(event.originalEvent.dataTransfer.files[0]);
    }).on('dragover', function(event) {
      event.preventDefault();
      event.stopPropagation();
    }).on('dragleave', function(event) {
      event.preventDefault();
      event.stopPropagation();
    // }).on('hashchange', function () {
    //   app.board.ply_index = 0;
    //   app.game.parse(app.hash || app.default_ptn, !!app.hash, true);
    });
  }


  // UI changes for parse errors
  app.$window.on('error:parse', function () {
    app.$html.addClass('error');
  }).on('clear:error:parse', function () {
    app.$html.removeClass('error');
  });


  // Bind update events to game parsing
  bililiteRange.fancyText(app.$ptn[0], function (editor, text) {
    text = text || app.$ptn.text();

    if (text && text != '\n') {
      return app.game.parse(text);
    }
    return false;
  }, 100);


  // Load the initial PTN
  app.game.parse(
    app.hash || app.default_ptn,
    !!app.hash,
    !sessionStorage.ptn
  );
  app.clear_undo_history();


  // Listen for caret movement
  app.$ptn.on('keyup mouseup', app.set_position_from_caret);
  if (app.supports_passive) {
    app.$ptn[0].addEventListener(
      'scroll',
      app.save_scroll_position,
      {passive: true}
    );
  } else {
    app.$ptn.on('scroll', app.save_scroll_position);
  }


  // Set initial mode
  if (config.animate_board) {
    app.$html.removeClass('animate-board');
    app.toggle_edit_mode(app.$html.hasClass('error'));
    app.$html.height(); // Update DOM before re-enabling animations
    app.$html.addClass('animate-board');
  } else {
    app.toggle_edit_mode(app.$html.hasClass('error'));
  }
  app.restore_caret();


  // Open the relevant menu accordion
  if (app.mode == 'edit') {
    app.$menu_edit.addClass('mdl-accordion--opened');
  } else {
    app.$menu_play.addClass('mdl-accordion--opened');
  }


  // Bind hotkeys
  app.$window.on('keydown', function (event) {
    var $focus = $(getSelection().focusNode)
      , $parent = $focus.parent()
      , dialog;

    if (!event.keymap) {
      return;
    }

    event.keymap.replace('~', '^');

    if (app.current_dialogs.length) {
      // Modal Dialog
      if (event.keymap == 'Escape') {
        dialog = app.current_dialogs.pop();
        dialog.close();
        $(dialog).remove();
      }
    } else if (app.game.is_editing && _.has(app.hotkeys.edit, event.keymap)) {
      // Edit Mode
      app.hotkeys.edit[event.keymap](event, $focus, $parent);
    } else if (!app.game.is_editing && _.has(app.hotkeys.play, event.keymap)) {
      // Play Mode
      app.hotkeys.play[event.keymap](event, $focus, $parent);
    } else if (_.has(app.hotkeys.global, event.keymap)) {
      // Global
      app.hotkeys.global[event.keymap](event, $focus, $parent);
    }
  });

});
