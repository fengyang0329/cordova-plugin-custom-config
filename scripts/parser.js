#!/usr/bin/env node


const parser = (function () {

    var context;
    var fs = require('fs');
    var path = require('path');
    var _ = require('lodash');
    var et = require('elementtree');

    var colorsLog;
    var configXmlElements, stagingConfigXmlElements;
    return {

        init: function (ctx) {

            context = ctx;
            colorsLog = require('./log')(context);
            configXmlElements = this.getConfigXmlElements();
            stagingConfigXmlElements = this.getStagingConfigXmlElements();
        },

        /**
         * projectName必须从projectRoot下的config.xml中读取，staging下的config.xml里的name对不上
         */
        getProjectName: function () {

            return configXmlElements.findtext('name');
        },

        /*
         * elementName:'preference','resource','pods'.....
         * 从config.xml元素数组中获取子元素数组
        */
        getChildElements: function (elementName) {

            var elementPrefix = "custom-";
            var path = elementPrefix + elementName;
            var res = stagingConfigXmlElements.findall(path);
            colorsLog.log(`Searching config.xml for prefixed elements: ${path}`);
            return res;
        },

        getConfigXmlElements: function () {

            return this.parseElementtreeSync(path.join(context.opts.projectRoot, 'config.xml'));
        },

        getStagingConfigXmlElements: function () {

            var projectName = this.getProjectName();
            //解析staging下的config.xml,可以很好的兼容plugin.xml里的自定义配置
            var stagingConfigPath = path.join(context.opts.projectRoot, 'platforms/ios', projectName, 'config.xml');
            return this.parseElementtreeSync(stagingConfigPath);
        },

        // Parses a given file into an elementtree object
        parseElementtreeSync: function (filename) {
            var contents = fs.readFileSync(filename, 'utf-8');
            if (contents) {
                //Windows is the BOM. Skip the Byte Order Mark.
                contents = contents.substring(contents.indexOf('<'));
            }
            return new et.ElementTree(et.XML(contents));
        },


        //return end
    };

})();


module.exports = function (ctx) {

    parser.init(ctx);
    return parser;
};
