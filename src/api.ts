import WebSocket from 'ws';
import EventEmitter from './EventEmitter';
import {PacketType, UserStatus, Packet, PacketLeave} from './packets';

export const enum WsChatEvents {
	open = 'open',
	close = 'close',
	error = 'error',
	connectionError = 'connection-error',
	message = 'message',
	sysMessage = 'sys-message',
	userStatusChange = 'user-status-change',
}

type WsChatEventsDeclarations = {
	[WsChatEvents.open]: () => void;
	[WsChatEvents.close]: () => void;
	[WsChatEvents.error]: (room: Room, error: any) => void;
	[WsChatEvents.connectionError]: (error: Event) => void;
	[WsChatEvents.message]: (room: Room, msgobj: any) => void;
	[WsChatEvents.sysMessage]: (room: Room, text: string) => void;
	[WsChatEvents.userStatusChange]: (room: Room, user: any) => void;
}

function deferred<T = any>() {
	type PromiseParams = Parameters<ConstructorParameters<PromiseConstructor>[0]>;
	let resolve: (value?: T | PromiseLike<T>) => void, reject: PromiseParams[1];

	let promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return [promise, resolve, reject] as [typeof promise, typeof resolve, typeof reject];
}

export default class WsChat extends EventEmitter<WsChatEventsDeclarations> {
	private sock = null as WebSocket;
	private address: string;
	private sequenceCallbacks = {} as {[sequenceId: number]: (...args: any[]) => any};
	private sequenceId = 0;
	private rooms = [] as Room[];

	constructor(addr: string) {
		super();
		this.address = addr;
	}

	open() {
		if (this.sock) {
			throw Error('Connection already opened');
		}

		let [promise, resolve, reject] = deferred<void>();

		this.once(WsChatEvents.open, resolve);
		this.once(WsChatEvents.connectionError, reject);

		let sock = new WebSocket(this.address);

		sock.onopen = () => this.emit(WsChatEvents.open);
		sock.onclose = () => this.emit(WsChatEvents.close);
		sock.onmessage = data => this.processMessage(data.data as string);
		sock.onerror = err => this.emit(WsChatEvents.connectionError, err);

		this.sock = sock;

		return promise;
	}

	close() {
		if (!this.sock) {
			return Promise.resolve();
		}

		let [promise, resolve, reject] = deferred<void>();

		this.once(WsChatEvents.close, resolve);
		this.once(WsChatEvents.connectionError, reject);

		this.sock.close();
		this.sock = null;

		return promise;
	}

	authByKey(key: string) {
		let [promise, sequenceId] = this.createPromiseOnSequence();

		this.sendRaw({
			sequenceId,
			type: PacketType.auth,
			ukey: key,
		});

		return promise;
	}

	authByApiKey(key: string) {
		let [promise, sequenceId] = this.createPromiseOnSequence();

		this.sendRaw({
			sequenceId,
			type: PacketType.auth,
			api_key: key,
		});

		return promise;
	}

	authByLoginAndPassword(login: string, password: string) {
		let [promise, sequenceId] = this.createPromiseOnSequence();

		this.sendRaw({
			sequenceId,
			type: PacketType.auth,
			login: login,
			password: password,
		});

		return promise;
	}

	changeStatus(status: any) {
		this.sendRaw({
			type: PacketType.status,
			status: status,
		});
	}

	joinRoom(target: string, options = {autoLogin: false, loadHistory: false}) {
		let [promise, sequenceId] = this.createPromiseOnSequence();

		this.sendRaw({
			sequenceId,
			type: PacketType.join,
			target,
			auto_login: !!options.autoLogin,
			load_history: !!options.loadHistory,
		});

		return promise;
	}

	leaveRoom(name: string) {
		let [promise, sequenceId] = this.createPromiseOnSequence();

		this.sendRaw({
			sequenceId,
			type: PacketType.leave,
			target: name,
		});

		return promise;
	}

	createRoom(name: string) {
		let [promise, sequenceId] = this.createPromiseOnSequence();

		this.sendRaw({
			sequenceId,
			type: PacketType.create_room,
			target: name,
		});

		return promise;
	}

	removeRoom(name: string) {
		let [promise, sequenceId] = this.createPromiseOnSequence();

		this.sendRaw({
			sequenceId,
			type: PacketType.remove_room,
			target: name,
		});

		return promise;
	}

	getConnectedRooms() {
		return this.rooms;
	}

	getRoomByTarget(target: string) {
		if (target == '') {
			return null;
		}

		return this.rooms.find(x => x.target == target);
	}

	sendRaw(obj: any) {
		this.sock.send(JSON.stringify(obj));
	}

	private nextSequenceId() {
		return this.sequenceId = this.sequenceId >= Number.MAX_SAFE_INTEGER ? 0 : this.sequenceId + 1;
	}

	private createPromiseOnSequence() {
		let sequenceId = this.nextSequenceId();
		let [promise, resolve] = deferred();
		this.sequenceCallbacks[sequenceId] = resolve;

		return [promise, sequenceId] as [typeof promise, typeof sequenceId];
	}

	sequenceCallback<T>(sequenceId: number, remove: boolean, ...args: T[]) {
		if (sequenceId){
			let f = this.sequenceCallbacks[sequenceId];
			if (f) {
				f(...args);
				if (remove) {
					delete this.sequenceCallbacks[sequenceId];
				}
				return true;
			}
		}

		return false;
	}

	private processMessage(msg: string) {
		let chat = this;
		let dt = JSON.parse(msg) as Packet;
		let room: Room;

		switch (dt.type) {
			case PacketType.error:
				delete dt.type;

				if (!this.sequenceCallback(dt.sequenceId, true, dt)) {
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
					Room.onlineListChanged(room, dt.list, dt.sequenceId);
				}
				break;

			case PacketType.auth:
				delete dt.type;
				chat.sequenceCallback(dt.sequenceId, true, dt);
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
				let roomIdx = chat.rooms.findIndex(x => x.target == (dt as PacketLeave).target);

				if (roomIdx >= 0) {
					room = chat.rooms[roomIdx];
					chat.rooms.splice(roomIdx, 1);
				} else {
					room = new Room(chat, dt.target);
				}

				chat.sequenceCallback(dt.sequenceId, true, dt.target);
				break;

			case PacketType.create_room:
			case PacketType.remove_room:
				chat.sequenceCallback(dt.sequenceId, true, dt.target);
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
	members: any[];
	memberId: number;
	memberNick: string;
	private _joined: boolean;

	constructor(wschat: WsChat, target: string) {
		this.wschat = wschat;
		this.target = target;
		this.members = [];

		this.memberId = 0;
		this.memberNick = '';

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

	getMemberById(id: number) {
		return this.members.find(x => x.member_id == id);
	}

	changeStatus(status: any) {
		this.wschat.sendRaw({
			type: PacketType.status,
			target: this.target,
			status: status,
		});
	}

	static joined(room: Room, dt: any) {
		room.memberId = dt.member_id;
		room.memberNick = dt.login;
	}

	static onlineListChanged(room: Room, list: any[], sequenceId: number) {
		for (let el of list) {
			delete el.type;
			el.typing = false;
		}
		room.members = list;

		if (!room._joined) {
			room._joined = true;
			room.wschat.sequenceCallback(sequenceId, true, room);
		}
	}

	static userStatusChanged(room: Room, dt: any) {
		switch (dt.status) {
			case UserStatus.bad:
				break;

			case UserStatus.online:
				if (room.memberId == dt.member_id) {
					room.memberNick = dt.name;
				}
				room.members.push(dt);
				break;

			case UserStatus.offline:
				if (room.memberId == dt.member_id) {
					room.memberNick = '';
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
				if (room.memberId == dt.member_id) {
					room.memberNick = dt.name;
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
