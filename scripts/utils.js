#!/usr/bin/env node
const utils = (function () {

    var fs = require('fs');
    var shell = require('shelljs');
    var colorsLog;
    return {

        init: function (ctx) {
            colorsLog = require('./log')(ctx);
        },
        exists: function (filePath) {

            try {
                fs.statSync(filePath);
                return true;
            } catch (e) {

                return false;
            }
        },

        isDirectory: function (filePath) {

            try {
                return fs.statSync(filePath).isDirectory();
            } catch (e) {

                return false;
            }
        },

        isFile: function (filePath) {

            try {
                return fs.statSync(filePath).isFile();
            } catch (e) {

                return false;
            }
        },

        execSync: function execSync(cmd) {

            if (shell.exec(cmd).code !== 0) {

                colorsLog.error(`sync exec cmd error：${cmd}`);
                exit(1);
            }
        },
        copySync: function (src, dst, copyAllFiles) {

            //拷贝src目录下所有文件到dst目录
            if (copyAllFiles) {
                this.execSync(`cp -R ${src}/. ${dst}`);
            } else {

                //拷贝src目录到dst目录
                this.execSync(`cp -R ${src} ${dst}`);
            }
        },

        //全局替换，在特定字符前添加转义字符\
        regExpEscape: function (literal_string) {
            return literal_string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&');
        },

        //给value 添加双引号
        quoteEscape: function (value) {
            return '"' + value + '"';
        },

        onlyUnique: function (value, index, self) {
            return self.indexOf(value) === index;
        },

        keyBy: function (arr, fn) {
            var result = {};
            arr.forEach(function (v) {
                result[fn(v)] = v;
            });
            return result;
        },

        //return end
    };

})();

module.exports = function (ctx) {

    utils.init(ctx);
    return utils;
};
