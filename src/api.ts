'use strict';

import WebSocket from 'ws';

export const PackType = {
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

export const UserStatus = {
	bad: 0,
	offline: 1,
	online: 2,
	away: 3,
	nick_change: 4,
	gender_change: 5,
	color_change: 6,
	back: 7,
	typing: 8,
	stop_typing: 9,
};

export const MessageStyle = {
	message: 0,
	me: 1,
	event: 2,
	offtop: 3,
};

export const ErrorCode = {
	unknown: 0,
	database_error: 1,
	already_connected: 2,
	not_found: 3,
	access_denied: 4,
	invalid_target: 5,
	already_exists: 6,
	incorrect_loginpass: 7,
	user_banned: 8,
};

// WsChat

export default class WsChat {
	private sock = null as WebSocket;
	private address: string;
	rooms = [] as Room[];
	cbManager = new CallbackManager();

	constructor(addr: string) {
		this.address = addr;
	}

	onOpen() {}
	onClose() {}
	onConnectionError(error: Event) {}
	onError(error: any) {}

	onJoinedRoom(room: Room) {}
	onLeaveRoom(room: Room) {}
	onRoomCreated(target: string) {}
	onRoomRemoved(target: string) {}

	onMessage(room: Room, msgobj: any) {}
	onSysMessage(room: Room, text: string) {}

	onUserStatusChanged(room: Room, user: any) {}
	onUserConnected(room: Room, user: any) {}
	onUserDisconnected(room: Room, user: any) {}

	open() {
		this.close();

		let sock = new WebSocket(this.address);

		sock.onopen = () => this.onOpen();
		sock.onclose = () => this.onClose();
		sock.onmessage = data => processMessage(this, data.data);
		sock.onerror = err => this.onConnectionError(err);

		this.sock = sock;
	}

	close() {
		if (this.sock) {
			this.sock.close();
			this.sock = null;
		}
	}

	authByKey(key: string, callback: any) {
		this.cbManager.add(PackType.auth + ':', callback);
		this.sendRaw({
			type: PackType.auth,
			ukey: key,
		});
	}

	authByApiKey(key: string, callback: any) {
		this.cbManager.add(PackType.auth + ':', callback);
		this.sendRaw({
			type: PackType.auth,
			api_key: key,
		});
	}

	authByLoginAndPassword(login: string, password: string, callback: any) {
		this.cbManager.add(PackType.auth + ':', callback);
		this.sendRaw({
			type: PackType.auth,
			login: login,
			password: password,
		});
	}

	changeStatus(status: any) {
		this.sendRaw({
			type: PackType.status,
			status: status,
		});
	}

	joinRoom(name: string, callback: any) {
		let args = {
			target: name,
			callback: callback,
			autoLogin: false,
			loadHistory: false,
		};

		if (typeof name == 'object') {
			Object.assign(args, {target: '', callback: null}, name);
		}

		this.cbManager.add(PackType.join + ':' + args.target, args.callback);
		this.sendRaw({
			type: PackType.join,
			target: args.target,
			auto_login: args.autoLogin,
			load_history: args.loadHistory,
		});
	}

	leaveRoom(name: string, callback: any) {
		this.cbManager.add(PackType.leave + ':' + name, callback);
		this.sendRaw({
			type: PackType.leave,
			target: name,
		});
	}

	createRoom(name: string, callback: any) {
		this.cbManager.add(PackType.create_room + ':' + name, callback);
		this.sendRaw({
			type: PackType.create_room,
			target: name,
		});
	}

	removeRoom(name: string, callback: any) {
		this.cbManager.add(PackType.remove_room + ':' + name, callback);
		this.sendRaw({
			type: PackType.remove_room,
			target: name,
		});
	}

	getConnectedRooms() {
		return this.rooms;
	}

	getRoomByTarget(target: string) {
		if (target == '') {
			return null;
		}

		for (let i in this.rooms) {
			if (this.rooms[i].getTarget() == target) {
				return this.rooms[i];
			}
		}
	}

	sendRaw(obj: any) {
		this.sock.send(JSON.stringify(obj));
	}
}

function processError(chat: WsChat, err: any) {
	if (err.source == 0 || !chat.cbManager.trigger(err.source + ':' + err.target, false, err)) {
		let room = chat.getRoomByTarget(err.target);
		if (room == null || room.onError(err) === true) {
			chat.onError(err);
		}
	}
}

function findOrCreateTempRoom(chat: WsChat, target: string) {
	return chat.getRoomByTarget(target) || new Room(chat, target);
}

function processMessage(chat: WsChat, msg: any) {
	let dt = JSON.parse(msg);
	let room: Room;
	switch (dt.type) {
		case PackType.error:
			delete dt.type;
			processError(chat, dt);
			break;

		case PackType.system:
			room = findOrCreateTempRoom(chat, dt.target);
			if (room.onSysMessage(dt.message) === true) {
				chat.onSysMessage(room, dt.message);
			}
			break;

		case PackType.message:
			delete dt.type;
			room = findOrCreateTempRoom(chat, dt.target);
			if (room.onMessage(dt) === true){
				chat.onMessage(room, dt);
			}
			break;

		case PackType.online_list:
			room = chat.getRoomByTarget(dt.target);
			if (room) {
				Room.onlineListChanged(room, dt.list);
			}
			break;

		case PackType.auth:
			delete dt.type;
			chat.cbManager.trigger(PackType.auth + ':', true, dt);
			break;

		case PackType.status:
			delete dt.type;
			room = findOrCreateTempRoom(chat, dt.target);
			Room.userStatusChanged(room, dt);
			break;

		case PackType.join:
			delete dt.type;
			room = chat.getRoomByTarget(dt.target);
			if (room == null) {
				room = new Room(chat, dt.target);
				chat.rooms.push(room);
			}
			Room.joined(room, dt);
			break;

		case PackType.leave:
			let roomIdx = chat.rooms.findIndex(x => x.target == dt.target);

			if (roomIdx >= 0) {
				room = chat.rooms[roomIdx];
				chat.rooms.splice(roomIdx, 1);
			} else {
				room = new Room(chat, dt.target);
			}

			if (!chat.cbManager.trigger(dt.type + ':' + dt.target, true)) {
				if (room.onLeave() === true) {
					chat.onLeaveRoom(room);
				}
			}
			break;

		case PackType.create_room:
			if (!chat.cbManager.trigger(dt.type + ':' + dt.target, true)) {
				chat.onRoomCreated(dt.target);
			}
			break;

		case PackType.remove_room:
			if (!chat.cbManager.trigger(dt.type + ':' + dt.target, true)) {
				chat.onRoomRemoved(dt.target);
			}
			break;

		case PackType.ping:
			chat.sendRaw({
				type: PackType.ping,
			});
			break;
	}
}

// Room

class Room {
	private wschat: WsChat;
	target: string;
	private members: any[];
	private member_id: number;
	private member_login: string;
	private _joined: boolean;

	constructor(wschat: WsChat, target: string) {
		this.wschat = wschat;
		this.target = target;
		this.members = [];

		this.member_id = 0;
		this.member_login = '';

		this._joined = false;
	}

	onError(err: any) { return true; }
	onSysMessage(message: string) { return true; }
	onMessage(msgobj: any) { return true; }

	onUserStatusChanged(user: any) { return true; }
	onUserConnected(user: any) { return true; }
	onUserDisconnected(user: any) { return true; }

	onJoined() { return true; }
	onLeave() { return true; }

	sendMessage(text: string) {
		this.wschat.sendRaw({
			type: PackType.message,
			target: this.target,
			message: text,
			time: Date.now(),
		});
	}

	getTarget() {
		return this.target;
	}

	getMembers() {
		return this.members;
	}

	getMemberById(id: number) {
		for (let i in this.members) {
			if (this.members[i].member_id == id) {
				return this.members[i];
			}
		}
	}

	getMyMemberId() {
		return this.member_id;
	}

	getMyMemberNick() {
		return this.member_login;
	}

	changeStatus(status: any) {
		this.wschat.sendRaw({
			type: PackType.status,
			target: this.target,
			status: status,
		});
	}

	static joined(room: Room, dt: any) {
		room.member_id = dt.member_id;
		room.member_login = dt.login;
	}

	static onlineListChanged(room: Room, list: any[]) {
		for (let i in list) {
			delete list[i].type;
			list[i].typing = false;
		}
		room.members = list;

		if (!room._joined) {
			room._joined = true;
			if (!room.wschat.cbManager.trigger(PackType.join + ':' + room.target, true, room)) {
				if (room.onJoined() === true) {
					room.wschat.onJoinedRoom(room);
				}
			}
		} else {
			if (room.onUserStatusChanged(null) === true) {
				room.wschat.onUserStatusChanged(room, null);
			}
		}
	}

	static userStatusChanged(room: Room, dt: any) {
		switch (dt.status) {
			case UserStatus.bad:
				//room.wschat.requestOnlineList(room.target);
				break;

			case UserStatus.online:
				if (room.member_id == dt.member_id) {
					room.member_login = dt.name;
				}
				room.members.push(dt);
				break;

			case UserStatus.offline:
				if (room.member_id == dt.member_id) {
					room.member_login = '';
				}

				room.members = room.members.filter(x => x.member_id != dt.member_id);
				break;

			case UserStatus.away:
				room.getMemberById(dt.member_id).status = UserStatus.away;
				break;

			case UserStatus.back:
				room.getMemberById(dt.member_id).status = UserStatus.online;
				break;

			case UserStatus.nick_change:
				if (room.member_id == dt.member_id) {
					room.member_login = dt.name;
				}
				room.getMemberById(dt.member_id).name = dt.name;
				break;

			case UserStatus.gender_change:
				if (dt.name != '') {
					room.getMemberById(dt.member_id).girl = dt.girl;
				}
				break;

			case UserStatus.color_change:
				if (dt.name != '') {
					room.getMemberById(dt.member_id).color = dt.color;
				}
				break;

			case UserStatus.typing:
				room.getMemberById(dt.member_id).typing = true;
				break;

			case UserStatus.stop_typing:
				room.getMemberById(dt.member_id).typing = false;
				break;
		}

		if (dt.status == UserStatus.online) {
			if (room.onUserConnected(dt) === true) {
				room.wschat.onUserConnected(room, dt);
			}
		}
		else if (dt.status == UserStatus.offline) {
			if (room.onUserDisconnected(dt) === true) {
				room.wschat.onUserDisconnected(room, dt);
			}
		}
		else {
			if (room.onUserStatusChanged(dt) === true) {
				room.wschat.onUserStatusChanged(room, dt);
			}
		}
	}
}

// CallbackManager

class CallbackManager {
	private callbacks = [] as any[];

	add(key: string, cbk: any) {
		if (typeof cbk == 'function') {
			this.callbacks.push({key, cbk});
		}
	}

	trigger(key: string, ...args: any[]) {
		let i = 0;
		while (i < this.callbacks.length) {
			let el = this.callbacks[i];
			if (el.key == key) {
				this.callbacks.splice(i, 1);
				return el.cbk.apply(null, args) !== true;
			}
			++i;
		}

		return false;
	}

	clear() {
		this.callbacks = [];
	}
}
