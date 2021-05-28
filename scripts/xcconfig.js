#!/usr/bin/env node

const xcconfig = (function () {

    var xcconfigs = ["build.xcconfig", "build-debug.xcconfig", "build-release.xcconfig"];

    var fs = require('fs');
    var path = require('path');
    var _ = require('lodash');
    var colorsLog, utils;
    return {

        init: function (ctx) {
            colorsLog = require('./log')(ctx);
            utils = require("./utils")(ctx);
        },
        updateXCConfigs: function (platformPath, configItems) {

            xcconfigs.forEach(function (fileName) {
                xcconfig.updateXCConfig(platformPath, fileName, configItems);
            });
        },

        /**
         * configItems 结构：
         [
            {
                "type": "XCBuildConfiguration",
                 "name": "GCC_PREPROCESSOR_DEFINITIONS",
                 "value": "\"DEBUG=1\"",
                 "mode": "merge",
                 "buildType": "debug",
                "quote": "none",
                "xcconfigEnforce": "true"
            },
            ...
        ]
        */
        updateXCConfig: function (platformPath, targetFileName, configItems) {

            var modified = false,
                targetFilePath = path.join(platformPath, 'cordova', targetFileName);

            // Read file contents
            colorsLog.log("Reading " + targetFileName);
            var fileContents = fs.readFileSync(targetFilePath, 'utf-8');
            _.each(configItems, function (item) {
                // some keys have name===undefined; ignore these.
                if (item.name) {

                    var escapedName = utils.regExpEscape(item.name);
                    var fileBuildType = "none";
                    if (targetFileName.match("release")) {
                        fileBuildType = "release";
                    } else if (targetFileName.match("debug")) {
                        fileBuildType = "debug";
                    }
                    var itemBuildType = item.buildType ? item.buildType.toLowerCase() : "none";
                    var name = item.name;
                    var value = item.value;
                    var doReplace = function () {

                        /**
                        * 
                        元字符
                        . : 查找单个字符，除了换行和行结束符
                        * : 匹配任何包含零个或多个 n 的字符串
                        ? : 匹配任何包含零个或一个 n 的字符串
                        (): 获取指定内容
                        */
                        var nameRegexp = "\n\"?" + escapedName + "\"?";
                        var res = fileContents.match(nameRegexp);
                        var existName = res? res[0] : null;
                        if (existName != null) {

                            var valueRegexp = `${existName} ?= ?(.*?)\n`;
                            var res = fileContents.match(valueRegexp);
                            var existValue = res ? res[1] : null;
                            //直接替换原有内容
                            var newValue = value;
                            if (item.mode == "merge" && existValue != null) {

                                //已经存在，不需要处理
                                if (existValue.match(value)) {

                                    colorsLog.log(`已经存在:${existName} = ${existValue}，无需继续添加value : ${value}`);
                                    return;
                                }
                                //在原有内容后面追加
                                newValue = existValue + " " + value;
                                colorsLog.log(`${existName} = ${existValue},在原有内容后面追加:${existName} = ${newValue}`);
                            } else {

                                colorsLog.log(`直接替换原有内容，更新后:${existName} = ${newValue}`);
                            }
                            var replaceContent = `\n${existName} = ${newValue}\n`
                            fileContents = fileContents.replace(new RegExp("\n\"?" + escapedName + "\"?.*\n"), replaceContent);
                        } else {

                            //不存在，则直接添加
                            var newValue = "\n" + name + " = " + value;
                            fileContents += newValue;
                        }
                        colorsLog.log("Overwrote " + item.name + " with '" + item.value + "' in " + targetFileName);
                        modified = true;
                    };
                    // If item's target build type matches the xcconfig build type
                    if (itemBuildType === fileBuildType) {
                        //可以用#include包含其他的*.xcconfig配置文件
                        if (item.name.match("#INCLUDE") && !fileContents.match(value)) {
                            fileContents += '\n#include "' + value + '"';
                            modified = true;
                        } else {

                            /**
                             *xcconfigEnforce : 默认false
                                true,如果在.xcconfig文件中查找不到，则强制新增
                                != true,只有查找到，才会替换
                                === 和 !== 只有在相同类型下,才会比较其值
                             */
                            if (fileContents.match(escapedName) && item.xcconfigEnforce !== "false") {
                                
                                doReplace();
                            }else if(item.xcconfigEnforce === "true"){

                                doReplace();
                            }
                        }
                    } 
                }
            });
            if (modified) {
                fs.writeFileSync(targetFilePath, fileContents, 'utf-8');
                colorsLog.log("Overwrote " + targetFileName);
            }

        }
        //return end
    };

})();

module.exports = function (ctx) {

    xcconfig.init(ctx);
    return xcconfig;
};
