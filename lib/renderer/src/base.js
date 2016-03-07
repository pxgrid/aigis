var ejs = require('ejs');
var fs = require('fs-extra');
var path = require('path');
var _ = require('lodash');
var Moment = require('moment');
var AigisTemplateHelper = require('aigis-template-helper');
var AigisMarked = require('aigis-marked');
var marked = require('marked');
var util = require('util');
var assign = require('object-assign');

var Renderer = (function() {
  function Renderer(modules, options) {
    this.options = options;
    this.modules = modules;
    this.initialize();
  }

  assign(Renderer.prototype, {
    initialize: function() {
      this.timestamp = this._getTimestamp();
      this.layoutTemplate = this._loadTemplate('layout');
      this.indexTemplate = this._loadTemplate('index');
      this.helper = new AigisTemplateHelper(this.options);
      this.markedRenderer = new AigisMarked(this.options);
    },

    render: function() {
      var collection = {};
      _.each(this.options.output_collection, function(type) {
        collection[type] = this._categorizeByType(type);
      }, this);

      var pages = _.map(_.keys(collection), function(type) {
        return this._renderCollection(collection[type], type);
      }, this);

      pages = _.flatten(pages);
      pages.push(this._renderIndex());
      if (this.options.color_palette) {
        pages.push(this._renderColors());
      }
      return pages;
    },

    _renderPage: function(params) {
      var type = params.type, name = params.name || '', modules = params.modules || [], html = params.html || '';
      var title = params.title || name;
      var fileName = params.fileName || 'index.html';
      var template = params.isIndex ? this.indexTemplate : this.layoutTemplate;
      var outputPath = path.join(this.options.dest, type, name, fileName);
      var root = params.isIndex ? './' : this._getRoot(outputPath);
      var dir = this.options.template_dir;

      this.helper.setProperty({
        collection: this.options.collection,
        root: root
      });

      var page = template({
        modules: modules,
        html: html,
        config: this.options,
        timestamp: this.timestamp,
        title: title,
        root: root,
        helper: this.helper,
        outputPath: outputPath,
        dir: dir
      });

      return {
        html: page,
        outputPath: outputPath
      }
    },

    _renderIndex: function() {
      var md = '', html = '';
      if(this.options.index) {
        md = fs.readFileSync(this.options.index, 'utf-8');
        html = marked(md, {renderer: this.markedRenderer});
      }
      var page = this._renderPage({
        title: 'index',
        type: '',
        html: html,
        isIndex: true,
        fileName: 'index.html'
      });
      return page;
    },

    _renderColors: function() {
      var html = '';
      var partial =
        '<div class="aigis-colorPalette">' +
          '<div class="aigis-colorPalette__color" style="background-color: %s;"></div>' +
          '<div class="aigis-colorPalette__label">%s</div>' +
        '</div>';

      var html = _.map(this.options.colors, function(color) {
        return util.format(partial, color, color);
      }).join('\n');

      var page = this._renderPage({
        title: 'colors',
        type: '',
        html: html,
        isIndex: true,
        fileName: 'color.html'
      });
      return page;
    },

    _renderCollection: function(categorizedModules, type) {
      var pages = _.map(categorizedModules, function(modules, name) {
        return this._renderPage({
          modules: modules,
          name: name,
          type: type,
        });
      }, this);
      return pages;
    },

    _loadTemplate: function(fileName) {
      var ext = this.options.template_ext[this.options.template_engine];
      var filePath = path.join(this.options.template_dir, fileName + ext);
      try {
        var template = fs.readFileSync(filePath, 'utf-8');
        return ejs.compile(template, {filename: filePath});
      }
      catch(e) {
        throw new Error(e);
      }
    },

    /*
    * @method _categorizeByType
    *
    * categorize modules by output_collection option
    * */
    _categorizeByType: function(type) {
      var categorizedModules = {};
      _.each(this.options.collection[type], function(name) {
        categorizedModules[name] = [];
      });
      _.each(this.modules, function(module) {
        if (_.isUndefined(module.config[type])) return;
        var category;
        if (_.isArray(module.config[type])) {
          category = module.config[type];
        }
        else {
          category = [module.config[type]]
        }
        _.each(category, function(name) {
          categorizedModules[name].push(module);
        });
      });

      return categorizedModules;
    },

    _getRoot: function(outputPath) {
      var level = _.compact(outputPath
          .replace(path.normalize(this.options.dest + '/'), '')
          .replace('index.html', '')
          .split('/')
      ).length;
      var root = '';
      if (level === 0) {
        return './';
      }

      for(var i = 0; i < level; i++) {
        root += '../';
      }

      return root;
    },

    _getTimestamp: function() {
      return Moment().format(this.options.timestamp_format);
    }

  });

  return Renderer;
})();

module.exports = Renderer;