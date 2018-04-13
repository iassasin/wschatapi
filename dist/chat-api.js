!function(e){var t={};function n(o){if(t[o])return t[o].exports;var r=t[o]={i:o,l:!1,exports:{}};return e[o].call(r.exports,r,r.exports,n),r.l=!0,r.exports}n.m=e,n.c=t,n.d=function(e,t,o){n.o(e,t)||Object.defineProperty(e,t,{configurable:!1,enumerable:!0,get:o})},n.r=function(e){Object.defineProperty(e,"__esModule",{value:!0})},n.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return n.d(t,"a",t),t},n.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},n.p="",n(n.s=1)}([function(e,t){e.exports=window.WebSocket},function(e,t,n){"use strict";var o,r,a,s,i,c=n(0);r={error:0,system:1,message:2,online_list:3,auth:4,status:5,join:6,leave:7,create_room:8,remove_room:9,ping:10},a={bad:0,offline:1,online:2,away:3,nick_change:4,gender_change:5,color_change:6,back:7,typing:8,stop_typing:9},s={message:0,me:1,event:2,offtop:3},i={unknown:0,database_error:1,already_connected:2,not_found:3,access_denied:4,invalid_target:5,already_exists:6,incorrect_loginpass:7},(o=function(e){this.sock=null,this.address=e,this.rooms=[],this.cbManager=new b}).version="1.4.1",o.prototype={onOpen:function(){},onClose:function(){},onConnectionError:function(e){},onError:function(e){},onJoinedRoom:function(e){},onLeaveRoom:function(e){},onRoomCreated:function(e){},onRoomRemoved:function(e){},onMessage:function(e,t){},onSysMessage:function(e,t){},onUserStatusChanged:function(e,t){},onUserConnected:function(e,t){},onUserDisconnected:function(e,t){},open:function(){var e=this;this.close();var t=new c(this.address);t.onopen=function(){e.onOpen()},t.onclose=function(){e.onClose()},t.onmessage=function(t){m(e,t.data)},t.onerror=function(t){e.onConnectionError(t)},this.sock=t},close:function(){this.sock&&(this.sock.close(),this.sock=null)},authByKey:function(e,t){this.cbManager.add(r.auth+":",t),d(this,{type:r.auth,ukey:e})},authByApiKey:function(e,t){this.cbManager.add(r.auth+":",t),d(this,{type:r.auth,api_key:e})},authByLoginAndPassword:function(e,t,n){this.cbManager.add(r.auth+":",n),d(this,{type:r.auth,login:e,password:t})},changeStatus:function(e){d(this,{type:r.status,status:e})},joinRoom:function(e,t){var n={target:e,callback:t,autoLogin:!1,loadHistory:!1};"object"==typeof e&&(u(n,{target:"",callback:null}),u(n,e)),this.cbManager.add(r.join+":"+n.target,n.callback),d(this,{type:r.join,target:n.target,auto_login:n.autoLogin,load_history:n.loadHistory})},leaveRoom:function(e,t){this.cbManager.add(r.leave+":"+e,t),d(this,{type:r.leave,target:e})},createRoom:function(e,t){this.cbManager.add(r.create_room+":"+e,t),d(this,{type:r.create_room,target:e})},removeRoom:function(e,t){this.cbManager.add(r.remove_room+":"+e,t),d(this,{type:r.remove_room,target:e})},getConnectedRooms:function(){return this.rooms},getRoomByTarget:function(e){if(""==e)return null;for(var t in this.rooms)if(this.rooms[t].target==e)return this.rooms[t]}};var u=function(e,t){for(var n in t)e[n]=t[n];return e},g=function(e,t){var n=e.getRoomByTarget(t);return n||(n=new l(e,t))},m=function(e,t){var n=JSON.parse(t);switch(n.type){case r.error:delete n.type,function(e,t){if(0==t.source||!e.cbManager.trigger(t.source+":"+t.target,!1,t)){var n=e.getRoomByTarget(t.target);null!=n&&!0!==n.onError(t)||e.onError(t)}}(e,n);break;case r.system:!0===(o=g(e,n.target)).onSysMessage(n.message)&&e.onSysMessage(o,n.message);break;case r.message:delete n.type,!0===(o=g(e,n.target)).onMessage(n)&&e.onMessage(o,n);break;case r.online_list:(o=e.getRoomByTarget(n.target))&&l.onlineListChanged(o,n.list);break;case r.auth:delete n.type,e.cbManager.trigger(r.auth+":",!0,n);break;case r.status:delete n.type;var o=g(e,n.target);l.userStatusChanged(o,n);break;case r.join:delete n.type,null==(o=e.getRoomByTarget(n.target))&&(o=new l(e,n.target),e.rooms.push(o)),l.joined(o,n);break;case r.leave:o=null;for(var a in e.rooms)if(e.rooms[a].target==n.target){o=e.rooms[a],e.rooms.splice(a,1);break}null==o&&(o=new l(e,n.target)),e.cbManager.trigger(n.type+":"+n.target,!0)||!0===o.onLeave()&&e.onLeaveRoom(o);break;case r.create_room:e.cbManager.trigger(n.type+":"+n.target,!0)||e.onRoomCreated(n.target);break;case r.remove_room:e.cbManager.trigger(n.type+":"+n.target,!0)||e.onRoomRemoved(n.target);break;case r.ping:d(e,{type:r.ping})}},d=function(e,t){e.sock.send(JSON.stringify(t))};function l(e,t){this.wschat=e,this.target=t,this.members=[],this.member_id=0,this.member_login="",this._joined=!1}l.prototype={onError:function(e){return!0},onSysMessage:function(e){return!0},onMessage:function(e){return!0},onUserStatusChanged:function(e){return!0},onUserConnected:function(e){return!0},onUserDisconnected:function(e){return!0},onJoined:function(){return!0},onLeave:function(){return!0},sendMessage:function(e){d(this.wschat,{type:r.message,target:this.target,message:e,time:Date.now()})},getTarget:function(){return this.target},getMembers:function(){return this.members},getMemberById:function(e){for(var t in this.members)if(this.members[t].member_id==e)return this.members[t]},getMyMemberId:function(){return this.member_id},getMyMemberNick:function(){return this.member_login},changeStatus:function(e){d(this.wschat,{type:r.status,target:this.target,status:e})}},l.joined=function(e,t){e.member_id=t.member_id,e.member_login=t.login},l.onlineListChanged=function(e,t){for(var n in t)delete t[n].type,t[n].typing=!1;e.members=t,e._joined?!0===e.onUserStatusChanged(null)&&e.wschat.onUserStatusChanged(e,null):(e._joined=!0,e.wschat.cbManager.trigger(r.join+":"+e.target,!0,e)||!0===e.onJoined()&&e.wschat.onJoinedRoom(e))},l.userStatusChanged=function(e,t){switch(t.status){case a.bad:break;case a.online:e.member_id==t.member_id&&(e.member_login=t.name),e.members.push(t);break;case a.offline:for(var n in e.members)if(e.members[n].member_id==t.member_id){e.members.splice(n,1);break}break;case a.away:e.getMemberById(t.member_id).status=a.away;break;case a.back:e.getMemberById(t.member_id).status=a.online;break;case a.nick_change:e.member_id==t.member_id&&(e.member_login=t.name),e.getMemberById(t.member_id).name=t.name;break;case a.gender_change:""!=t.name&&(e.getMemberById(t.member_id).girl=t.girl);break;case a.color_change:""!=t.name&&(e.getMemberById(t.member_id).color=t.color);break;case a.typing:e.getMemberById(t.member_id).typing=!0;break;case a.stop_typing:e.getMemberById(t.member_id).typing=!1}t.status==a.online?!0===e.onUserConnected(t)&&e.wschat.onUserConnected(e,t):t.status==a.offline?!0===e.onUserDisconnected(t)&&e.wschat.onUserDisconnected(e,t):!0===e.onUserStatusChanged(t)&&e.wschat.onUserStatusChanged(e,t)};var b=function(){this.callbacks=[]};b.prototype={add:function(e,t){"function"==typeof t&&this.callbacks.push({key:e,cbk:t})},trigger:function(e){for(var t=0;t<this.callbacks.length;){var n=this.callbacks[t];if(n.key==e)return this.callbacks.splice(t,1),!0!==n.cbk.apply(null,[].slice.apply(arguments,[1]));++t}return!1},clear:function(){this.callbacks=[]}},o.PackType=r,o.UserStatus=a,o.MessageStyle=s,o.ErrorCode=i,"object"==typeof window&&(window.WsChat=o),e.exports=o}]);
