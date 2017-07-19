'use strict';

var WsChat, PackType, UserStatus, MessageStyle, ErrorCode;

(function(){

PackType = {
	error: 0,
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

ErrorCode = {
	unknown: 0,
	database_error: 1,
	already_connected: 2,
	not_found: 3,
	access_denied: 4,
	invalid_target: 5,
	already_exists: 6,
};

// WsChat

WsChat = function(addr){
	this.sock = null;
	this.address = addr;
	this.rooms = [];
	this.cbManager = new CallbackManager();
}

WsChat.version = '1.0.0';

WsChat.prototype = {
	onOpen: function(){},
	onClose: function(){},
	onConnectionError: function(error){},
	onError: function(error){},

	onJoinedRoom: function(room){},
	onLeaveRoom: function(room){},
	onRoomCreated: function(target){},
	onRoomRemoved: function(target){},

	onMessage: function(room, msgobj){},
	onSysMessage: function(room, text){},

	onUserStatusChanged: function(room, user){},
	onUserConnected: function(room, user){},
	onUserDisconnected: function(room, user){},

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
			me.onConnectionError(err);
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

	authByApiKey: function(key, callback){
		this.cbManager.add(PackType.auth, callback);
		sendRaw(this, {
			type: PackType.auth,
			api_key: key,
		});
	},

	changeStatus: function(status){
		sendRaw(this, {
			type: PackType.status,
			status: status,
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
		this.cbManager.add(PackType.remove_room + ':' + name, callback);
		sendRaw(this, {
			type: PackType.remove_room,
			target: name,
		});
	},

	getConnectedRooms: function(){
		return this.rooms;
	},

	getRoomByTarget: function(target){
		if (target == '')
			return null;
		for (var i in this.rooms){
			if (this.rooms[i].target == target){
				return this.rooms[i];
			}
		}
	},
};

var requestOnlineList = function(chat, target){
	sendRaw(chat, {
		type: PackType.online_list,
		target: target,
	});
};

var processError = function(chat, err){
	if (err.source == 0 || !chat.cbManager.trigger(err.source + ':' + err.target, false, err)){
		var room = chat.getRoomByTarget(err.target);
		if (room == null || room.onError(err) === true){
			chat.onError(err);
		}
	}
};

var findOrCreateTempRoom = function(chat, target){
	var room = chat.getRoomByTarget(target);
	if (room)
		return room;

	room = new Room(chat, target);
	return room;
};

var processMessage = function(chat, msg){
	var dt = JSON.parse(msg);
	switch (dt.type){
		case PackType.error:
			delete dt.type;
			processError(chat, dt);
			break;

		case PackType.system:
			var room = findOrCreateTempRoom(chat, dt.target);
			if (room.onSysMessage(dt.message) === true){
				chat.onSysMessage(room, dt.message);
			}
			break;

		case PackType.message:
			delete dt.type;
			var room = findOrCreateTempRoom(chat, dt.target);
			if (room.onMessage(dt) === true){
				chat.onMessage(room, dt);
			}
			break;

		case PackType.online_list:
			var room = chat.getRoomByTarget(dt.target);
			if (room){
				Room.onlineListChanged(room, dt.list);
			}
			break;

		case PackType.auth:
			delete dt.type;
			chat.cbManager.trigger(PackType.auth, true, dt);
			break;

		case PackType.status:
			delete dt.type;
			var room = findOrCreateTempRoom(chat, dt.target);
			Room.userStatusChanged(room, dt);
			break;

		case PackType.join:
			delete dt.type;
			var room = chat.getRoomByTarget(dt.target);
			if (room == null){
				room = new Room(chat, dt.target);
				chat.rooms.push(room);
			}
			Room.joined(room, dt);
			break;

		case PackType.leave:
			var room = null;
			for (var i in chat.rooms){
				if (chat.rooms[i].target == dt.target){
					room = chat.rooms[i];
					chat.rooms.splice(i, 1);
					break;
				}
			}
			if (room == null){
				room = new Room(chat, dt.target);
			}

			if (!chat.cbManager.trigger(dt.type + ':' + dt.target, true)){
				if (room.onLeave() === true){
					chat.onLeaveRoom(room);
				}
			}
			break;

		case PackType.create_room:
			if (!chat.cbManager.trigger(dt.type + ':' + dt.target, true)){
				chat.onRoomCreated(dt.target);
			}
			break;

		case PackType.remove_room:
			if (!chat.cbManager.trigger(dt.type + ':' + dt.target, true)){
				chat.onRoomRemoved(dt.target);
			}
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

// Room

function Room(wschat, target){
	this.wschat = wschat;
	this.target = target;
	this.members = [];

	this.member_id = 0;
	this.member_login = '';

	this._joined = false;
}

Room.prototype = {
	onError: function(err){ return true; },
	onSysMessage: function(message){ return true; },
	onMessage: function(msgobj){ return true; },

	onUserStatusChanged: function(user){ return true; },
	onUserConnected: function(user){ return true; },
	onUserDisconnected: function(user){ return true; },

	onJoined: function(){ return true; },
	onLeave: function(){ return true; },

	sendMessage: function(text){
		sendRaw(this.wschat, {
			type: PackType.message,
			target: this.target,
			message: text,
			time: Date.now(),
		});
	},

	getTarget: function(){
		return this.target;
	},

	getMembers: function(){
		return this.members;
	},

	getMemberById: function(id){
		for (var i in this.members){
			if (this.members[i].member_id == id){
				return this.members[i];
			}
		}
	},

	getMyMemberId: function(){
		return this.member_id;
	},

	getMyMemberNick: function(){
		return this.member_login;
	},
};

Room.joined = function(room, dt){
	room.member_id = dt.member_id;
	room.member_login = dt.login;
};

Room.onlineListChanged = function(room, list){
	for (var i in list){
		delete list[i].type;
	}
	room.members = list;

	if (!room._joined){
		room._joined = true;
		if (!room.wschat.cbManager.trigger(PackType.join + ':' + room.target, true, room)){
			if (room.onJoined() === true){
				room.wschat.onJoinedRoom(room);
			}
		}
	} else {
		if (room.onUserStatusChanged(null) === true){
			room.wschat.onUserStatusChanged(room, null);
		}
	}
};

Room.userStatusChanged = function(room, dt){
	switch (dt.status){
		case UserStatus.bad:
			//room.wschat.requestOnlineList(room.target);
			break;

		case UserStatus.online:
			if (room.member_id == dt.member_id){
				room.member_login = dt.name;
			}
			room.members.push(dt);
			break;

		case UserStatus.offline:
			for (var i in room.members){
				if (room.members[i].member_id == dt.member_id){
					room.members.splice(i, 1);
					break;
				}
			}
			break;

		case UserStatus.away:
			room.getMemberById(dt.member_id).status = UserStatus.away;
			break;

		case UserStatus.back:
			room.getMemberById(dt.member_id).status = UserStatus.online;
			break;

		case UserStatus.nick_change:
			if (room.member_id == dt.member_id){
				room.member_login = dt.name;
			}
			room.getMemberById(dt.member_id).name = dt.name;
			break;

		case UserStatus.gender_change:
			if (dt.name != ''){
				room.getMemberById(dt.member_id).girl = dt.girl;
			}
			break;

		case UserStatus.color_change:
			if (dt.name != ''){
				room.getMemberById(dt.member_id).color = dt.color;
			}
			break;
	}

	if (dt.status == UserStatus.online){
		if (room.onUserConnected(dt) === true){
			room.wschat.onUserConnected(room, dt);
		}
	}
	else if (dt.status == UserStatus.offline){
		if (room.onUserDisconnected(dt) === true){
			room.wschat.onUserDisconnected(room, dt);
		}
	}
	else {
		if (room.onUserStatusChanged(dt) === true){
			room.wschat.onUserStatusChanged(room, dt);
		}
	}
};

// CallbackManager

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
				this.callbacks.splice(i, 1);
				return el.cbk.apply(null, [].slice.apply(arguments, [1])) !== true;
			}
			++i;
		}

		return false;
	},

	clear: function(){
		this.callbacks = [];
	},
};

})();

if (typeof module == 'object'){
	var WebSocket = require('ws');

	WsChat.PackType = PackType;
	WsChat.UserStatus = UserStatus;
	WsChat.MessageStyle = MessageStyle;
	WsChat.ErrorCode = ErrorCode;

	module.exports = WsChat;
}
