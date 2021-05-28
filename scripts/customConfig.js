#!/usr/bin/env node

const { fail } = require('assert');

var path, cwd;

var fs,
    _,
    plist;

var colorsLog, utils, parser, pbxproj, xcconfig, plists;
var rootdir, projectName, iosPlatformPath;

//获取所有自定义配置
function getCustomConfigsFromConfigXml() {

    var configData = {};
    //build settings using <custom-preference> elements
    getiOSPreferences(configData);
    //the project plist (*-Info.plist) using <custom-config-file> blocks
    getConfigFiles(configData);
    return configData;
}



/**
 * 解析config.xml获取所有自定义配置, 更新指定配置
 */
function updateiOSPlatformConfig() {

    var projectPath = path.join(iosPlatformPath, projectName);
    var configData = getCustomConfigsFromConfigXml();
    colorsLog.info(`Get All custom config：`, configData);
    _.each(configData, function (configItems, targetName) {

        var targetFilePath;
        if (targetName === "project.pbxproj") {

            targetFilePath = path.join(iosPlatformPath, projectName + '.xcodeproj', targetName);
            pbxproj.updateIosPbxProj(targetFilePath, configItems);
            xcconfig.updateXCConfigs(iosPlatformPath, configItems);

        } else if (targetName.indexOf("Info.plist") > -1) {

            targetName = projectName + '-Info.plist';
            targetFilePath = path.join(projectPath, targetName);
            plists.updateIosPlist(targetFilePath, configItems);

        } else if (targetName.indexOf("Entitlements-Release.plist") > -1 ||
            targetName.indexOf("Entitlements-Debug.plist") > -1) {

            targetFilePath = path.join(projectPath, targetName);
            plists.updateIosPlist(targetFilePath, configItems);
        }
        else if (targetName.indexOf("app_icon") > -1) {

            targetName = projectName + '-Info.plist';
            targetFilePath = path.join(iosPlatformPath, projectName, targetName);
            //动态设置app icon图标
            updateAlternateIcon(targetFilePath, configItems);
        }
    });

    // 解决如果插件中有引入cocoapods，cocoapods插件添加后会马上生成一个Pod plist文件，
    //当在插件中用<config-file>节点准备往plist中写入信息时，会写到Pod目录下的plist中，
    // 需要拷贝Pod目录下的plist信息到plist
    copyPodPlistToTargetPlist();
}



/**
 * 获取iOS 偏好设置 写入 project.pbxproj
  {
    "_id": 149,
    "tag": "custom-preference",
    "attrib": {
      "buildType": "debug",
      "mode": "merge",
      "name": "XCBuildConfiguration-GCC_PREPROCESSOR_DEFINITIONS",
      "value": "\"DEBUG=1\"",
      "xcconfigEnforce": "true"
    }
  }
 */
function getiOSPreferences(configData) {

    var preferences = parser.getChildElements('preference');
    _.each(preferences, function (preference) {

        var attrib = preference.attrib;
        var attribNameParts = attrib.name.split("-");
        var target = "project.pbxproj";
        var prefModel = {
            type: attribNameParts[0],
            name: attribNameParts[1],
            value: attrib.value,
            mode: attrib.mode
        };
        //quote:给key或者value添加双引号
        if (attrib.quote) {
            prefModel["quote"] = attrib.quote;
        } else {
            prefModel["quote"] = "none";
        }
        if(attrib.buildType){
            prefModel["buildType"] = attrib.buildType;
        }
        if (!configData[target]) {
            configData[target] = [];
        }
        if (attrib.func) {

            parseiOSXcodeFunc(prefModel, preference, configData, target);
        } else {

            prefModel["xcconfigEnforce"] = preference.attrib.xcconfigEnforce ? preference.attrib.xcconfigEnforce : null;
            configData[target].push(prefModel);
        }
    });
}

//e.g:func="addResourceFile",目前仅支持addResourceFile
function parseiOSXcodeFunc(prefModel, preference, configData, target) {

    prefModel["func"] = preference.attrib.func;
    prefModel["args"] = [];
    _.each(preference.getchildren(), function (arg) {

        if (arg.tag === "arg") {

            //value是与platforms同级的相对路径
            var relativePath = String(arg.attrib.value);
            var originPath = path.join(rootdir, relativePath);
            if (utils.exists(originPath)) {

                //如果是目录，遍历目录内容
                if (utils.isDirectory(originPath)) {

                    var fileList = fs.readdirSync(originPath);
                    _.each(fileList, function (aFile) {

                        var name = aFile.split('.')[0];
                        if (name != "") {
                            console.log(`遍历目录找到文件：${aFile}`);
                            var aFilePath = path.join(originPath, aFile);
                            getXcodeFuncModel(arg, prefModel, aFilePath, configData, target);
                        }
                    });
                } else {
                    getXcodeFuncModel(arg, prefModel, originPath, configData, target);
                }

            }

        }
    });
}

/**
* xcodefunc model结构
{
    "type": "xcodefunc",
    "func": "addResourceFile",
    "args": [
         "Resources/icon-60@3x.png"
    ]
}
*/
function getXcodeFuncModel(arg, prefModel, aFilePath, configData, target) {

    var filename = path.basename(aFilePath);
    var targetResourcesPath = path.join(iosPlatformPath, projectName, "Resources");
    var addPrefFuncModel = {
        type: prefModel.type,
        func: prefModel.func,
        args: []
    };
    addPrefFuncModel["args"].push(path.join("Resources", filename));
    configData[target].push(addPrefFuncModel);

    /**
    通过hook将图片添加进工程中的步骤：
    1、将图片拷贝至platforms/ios/projectName/Resources
    2、将图片添加引用addReference (pbxproj.js中添加引用)
    */
    // var readStream = fs.createReadStream(aFilePath);
    // var writeStream = fs.createWriteStream(path.join(targetResourcesPath, filename));
    // readStream.pipe(writeStream);
    utils.copySync(aFilePath,targetResourcesPath);

    //动态更改角标时用到
    var isAppIcon = arg.attrib.type == "appIcon" ? true : false;
    var iconTarget = "app_icon";
    if (isAppIcon) {

        if (!configData[iconTarget]) {
            configData[iconTarget] = [];
        }
        configData[iconTarget].push(filename);
    }
}

/**
* Retrieves the config.xml's config-file elements for a given platform and parses them into JSON data
*/
function getConfigFiles(configData) {
    var configFiles = getConfigFilesByTargetAndParent(),
        type = 'configFile';
    _.each(configFiles, function (configFile, key) {
        var keyParts = key.split('|');
        var target = keyParts[0];
        var parent = keyParts[1];
        var mode = keyParts[2];
        var split = keyParts[3];
        var items = configData[target] || [];

        var children = configFile.getchildren();
        if (children.length > 0) {
            _.each(children, function (element) {
                items.push({
                    parent: parent,
                    type: type,
                    destination: element.tag,
                    data: element,
                    mode: mode,
                    split: split
                });
            });
        } else {
            items.push({
                parent: parent,
                type: type,
                mode: mode
            });
        }
        configData[target] = items;
    });
}


function getConfigFilesByTargetAndParent() {

    //从staging下的config.xml中获取所有的<custom-config-file>
    var configFileData = parser.getChildElements('config-file');
    var num = 1;
    var result = utils.keyBy(configFileData, function (item) {
        var parent = item.attrib.parent;
        var mode, split;
        if (item.attrib.mode) {
            mode = item.attrib.mode;
        }
        if (item.attrib.split) {
            split = item.attrib.split;
        }
        //if parent attribute is undefined /* or */, set parent to top level elementree selector
        if (!parent || parent === '/*' || parent === '*/') {
            parent = './';
        }
        num++;
        return item.attrib.target + '|' + parent + '|' + mode + '|' + split + '|' + num;
    });
    return result;
}

function copyPodPlistToTargetPlist() {

    var targetInfoPlistPath = path.join(iosPlatformPath, projectName, projectName + '-Info.plist');
    var podInfoPlistPath = path.join(iosPlatformPath, "Pods/Target Support Files/Pods-" + projectName, 'Pods-' + projectName + '-Info.plist');
    if (!utils.exists(podInfoPlistPath)) {

        // colorsLog.warn('***********Pod Info plist 文件不存在***********');
        return;
    }
    var infoPlist = plist.parse(fs.readFileSync(targetInfoPlistPath, 'utf-8'));
    var podInfoPlist = plist.parse(fs.readFileSync(podInfoPlistPath, 'utf-8'));
    _.each(podInfoPlist, function (value, key) {

        if (key != "CFBundleDevelopmentRegion" &&
            key != "CFBundleExecutable" &&
            key != "CFBundleIdentifier" &&
            key != "CFBundleInfoDictionaryVersion" &&
            key != "CFBundleName" &&
            key != "CFBundlePackageType" &&
            key != "CFBundleShortVersionString" &&
            key != "CFBundleSignature" &&
            key != "CFBundleVersion" &&
            key != "NSPrincipalClass" && value != null && value != undefined && value != "") {
            infoPlist[key] = value;
        }
    });
    var tempInfoPlist = plist.build(infoPlist);
    tempInfoPlist = tempInfoPlist.replace(/<string>[\s\r\n]*<\/string>/g, '<string></string>');
    fs.writeFileSync(targetInfoPlistPath, tempInfoPlist, 'utf-8');
}

function updateAlternateIcon(targetFilePath, configItems) {

    var infoPlist = plist.parse(fs.readFileSync(targetFilePath, 'utf-8'));
    var icons = {};
    var bundleIcons = {};
    _.each(configItems, function (iconName) {

        var icon = {};
        var ext = path.extname(iconName);
        var name = path.basename(iconName, ext);
        name = name.split("@")[0];
        if (icons[name] == undefined) {

            icon["UIPrerenderedIcon"] = "NO";
            icon["CFBundleIconFiles"] = [name];
            icons[name] = icon;
        }
    });
    bundleIcons["CFBundleAlternateIcons"] = icons;
    infoPlist["CFBundleIcons"] = bundleIcons;
    var tempInfoPlist = plist.build(infoPlist);
    tempInfoPlist = tempInfoPlist.replace(/<string>[\s\r\n]*<\/string>/g, '<string></string>');
    fs.writeFileSync(targetFilePath, tempInfoPlist, 'utf-8');
    colorsLog.info(`dynamic change app icon with :`, icons);
}


function init(ctx) {

    var context = ctx;
    cwd = path.resolve();
    rootdir = context.opts.projectRoot;
    plugindir = path.join(cwd, 'plugins', context.opts.plugin.id);
    iosPlatformPath = path.join(rootdir, 'platforms/ios');

    projectName = parser.getProjectName();
    updateiOSPlatformConfig();
}

function loadDependencies() {

    // npm dependencies
    path = require('path');
    fs = require('fs'),
        _ = require('lodash'),
        // et = require('elementtree'),
        plist = require('plist');
    // xcode = require('xcode'),
    // exec = require('child_process').exec,
    // os = require('os');
}

module.exports = function (ctx) {

    colorsLog = require('./log')(ctx);
    utils = require('./utils')(ctx);
    parser = require('./parser')(ctx);
    pbxproj = require('./pbxproj')(ctx);
    xcconfig = require('./xcconfig')(ctx);
    plists = require('./plists')(ctx);

    if (ctx.opts.cordova.platforms[0].indexOf('ios') < 0) {

        colorsLog.warn("This plugin is currently only available for iOS");
        return;
    }
    //添加npm依赖
    loadDependencies();
    init(ctx);
};


