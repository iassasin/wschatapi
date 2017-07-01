'use strict';

var WsChat, PackType, UserStatus, MessageStyle;

(function(){

PackType = {
	bad: 0,
	system: 1,
	message: 2,
	online_list: 3,
	auth: 4,
	status: 5,
	join: 6,
	leave: 7,
	create_room: 8,
	remove_room: 9,
	ping: 10,
};

UserStatus = {
	bad: 0,
	offline: 1,
	online: 2,
	away: 3,
	nick_change: 4,
	gender_change: 5,
	color_change: 6,
	back: 7,
};

MessageStyle = {
	message: 0,
	me: 1,
	event: 2,
	offtop: 3,
};

WsChat = function(addr){
	this.sock = null;
	this.address = addr;
	this.cbManager = new CallbackManager();
}

WsChat.prototype = {
	onOpen: function(){},
	onClose: function(){},
	onError: function(error){},

	onMessage: function(target, msg){},
	onSysMessage: function(target, text){},

	onUserStatusChanged: function(target, user){},
	onUserConnected: function(target, user){},
	onUserDisconnected: function(target, user){},

	open: function(){
		var me = this;

		this.close();

		var sock = new WebSocket(this.address);

		sock.onopen = function(){
			me.onOpen();
		};

		sock.onclose = function(){
			me.onClose();
		};

		sock.onmessage = function(data){
			processMessage(me, data.data);
		};

		sock.onerror = function(err){
			me.onError(err);
		};

		this.sock = sock;
	},

	close: function(){
		if (this.sock){
			this.sock.close();
			this.sock = null;
		}
	},

	authByKey: function(key, callback){
		this.cbManager.add(PackType.auth, callback);
		sendRaw(this, {
			type: PackType.auth,
			ukey: key,
		});
	},

	//auth: function(login, password, callback(result))

	changeStatus: function(status){
		sendRaw(this, {
			type: PackType.status,
			status: status,
		});
	},

	sendMessage: function(target, text){
		sendRaw(this, {
			type: PackType.message,
			target: target,
			message: text,
			time: Date.now(),
		});
	},

	joinRoom: function(name, callback){
		this.cbManager.add(PackType.join + ':' + name, callback);
		sendRaw(this, {
			type: PackType.join,
			target: name,
		});
	},

	leaveRoom: function(name, callback){
		this.cbManager.add(PackType.leave + ':' + name, callback);
		sendRaw(this, {
			type: PackType.leave,
			target: name,
		});
	},

	createRoom: function(name, callback){
		this.cbManager.add(PackType.create_room + ':' + name, callback);
		sendRaw(this, {
			type: PackType.create_room,
			target: name,
		});
	},

	removeRoom: function(name, callback){
		//this.cbManager.add(PackType.remove_room + ':' + name, callback);
		sendRaw(this, {
			type: PackType.remove_room,
			target: name,
		});
	},

	requestOnlineList: function(target, callback){
		this.cbManager.add(PackType.online_list + ':' + name, callback);
		sendRaw(this, {
			type: PackType.online_list,
			target: name,
		});
	},
};

var CallbackManager = function(){
	this.callbacks = [];
};

CallbackManager.prototype = {
	add: function(key, cbk){
		if (typeof cbk == 'function'){
			this.callbacks.push({
				key: key,
				cbk: cbk,
			});
		}
	},

	trigger: function(key){
		var i = 0;
		while (i < this.callbacks.length){
			var el = this.callbacks[i];
			if (el.key == key){
				el.cbk.apply(null, [].slice.apply(arguments, [1]));
				this.callbacks.splice(i, 1);
				continue;
			}
			++i;
		}
	},

	clear: function(){
		this.callbacks = [];
	},
};

var processMessage = function(chat, msg){
	var dt = JSON.parse(msg);
	switch (dt.type){
		case PackType.system:
			chat.onSysMessage(dt.target, dt.message);
			break;

		case PackType.message:
			delete dt.type;
			chat.onMessage(dt.target, dt);
			break;

		case PackType.online_list:
			chat.cbManager.trigger(dt.type + ':' + dt.target, dt.list);
			break;

		case PackType.auth:
			delete dt.type;
			chat.cbManager.trigger(PackType.auth, dt);
			break;

		case PackType.status:
			delete dt.type;

			if (dt.status == UserStatus.online){
				chat.onUserConnected(dt.target, dt);
			}
			else if (dt.status == UserStatus.offline){
				chat.onUserDisconnected(dt.target, dt);
			}
			else {
				chat.onUserStatusChanged(dt.target, dt);
			}
			break;

		case PackType.join:
			chat.cbManager.trigger(dt.type + ':' + dt.target);
			break;

		case PackType.leave:
			chat.cbManager.trigger(dt.type + ':' + dt.target);
			break;

		case PackType.create_room:
			chat.cbManager.trigger(dt.type + ':' + dt.target);
			break;

		case PackType.ping:
			sendRaw(chat, {
				type: PackType.ping,
			});
			break;
	}
};

var sendRaw = function(chat, obj){
	chat.sock.send(JSON.stringify(obj));
};

})();

if (typeof module == 'object'){
	var WebSocket = require('ws');

	WsChat.PackType = PackType;
	WsChat.UserStatus = UserStatus;
	WsChat.MessageStyle = MessageStyle;

	module.exports = WsChat;
}
