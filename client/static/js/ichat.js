;(function($) {
    Date.prototype.format = function(format){ //author: meizz
        var o = {
            "M+" : this.getMonth()+1, //month
            "d+" : this.getDate(),    //day
            "h+" : this.getHours(),   //hour
            "m+" : this.getMinutes(), //minute
            "s+" : this.getSeconds(), //second
            "q+" : Math.floor((this.getMonth()+3)/3),  //quarter
            "S" : this.getMilliseconds() //millisecond
        }
        if(/(y+)/.test(format)) format=format.replace(RegExp.$1,
            (this.getFullYear()+"").substr(4 - RegExp.$1.length));
        for(var k in o)if(new RegExp("("+ k +")").test(format))
            format = format.replace(RegExp.$1,
                RegExp.$1.length==1 ? o[k] :
                    ("00"+ o[k]).substr((""+ o[k]).length));
        return format;
    }

    var keepalive = function ( ws ){
        var time = new Date();
        if($.iChat.opt.last_health != -1 && ( time.getTime() - $.iChat.opt.last_health > $.iChat.opt.health_timeout ) ){
            //此时即可以认为连接断开，可设置重连或者关闭连接
            $("#keeplive_box").html( "服务器没有响应." ).css({"color":"red"});
            //ws.close();
        }
        else{
            $("#keeplive_box").html( "连接正常" ).css({"color":"green"});
            if( ws.bufferedAmount == 0 ){
                ws.send( '~H#C~' );
            }
        }
    }


    var defaults = {
        "button"    : "#btn-send",
        "showbox"   : "#msgbox ul",
        "inputbox"  : "#inputbox",
        "server"    : "ws://192.168.2.129:8808",
        'last_health':0,
        'heartbeat_timer': 0,
        'online_list' : ".onlinelists_inner ul",
        'online_selecter' : "",
        'online_num' : ".online_num",
        'onelin_loading': '.loading',
        'openid': "",
    }

    $.iChat = {
        opt: {},

        //初使化
        init: function(options) {
            this.opt = $.extend(defaults,options);
            this.bind();


            if(!this.opt.server) {
                this.log("请设置服务器")
                return false;
            }

            this.opt.ws = new ReconnectingWebSocket(this.opt.server);

            this.opt.ws.onopen = function () {
                $.iChat.showWelcomeMessage();
                $.iChat.opt.heartbeat_timer = setInterval( function(){keepalive($.iChat.opt.ws)}, 180000 );
                $.iChat.send("cmd-login:"+ $.iChat.opt.openid,true);
                setTimeout(function() {
                    $.iChat.send("cmd-getOnlineList:getOnlineList",true);
                    clearTimeout();
                },200)

            }

            this.opt.ws.onmessage = this.receive;

            this.opt.ws.onclose = this.close;

            this.opt.ws.onerror = this.error;

            return this;
        },

        //关闭连接
        close : function(event) {

            console.log('Client notified socket has closed',event);
        },

        //连接错误
        error : function () {
            $.iChat.parseMessage({type:2, message:':) 服务器连接失败～～'});
        },
        
        //发送消息
        send: function(data, noecho) {
            var str = data;
            str = $.trim(data);
            var pattern = new RegExp("^[\s|\n]+","gi");
            str = str.replace(pattern,"");


            if(str.length < 1) {
                $($.iChat.opt.inputbox).val('')
                $($.iChat.opt.inputbox).focus();
                return false;
            }
            this.opt.ws.send(data);
            if(!noecho) {
                var inpubox = $($.iChat.opt.inputbox);
                var val = inpubox.val();
                    inpubox.val('');
                $.iChat.parseMessage({type:1, message:val});
            }
            return this;
        },

        //回复处理
        receive: function(event) {
            console.log(event);
            var msgobj = $.parseJSON(event.data);
            $.iChat.parseMessage(msgobj);

            return this;
        },

        //解析服务器返回的消息
        //根据不同的类型处出处理
        parseMessage: function (msg) {
            //1000以上的为特殊消息，预留
            /**
             * 消息类型
             * 0 欢迎消息
             * 1 发送本地输出消息
             *
             * 100 普通对话消息
             * 101 私聊消息
             *
             * 200 系统消息iwz
             *
             * 1000 服务器推送的在线会员列表消息
             *      服务器会在用户时入频道及每隔300秒会推送在线列表及在线人数
             */

            var msgtype = {
                'welcome':0,
                'echomsg':1,
                'connect_error':2,
                'normal' : 100,
                'personal' :101,
                'sysnotice' :200,
                'onlinemember': 1000
            };


            //处理消息
            if(msg.type < 1000) {
                var m = {}
                m.showtime  = true; //是否显示发送时间
                m.message   = msg.message;//消息主体，可能是数组
                m.class     = "normal"; //消息的class属性
                m.head      = ""; //消息前缀
                m.from      = ""; //发送用户名
                m.to        = ""; //接收消息的用户名
                m.clear     = false; //显示消息前是否需要清理窗口

                switch (msg.type) {
                    case msgtype.welcome:
                        m.showtime = true;
                        m.class = "welcomemessage";
                        m.clear = true;

                        break;
                    case msgtype.connect_error:
                        m.showtime = true;
                        m.class = "error";
                        m.clear = true;
                        break;
                    case msgtype.echomsg:
                        m.from = "你";
                        m.class = "mymessage";
                        m.head = "对所有人说";
                        break;

                    case msgtype.normal:
                        m.head = "对所有人说";

                        break;
                    case msgtype.personal:

                        break;
                    case msgtype.sysnotice:

                        break;
                }

                var html  = '<li class="message_item '+ m.class +'">';
                if (m.showtime) {
                    html += '<span class="sendtime">[' + new Date().format("mm:ss") + ']</span> ';
                }
                html += '<span class="msgmeta">';
                if (m.from) {
                    html += '<span class="from">'+m.from+'</span>';
                }
                if (m.head) {
                    html += m.head;
                    var showmh = 1;
                }
                if (m.to) {
                    html += m.to;
                }
                html += '</span>';
                if (showmh) html += ' : ';
                html += '<span class="message">';
                html += "##message##";
                html += '</span>';
                html += '</li>';

                if (m.message instanceof Array) {
                    var tmp = '';
                    for (var i in m.message) {
                        if( m.message.length < 1 ) return false;
                        tmp += html.replace(/##message##/, m.message[i]);
                    }
                    html = tmp;
                } else {
                    if( m.message.length < 1 ) return false;
                    html = html.replace(/##message##/, m.message);
                }

                $.iChat.appendMsg(html, m.clear);
                m = {}

            }  else {
            //处理其它服务端的推送事件
                switch (msg.type) {
                    case msgtype.onlinemember:
                        $.iChat.createOnlineMemberlistHtml(msg.message);

                        break;
                    default:

                        break;
                }
            }

        },

        createOnlineMemberlistHtml: function (l) {
            var html = '';
            $.each(l,function(n,e) {
                html += '<li>';
                html += '<img class="avatar" src="http://tp3.sinaimg.cn/1221788390/180/1289279591/0">';
                html += '<p class="username">'+ e.fd +'</p>';
                html += '</li>';
            });

            $($.iChat.opt.onelin_loading).hide(400);
            $($.iChat.opt.online_num).html(l.length);
            $($.iChat.opt.online_list).html(html);

        },

        appendMsg: function ( msgString , clear) {
            var showbox = $($.iChat.opt.showbox);
            if(clear) {
                showbox.html('');
            }
            showbox.append(msgString);
            $("#msgbox").scrollTop($(".message_lists").height()).s

        },

        showWelcomeMessage : function () {
            var msg = {
                type:0,
                message: [
                    "欢迎进入QChat交友聊天室！",
                    "如果需要帮助请发送 help"
                ]
            }
            $.iChat.parseMessage(msg);
        },

        //绑定发送消息事件
        bind: function () {
            if(this.opt.button) {
                $(this.opt.button).on("click", function () {
                    $.iChat.send($($.iChat.opt.inputbox).val());
                })
            }

            $(this.opt.inputbox).on("keydown", function(e) {
                if(e.ctrlKey && e.which == 13 || e.which == 10) {
                    $($.iChat.opt.button).click();
                }
            })
        },

        log: function(data) {
            console.log(data);
        }
    }

})(jQuery);