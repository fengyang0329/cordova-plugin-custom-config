#!/usr/bin/env node

/**
 -Info.plist 、Entitlements-Release.plist、Entitlements-Debug.plist
 */
const plists = (function () {

    var fs = require('fs');
    var path = require('path');
    var _ = require('lodash');
    var plist = require('plist');
    var colorsLog,utils;
    return {

        init: function (ctx) {
            colorsLog = require('./log')(ctx);
            utils = require('./utils')(ctx);
        },

        // Converts an elementtree object to an xml string.  Since this is used for plist values, we don't care about attributes
        eltreeToXmlString : function (data) {
            var tag = data.tag;
            var el = '<' + tag + '>';

            if (data.text && data.text.trim()) {
                el += data.text.trim();
            } else {
                _.each(data.getchildren(), function (child) {
                    el += plists.eltreeToXmlString(child);
                });
            }
            el += '</' + tag + '>';
            return el;
        },

        /**
         * item结构：
         {
            "parent": "appKey",
            "type": "configFile",
            "destination": "string",
            "data": {
                 "_id": 102,
                 "tag": "string",
                 "attrib": {},
                 "text": "123",
                 "tail": "\n    ",
                 "_children": []
            },
            "mode": "undefined",
            "split": "undefined"
        }
         */
        updateIosPlist: function (targetFilePath, configItems) {
            var infoPlist = plist.parse(fs.readFileSync(targetFilePath, 'utf-8')),
                tempInfoPlist;
            _.each(configItems, function (item) {

                var key = item.parent;
                var plistXml = '<plist><dict><key>' + key + '</key>';
                var value;
                if (item.data) {

                    plistXml += plists.eltreeToXmlString(item.data) + '</dict></plist>';
                    var configPlistObj = plist.parse(plistXml);
                    value = configPlistObj[key];
                    if (!value && item.data.tag === "string") {
                        value = "";
                    }
                }
                /**
                 * 示例：
                    <custom-config-file parent="com.apple.developer.associated-domains" mode="delete" split="," target="Entitlements-Debug.plist">
                        <array>
                            <string>debug_domains,release_domains</string>
                         </array>
                    </custom-config-file>
                 */
                var itemDataTag = item.data.tag;
                if (value.constructor == Array && item.split != null && item.split != undefined && item.split != 'undefined') {

                    var splitValue = [];              
                    _.each(value, function (tmpItem) {

                        if (tmpItem.constructor == String) {

                            var tmp_split = tmpItem.split(item.split);
                            splitValue = splitValue.concat(tmp_split);
                        }
                    });
                    value = splitValue;
                    itemDataTag = "array";
                }
                if (item.mode === 'delete') {
                    delete infoPlist[key];
                } else if (infoPlist[key] && infoPlist[key].constructor == Array && itemDataTag === "array" && item.mode !== 'replace') {

                    infoPlist[key] = infoPlist[key].concat(value).filter(utils.onlyUnique);

                } else {

                    infoPlist[key] = value;
                }
                colorsLog.log("Wrote to plist; key=" + key + "; value=" + infoPlist[key]);
            });
            tempInfoPlist = plist.build(infoPlist);
            //过滤特殊字符
            tempInfoPlist = tempInfoPlist.replace(/<string>[\s\r\n]*<\/string>/g, '<string></string>');
            fs.writeFileSync(targetFilePath, tempInfoPlist, 'utf-8');
            colorsLog.log("Wrote file " + targetFilePath);
        }


        //return end
    };

})();

module.exports = function (ctx) {

    plists.init(ctx);
    return plists;
};
