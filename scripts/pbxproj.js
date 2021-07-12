#!/usr/bin/env node


const pbxproj = (function () {

    var _ = require('lodash');
    var xcode = require('xcode');
    var fs = require('fs');

    var context;
    var utils, colorsLog;
    return {

        init: function (ctx) {

            context = ctx;
            colorsLog = require("./log")(ctx);
            utils = require("./utils")(ctx);
        },

        /**
        * Updates the project.pbxproj file with data from config.xml
        * @param {String} xcodeProjectPath - path to XCode project file
        * @param {Array} configItems - config items to update project file with
        */
        updateIosPbxProj: function (xcodeProjectPath, configItems) {

            var xcodeProject = xcode.project(xcodeProjectPath);
            xcodeProject.parse(function (err) {
                if (err) {
                    var msg = 'An error occurred during parsing of [' + xcodeProjectPath + ']: ' + JSON.stringify(err);
                    colorsLog.error(msg);
                } else {

                    _.each(configItems, function (item) {
                        switch (item.type) {
                            case "XCBuildConfiguration":
                                var buildConfig = xcodeProject.pbxXCBuildConfigurationSection();
                                var replaced = pbxproj.updateXCBuildConfiguration(item, buildConfig, "replace");
                                if (!replaced) {
                                    pbxproj.updateXCBuildConfiguration(item, buildConfig, "add");
                                }
                                break;
                            case "xcodefunc":

                                if (typeof (xcodeProject[item.func]) === "function" && item.args[0] != undefined) {

                                    /**
                                        通过hook将图片添加进工程中的步骤：
                                        1、将图片拷贝至platforms/ios/projectName/Resources （customConfig.js getXcodeFuncModel中移动图片）
                                        2、将图片添加引用addReference
                                    */
                                    //添加引用
                                    xcodeProject["removeResourceFile"].apply(xcodeProject, item.args);
                                    xcodeProject[item.func].apply(xcodeProject, item.args);
                                }
                                break;
                        }
                    });
                    fs.writeFileSync(xcodeProjectPath, xcodeProject.writeSync(), 'utf-8');
                    colorsLog.log("Wrote file " + xcodeProjectPath);
                }
            });
        },


        /**
         * Updates an XCode build configuration setting with the given item.
         * @param {Object} item - configuration item containing setting data
         * @param {Object} buildConfig - XCode build config object
         * @param {String} mode - update mode: "replace" to replace only existing keys or "add" to add a new key to every block
         * @returns {boolean} true if buildConfig was modified
         */
        updateXCBuildConfiguration: function (item, buildConfig, mode) {

            var modified = false;
            for (var blockName in buildConfig) {

                var block = buildConfig[blockName];
                if (typeof (block) !== "object" || !(block["buildSettings"])) continue;
                //判断buildSettings中是否有相同name,结果强转成bool
                var literalMatch = !!block["buildSettings"][item.name];
                //name添加双引号，判断buildSettings中是否有相同"name",结果强转成bool
                var quotedMatch = !!block["buildSettings"][utils.quoteEscape(item.name)];
                var match = literalMatch || quotedMatch;
                //buildType : debug or release
                var blockName = block['name'].toLowerCase();
                //判断构建模式是否相同
                var sameBuildType = false;
                if(item.buildType){
                    sameBuildType = item.buildType.toLowerCase() === blockName;
                }else if(blockName == "debug" || blockName == "release"){
                    //不指定类型，则debug和relese都添加
                    sameBuildType = true;
                }
                if ((match || mode === "add") && sameBuildType) {

                    var name;
                    if (match) {
                        name = literalMatch ? item.name : quoteEscape(item.name);
                    } else {
                        /**
                         quote : 
                                none : key 和 value都不会添加双引号；默认为none;
                                表现为：GCC_NEW_KEY = 10.0
                                key : 只对key添加双引号；
                                表现为："GCC_NEW_KEY" = 10.0
                                value : 只对value添加双引号；
                                表现为：GCC_NEW_KEY = "10.0"
                                both : key和value都添加双引号；
                                表现为："GCC_NEW_KEY" = "10.0"
                         */
                        name = (item.quote && (item.quote === "none" || item.quote === "value")) ? item.name : utils.quoteEscape(item.name);
                    }
                    var value = (item.quote && (item.quote === "none" || item.quote === "key")) ? item.value : utils.quoteEscape(item.value);
                    var updateMode = item.mode;
                    modified = true;
                    /**
                    * 数组多选类型时，merge会将value追加到数组末尾，否则会直接覆盖替换 
                    例如：GCC_PREPROCESSOR_DEFINITIONS = DEBUG=1
                    追加value="DEFINITIONS_TEST"后变成：GCC_PREPROCESSOR_DEFINITIONS = DEBUG=1 DEFINITIONS_TES
                    */
                    if (updateMode == "merge") {

                        var settings = block["buildSettings"][name];
                        if (Array.isArray(settings) && (settings.includes(item.value) || settings.includes(utils.quoteEscape(item.value)))) {

                            colorsLog.warn(`XCBuildConfiguration ${name} = ${settings}，已经存在${value}，不需要重复添加!`);
                            continue;
                        }
                        var valuesArray = new Array(value);
                        if (block["buildSettings"][name] != undefined) {
                            valuesArray = valuesArray.concat(block["buildSettings"][name]);
                        }
                        block["buildSettings"][name] = valuesArray;
                    } else {
                        block["buildSettings"][name] = value;
                    }
                    colorsLog.log(`${mode} XCBuildConfiguration key=${name} to value=${value} for build type ${block['name']} in block ${blockName}`);
                }
            }
            return modified;
        }


        //return end
    };

})();

module.exports = function (ctx) {

    pbxproj.init(ctx);
    return pbxproj;
};