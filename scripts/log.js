#!/usr/bin/env node

const colorsLog = (function(){

    require('colors');
    var context;
    function prefixMsg(msg,obj = Object){

        //object to string
        var detailMsg = msg;
        if(typeof(msg) == 'object'){
            detailMsg = JSON.stringify(msg, null, 2);
        }
        if(typeof(obj) == 'object' && obj != undefined){
            detailMsg += JSON.stringify(obj, null, 2);
        }
        return `${context.opts.plugin.id}: ${detailMsg}`;
    }
    return {
        init: function(ctx){

            context = ctx;
        },
        log: function(msg,obj = Object){
            msg = prefixMsg(msg,obj);
            console.log(msg.black);
        },
        info: function(msg,obj = Object){

            msg = prefixMsg(msg,obj);
            console.log(msg.green);
        },
        warn: function(msg,obj = Object){
            msg = prefixMsg(msg,obj);
            console.log(msg.yellow);
        },
        error: function(msg,obj = Object){
            msg = prefixMsg(msg,obj);
            console.log(msg.red);
        }
    };
})();


module.exports = function(ctx){

    colorsLog.init(ctx);
    return colorsLog;
};