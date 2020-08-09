import WebSocket from 'ws';
import CallbackManager from './CallbackManager';
import EventEmitter from './EventEmitter';
import {PacketType, MessageStyle, UserStatus} from './packets';

export const enum WsChatEvents {
	open = 'open',
	close = 'close',
	error = 'error',
	connectionError = 'connection-error',
	message = 'message',
	sysMessage = 'sys-message',
	userStatusChange = 'user-status-change',
	joinRoom = 'join-room',
	leaveRoom = 'leave-room',
	createRoom = 'create-room',
	removeRoom = 'remove-room',
}

type WsChatEventsDeclarations = {
	[WsChatEvents.open]: () => void;
	[WsChatEvents.close]: () => void;
	[WsChatEvents.error]: (room: Room, error: any) => void;
	[WsChatEvents.connectionError]: (error: Event) => void;
	[WsChatEvents.message]: (room: Room, msgobj: any) => void;
	[WsChatEvents.sysMessage]: (room: Room, text: string) => void;
	[WsChatEvents.userStatusChange]: (room: Room, user: any) => void;
	[WsChatEvents.joinRoom]: (room: Room) => void;
	[WsChatEvents.leaveRoom]: (room: Room) => void;
	[WsChatEvents.createRoom]: (target: string) => void;
	[WsChatEvents.removeRoom]: (target: string) => void;
}

export default class WsChat extends EventEmitter<WsChatEventsDeclarations> {
	private sock = null as WebSocket;
	private address: string;
	private sequenceCallbacks = {} as {[sequenceId: number]: (...args: any[]) => any};
	private sequenceId = 0;
	private rooms = [] as Room[];
	cbManager = new CallbackManager();

	constructor(addr: string) {
		super();
		this.address = addr;
	}

	open() {
		this.close();

		let sock = new WebSocket(this.address);

		sock.onopen = () => this.emit(WsChatEvents.open);
		sock.onclose = () => this.emit(WsChatEvents.close);
		sock.onmessage = data => this.processMessage(data.data);
		sock.onerror = err => this.emit(WsChatEvents.connectionError, err);

		this.sock = sock;
	}

	close() {
		if (this.sock) {
			this.sock.close();
			this.sock = null;
		}
	}

	authByKey(key: string, callback: any) {
		this.cbManager.add(PacketType.auth + ':', callback);
		this.sendRaw({
			type: PacketType.auth,
			ukey: key,
		});
	}

	authByApiKey(key: string, callback: any) {
		this.cbManager.add(PacketType.auth + ':', callback);
		this.sendRaw({
			type: PacketType.auth,
			api_key: key,
		});
	}

	authByLoginAndPassword(login: string, password: string, callback: any) {
		this.cbManager.add(PacketType.auth + ':', callback);
		this.sendRaw({
			type: PacketType.auth,
			login: login,
			password: password,
		});
	}

	changeStatus(status: any) {
		this.sendRaw({
			type: PacketType.status,
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

		this.cbManager.add(PacketType.join + ':' + args.target, args.callback);
		this.sendRaw({
			type: PacketType.join,
			target: args.target,
			auto_login: args.autoLogin,
			load_history: args.loadHistory,
		});
	}

	leaveRoom(name: string, callback: any) {
		this.cbManager.add(PacketType.leave + ':' + name, callback);
		this.sendRaw({
			type: PacketType.leave,
			target: name,
		});
	}

	createRoom(name: string, callback: any) {
		this.cbManager.add(PacketType.create_room + ':' + name, callback);
		this.sendRaw({
			type: PacketType.create_room,
			target: name,
		});
	}

	removeRoom(name: string, callback: any) {
		this.cbManager.add(PacketType.remove_room + ':' + name, callback);
		this.sendRaw({
			type: PacketType.remove_room,
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

	private processMessage(msg: any) {
		let chat = this;
		let dt = JSON.parse(msg);
		let room: Room;

		switch (dt.type) {
			case PacketType.error:
				delete dt.type;
				if (dt.source == 0 || !this.cbManager.trigger(dt.source + ':' + dt.target, false, dt)) {
					let room = this.getRoomByTarget(dt.target);
					this.emit(WsChatEvents.error, room, dt);
				}
				break;

			case PacketType.system:
				room = chat.getRoomByTarget(dt.target);
				chat.emit(WsChatEvents.sysMessage, room, dt.message);
				break;

			case PacketType.message:
				delete dt.type;
				room = chat.getRoomByTarget(dt.target);
				chat.emit(WsChatEvents.message, room, dt);
				break;

			case PacketType.online_list:
				room = chat.getRoomByTarget(dt.target);
				if (room) {
					Room.onlineListChanged(room, dt.list);
				}
				break;

			case PacketType.auth:
				delete dt.type;
				chat.cbManager.trigger(PacketType.auth + ':', true, dt);
				break;

			case PacketType.status:
				delete dt.type;
				room = chat.getRoomByTarget(dt.target);
				Room.userStatusChanged(room, dt);
				break;

			case PacketType.join:
				delete dt.type;
				room = chat.getRoomByTarget(dt.target);
				if (room == null) {
					room = new Room(chat, dt.target);
					chat.rooms.push(room);
				}
				Room.joined(room, dt);
				break;

			case PacketType.leave:
				let roomIdx = chat.rooms.findIndex(x => x.target == dt.target);

				if (roomIdx >= 0) {
					room = chat.rooms[roomIdx];
					chat.rooms.splice(roomIdx, 1);
				} else {
					room = new Room(chat, dt.target);
				}

				if (!chat.cbManager.trigger(dt.type + ':' + dt.target, true)) {
					chat.emit(WsChatEvents.leaveRoom, room);
				}
				break;

			case PacketType.create_room:
				if (!chat.cbManager.trigger(dt.type + ':' + dt.target, true)) {
					chat.emit(WsChatEvents.createRoom, dt.target);
				}
				break;

			case PacketType.remove_room:
				if (!chat.cbManager.trigger(dt.type + ':' + dt.target, true)) {
					chat.emit(WsChatEvents.removeRoom, dt.target);
				}
				break;

			case PacketType.ping:
				chat.sendRaw({
					type: PacketType.ping,
				});
				break;
		}
	}
}

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

	sendMessage(text: string) {
		this.wschat.sendRaw({
			type: PacketType.message,
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
			type: PacketType.status,
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
			if (!room.wschat.cbManager.trigger(PacketType.join + ':' + room.target, true, room)) {
				room.wschat.emit(WsChatEvents.joinRoom, room);
			}
		} else {
			room.wschat.emit(WsChatEvents.userStatusChange, room, null);
		}
	}

	static userStatusChanged(room: Room, dt: any) {
		switch (dt.status) {
			case UserStatus.bad:
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

		room.wschat.emit(WsChatEvents.userStatusChange, room, dt);
	}
}
