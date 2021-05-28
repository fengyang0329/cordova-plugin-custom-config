# cordova-plugin-custom-config
根据plugin.xml或者config.xml中定义的自定义配置更新平台配置

## 背景
因**Cordova**官方参数配置并不能满足所有场景，导致现有项目中大量插件都需要通过hook去修改xcode配置满足特定场景，代码管理非常混乱，想通过一个专属插件去做专业的事，其他插件只要引入这个插件，在**plugin.xml**或c**onfig.xml**中声明对应的配置参数即可。

## 注意事项

1. **hoook**执行时机是**after_prepare**;
2. 以`custom-`前缀标识这是一个自定义配置 ;
3. 如果是在`config.xml`中声明自定义配置，自定义配置应该写在**platform ios**节点内；
4. 如果是在`plugin.xml`中声明自定义配置，需要将自定义配置写在`<config-file parent="/*" target="config.xml">`节点下，因为写在此节点内的内容会被**Cordova**拷贝到**staging**目录下的**config.xml**文件中；
5. 插件会解析**staging**目录下的**config.xml**,获取所有自定义配置。

在插件plugin.xml中声明自定义配置：

```
<platform name="ios">
		 //这个节点至关重要
        <config-file parent="/*" target="config.xml">
            <custom-preference name="XCBuildConfiguration-GCC_PREPROCESSOR_DEFINITIONS" value="defini_test" buildType="debug" mode="merge" xcconfigEnforce="true"/>
        </config-file>
</platform>

```

在config.xml中声明自定义配置：

```
<?xml version='1.0' encoding='utf-8'?>
<widget id="com.mycompany.myteam.myapp" version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>MyApp</name>
    <content src="index.html" />
    <access origin="*" />
        
    //平台特性建议放在platform: ios节点内，当然放在platform外面也行，但不建议
    <platform name="ios">
          <custom-preference name="XCBuildConfiguration-GCC_PREPROCESSOR_DEFINITIONS" value="defini_test" buildType="debug" mode="merge" xcconfigEnforce="true"/>
    </platform>
      ... 
 </widget>
```

plugin.xml和config.xml中声明的自定义配置，最终会被Cordova拷贝到到Staging目录下的config.xml：

```
<?xml version='1.0' encoding='utf-8'?>
<widget id="com.mycompany.myteam.myapp" version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>MyApp</name>
    <content src="index.html" />
    <access origin="*" />
        
    //对应plugin.xml中的内容，或直接在config.xml中声明自定义配置
    <custom-preference name="XCBuildConfiguration-GCC_PREPROCESSOR_DEFINITIONS" value="defini_test" buildType="debug" mode="merge" xcconfigEnforce="true"/>
     
     ... 
 </widget>
```

## 安装使用

```
cordova plugin add cordova-plugin-custom-config
or 
插件依赖的方式：
<dependency id="cordova-plugin-custom-config"/>
```

## 用法
1. [使用`<custom-preference>`修改build settings](#custom-preference)
	* 可修改**project.pbxproj**
	* 可修改**.xcconfig**
	* 可给工程添加图片
	* 可动态修改app图标

2. [使用`custom-config-file`修改项目plist(*-Info.plist、Entitlements-*.plist)](#custom-config-file)

5. [调用示例](#调用示例)


### <a name="custom-preference"></a>使用`<custom-preference>`修改build settings

#### XCBuildConfiguration
* `XCBuildConfiguration `是`<custom-preference>`目前唯一支持的块类型，用于修改`platforms/ios/{PROJECT_NAME}/{PROJECT_NAME}.xcodeproj/project.pbxproj`；

* `<custom-preference>`元素属性`name`必须以`XCBuildConfiguration-`作为前缀；<br>例如： `<custom-preference name="XCBuildConfiguration-IPHONEOS_DEPLOYMENT_TARGET" value="7.0"/>`

* 如果在`XCBuildConfiguration`块中指定的键值没有存在，则会新增一个

* 如果在`XCBuildConfiguration`块中指定的键值已经存在，则会直接覆盖；

* 当`Build Settings`中键值的value是`Multiple values`这种多选类型时，可通过在`<custom-preference>`元素上添加属性`mode="merge"`，不会直接覆盖，会追加一个新值进数组末尾；

* 可通过在`<custom-preference>`元素上添加属性`quote`给键值和value添加双引号`""`；键值key=`GCC_NEW_KEY`,value=`10.0`,在 `project.pbxproj`中的表现如下：
	* quote可选值：
		* none :  key 和 value都不会添加双引号；默认为none;<br>表现为：`GCC_NEW_KEY = 10.0`
		* key : 只对key添加双引号；<br>表现为：`"GCC_NEW_KEY" = 10.0`
		* value : 只对value添加双引号；<br>表现为：`GCC_NEW_KEY = "10.0"`
		* both : key和value都添加双引号；<br>表现为：`"GCC_NEW_KEY" = "10.0"`

* 默认，会同时作用于`debug`与`release`构建模式，可通过`<custom-preference>`元素属性`buildType`指定构建模式；例如：
	* `<custom-preference name="XCBuildConfiguration-IPHONEOS_DEPLOYMENT_TARGET" value="7.0" buildType="release" />`

#### .xcconfig 

* Cordova 通过`/platforms/ios/cordova/`目录下的`.xcconfig`文件覆盖Xcode项目`project.pbxproj`里的设置；
	* `build.xcconfig`里的设置会在对应的构建模式下被`build-debug.xcconfig`和 `build-release.xcconfig`里的配置覆盖；

* 如果`buildType`为`"debug"`或者`"realease"`,插件将分别在`build-debug.xcconfig`或`build-release.xcconfig`查找；

* 如果`buildType`没有指定，或设置成`none`,插件将会在`build.xcconfig`中查找对应配置参数；

* 如果在对应的`.xcconfig`文件中找到了与Staging虚拟目录下`config.xml`中`<custom-preference>`属性`name`对应的键值，其value将会被属性`name`里的`value`替代；

* 如果`<custom-preference>`属性`name`键值在对应的`.xcconfig`文件中没有找到，可通过`xcconfigEnforce="true"`元素进行新增；

* 当`.xcconfig`中键值的value是`Multiple values`这种多选类型时，可通过在`<custom-preference>`元素上添加属性`mode="merge"`，不会直接覆盖，会追加一个新值进末尾；
	* 例如：`GCC_PREPROCESSOR_DEFINITIONS = DEBUG=1`
	* 追加`value="DEFINITIONS_TEST"`后变成：`GCC_PREPROCESSOR_DEFINITIONS = DEBUG=1 DEFINITIONS_TES`


#### xcodefunc

* 目前仅支持`addResourceFile `，后续会根据需要丰富更多的功能；

* 函数参数应该使用<arg />子元素指定。它支持以下属性:
	* value :  文件或者文件目录路径，文件后缀名仅支持`.jpg .png`,如：`resource/ios/appicon/image.png` or `resource/ios/appicon`
	* type : 类型，目前仅支持`appIcon`:将图片添加进项目并引用的同时，将图片名写入`info.plist.CFBundleIcons`中，可直接调用图片名动态设置App角标.

```
	//代码更改角标，iconName就是通过type=appIcon传入的图片名字
	NSString *iconName = @"newIcon";
    if ([[UIApplication sharedApplication] respondsToSelector:@selector(supportsAlternateIcons)] &&
        [[UIApplication sharedApplication] supportsAlternateIcons])
    {
        NSMutableString *selectorString = [[NSMutableString alloc] initWithCapacity:40];
        [selectorString appendString:@"_setAlternate"];
        [selectorString appendString:@"IconName:"];
        [selectorString appendString:@"completionHandler:"];
        
        //这种方式不会出现提示框
        SEL selector = NSSelectorFromString(selectorString);
        IMP imp = [[UIApplication sharedApplication] methodForSelector:selector];
        void (*func)(id, SEL, id, id) = (void *)imp;
        if (func)
        {
            func([UIApplication sharedApplication], selector, iconName, ^(NSError * _Nullable error) {
                
                if (error) {
                    NSLog(@"更换app图标发生错误了 ： %@",error);
                }
            });
        }
    }

```

### <a name="custom-config-file"></a>使用`<custom-config-file>`plist(*-Info.plist、Entitlements-*.plist)

* 可通过指定**target**修改相应plist文件里的内容。
* **parent**对应**plist**文件里**key**；
* 属性 ： `mode`,可选参数：`replace`,`delete`；
	* 当想删除某个键值的时候，可通过`mode="delete"`实现。
	* 如果原有**plist**中键值**key**不存在，则直接添加；
	* 如果原有**plist**中键值**key**对应的**value**是字符串类型，传入的**value**会直接替换原有的；
	* 如果原有**plist**中键值**key**对应的**value**是数组类型：
		* 如果传入的**value**为字符串类型， 会直接将原有的**value**替换掉
		* 如果传入的**value**为数组类型，传入的值会添加进原有的数组中，并过滤掉相同内容；
		* 如果传入的**value**为数组类型，可通过`mode="replace"`直接替换掉已存在**value**；
		* 如果传入的**value**为数组类型，可通过**split**属性，将数组里的元素字符串分割成字符串数组，并将字符串数组重新赋值给**value**，例如：
		
		```
		//会将数组内的内容a_domains,b_domains按照,分割成a_domains b_domains
		<custom-config-file parent="com.apple.developer.associated-domains" split="," target="Entitlements-Debug.plist">
    		<array>
        			<string>a_domains,b_domains</string>
   		   </array>
		</custom-config-file>
		```

调用示例:

```

<custom-config-file parent="com.apple.developer.associated-domains" split="," target="Entitlements-Debug.plist">
    <array>
        <string>a_domains,b_domains</string>
    </array>
</custom-config-file>

<custom-config-file parent="appKey" target="*-Info.plist">
     <array>
        <string>123</string>
        <string>456</string>
    </array>
</custom-config-file>

<custom-config-file parent="appKey" target="*-Info.plist">
    <string>123</string>
</custom-config-file>

<custom-config-file parent="appKey" mode="delete" target="*-Info.plist">
    <string>123</string>
</custom-config-file>

<custom-config-file parent="CFBundleURLTypes" target="*-Info.plist">
    <array>
        <dict>
            <key>CFBundleTypeRole</key>
            <string>Editor</string>
            <key>CFBundleURLName</key>
            <string>MCustomUri</string>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>test</string>
            </array>
        </dict>
    </array>
</custom-config-file>

```


#### <a name="调用示例"></a>调用示例

plugin.xml

```

//target="config.xml"至关重要
<config-file parent="/*" target="config.xml">
    <custom-preference name="XCBuildConfiguration-IPHONEOS_DEPLOYMENT_TARGET" value="7.0"  />
</config-file>

<config-file parent="/*" target="config.xml">

    <custom-preference name="XCBuildConfiguration-IPHONEOS_DEPLOYMENT_TARGET" value="7.0" buildType="release" />
    <custom-preference name="XCBuildConfiguration-GCC_PREPROCESSOR_DEFINITIONS" value="DEFINITIONS_TES" buildType="debug" mode="merge" xcconfigEnforce="true" />

    //resource目录与platforms同级，将resource/ios/appicon文件夹里所有图片添加进工程并添加引用
    <custom-preference func="addResourceFile" name="xcodefunc">
        <arg value="resource/ios/appicon" />
    </custom-preference>

    //resource目录与platforms同级，将resource/ios/appicon/image.png图片添加进工程并添加引用
    <custom-preference func="addResourceFile" name="xcodefunc">
        <arg value="resource/ios/appicon/image.png" />
    </custom-preference>

	//type="appIcon" 会自动将图片添加进工程，并且修改plist配置，原生代码设置图标的时候，直接取图片名就行了
    <custom-preference func="addResourceFile" name="xcodefunc">
        <arg type="appIcon" value="resource/ios/appicon"/>
    </custom-preference>
</config-file>

```


config.xml

```

<?xml version='1.0' encoding='utf-8'?>
<widget id="com.mycompany.myteam.myapp" version="1.0.0" xmlns="http://www.w3.org/ns/widgets" xmlns:cdv="http://cordova.apache.org/ns/1.0">
    <name>MyApp</name>
    <content src="index.html" />
    <access origin="*" />
    
    //平台特性建议放在platform: ios节点内，当然放在platform外面也行，但不建议
    <platform name="ios">
    
        <custom-preference name="XCBuildConfiguration-IPHONEOS_DEPLOYMENT_TARGET" value="7.0" />
        <custom-preference name="XCBuildConfiguration-GCC_PREPROCESSOR_DEFINITIONS" value="DEFINITIONS_TES" buildType="debug" mode="merge" quote="value" />
        
        //resource目录与platforms同级，将resource/ios/appicon文件夹里所有图片添加进工程并添加引用
        <custom-preference func="addResourceFile" name="xcodefunc">
            <arg value="resource/ios/appicon" />
        </custom-preference>
        
        //resource目录与platforms同级，将resource/ios/appicon/image.png图片添加进工程并添加引用
        <custom-preference func="addResourceFile" name="xcodefunc">
            <arg value="resource/ios/appicon/image.png" />
        </custom-preference>
        
        //type="appIcon" 会自动将图片添加进工程，并且修改plist配置，原生代码设置图标的时候，直接取图片名就行了
        <custom-preference func="addResourceFile" name="xcodefunc">
            <arg type="appIcon" value="resource/ios/appicon"/>
        </custom-preference>
        
    </platform>
    
    ...
</widget>
 

```



