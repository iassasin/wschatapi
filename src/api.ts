import WebSocket from 'ws';
import EventEmitter from './EventEmitter';
import {PacketType, UserStatus, Packet, PacketLeave, MessageObject, UserObject, PacketJoin, PacketStatus, PacketAuth} from './packets';

export {MessageObject, MessageStyle, UserObject, PacketType, ErrorCode, UserStatus} from './packets';

export const enum WsChatEvents {
	open = 'open',
	close = 'close',
	error = 'error',
	connectionError = 'connectionError',
	message = 'message',
	sysMessage = 'sysMessage',
	userStatusChange = 'userStatusChange',
	joinRoom = 'joinRoom',
	leaveRoom = 'leaveRoom',
}

type WsChatEventsDeclarations = {
	open: () => void;
	close: () => void;
	error: (room: Room, error: any) => void;
	connectionError: (error: Event) => void;
	message: (room: Room, msgobj: MessageObject) => void;
	sysMessage: (room: Room, text: string) => void;
	userStatusChange: (room: Room, user: UserObject) => void;
	joinRoom: (room: Room) => void;
	leaveRoom: (target: string) => void;
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

export class WsChat extends EventEmitter<WsChatEventsDeclarations> {
	private _sock = null as WebSocket;
	private _address: string;
	private _sequenceCallbacks = {} as {[sequenceId: number]: ((...args: any[]) => any)[]};
	private _sequenceId = 0;
	rooms = [] as Room[];

	get connected() { return !!this._sock; }

	constructor(addr: string) {
		super();
		this._address = addr;
	}

	open() {
		if (this._sock) {
			throw Error('Connection already opened');
		}

		let promise = this._promiseFromEvents(WsChatEvents.open, WsChatEvents.connectionError);

		let sock = new WebSocket(this._address);

		sock.onopen = () => this.emit(WsChatEvents.open);
		sock.onclose = () => {
			this.emit(WsChatEvents.close);
			this._sock = null;
			this._sequenceCallbacks = {};
			this.off();
			this.rooms = [];
		};
		sock.onmessage = data => this._processMessage(data.data as string);
		sock.onerror = err => this.emit(WsChatEvents.connectionError, err);

		this._sock = sock;

		return promise;
	}

	close() {
		if (!this._sock) {
			return Promise.resolve();
		}

		let promise = this._promiseFromEvents(WsChatEvents.close, WsChatEvents.connectionError);

		this._sock.close(1000); // 1000 == close_ok
		this._sock = null;

		return promise;
	}

	authByKey(key: string) {
		let [promise, sequenceId] = this._createPromiseOnSequence<PacketAuth>();

		this._sendRaw({
			sequenceId,
			type: PacketType.auth,
			ukey: key,
		});

		return promise;
	}

	authByApiKey(key: string) {
		let [promise, sequenceId] = this._createPromiseOnSequence<PacketAuth>();

		this._sendRaw({
			sequenceId,
			type: PacketType.auth,
			api_key: key,
		});

		return promise;
	}

	authByLoginAndPassword(login: string, password: string) {
		let [promise, sequenceId] = this._createPromiseOnSequence<PacketAuth>();

		this._sendRaw({
			sequenceId,
			type: PacketType.auth,
			login: login,
			password: password,
		});

		return promise;
	}

	restoreConnection(token: string) {
		let [promise, sequenceId] = this._createPromiseOnSequence<PacketAuth>();

		this._sendRaw({
			sequenceId,
			type: PacketType.auth,
			token,
		});

		return promise;
	}

	changeStatus(status: UserStatus) {
		this._sendRaw({
			type: PacketType.status,
			status: status,
		});
	}

	joinRoom(target: string, options = {autoLogin: false, loadHistory: false}) {
		let [promise, sequenceId] = this._createPromiseOnSequence<Room>();

		this._sendRaw({
			sequenceId,
			type: PacketType.join,
			target,
			auto_login: !!options.autoLogin,
			load_history: !!options.loadHistory,
		});

		return promise;
	}

	leaveRoom(name: string) {
		let [promise, sequenceId] = this._createPromiseOnSequence<string>();

		this._sendRaw({
			sequenceId,
			type: PacketType.leave,
			target: name,
		});

		return promise;
	}

	createRoom(name: string) {
		let [promise, sequenceId] = this._createPromiseOnSequence<string>();

		this._sendRaw({
			sequenceId,
			type: PacketType.create_room,
			target: name,
		});

		return promise;
	}

	removeRoom(name: string) {
		let [promise, sequenceId] = this._createPromiseOnSequence<string>();

		this._sendRaw({
			sequenceId,
			type: PacketType.remove_room,
			target: name,
		});

		return promise;
	}

	getRoomByTarget(target: string) {
		if (target == '') {
			return null;
		}

		return this.rooms.find(x => x.target == target);
	}

	_sendRaw(obj: Packet) {
		if (!this.connected) {
			throw new Error('WsChat is not connected');
		}

		this._sock.send(JSON.stringify(obj));
	}

	private _promiseFromEvents(resolveEvent: WsChatEvents, rejectEvent: WsChatEvents) {
		let [promise, resolve, reject] = deferred<void>();

		let okHandler: () => void, errorHandler: (err: any) => void;

		okHandler = () => {
			this.off(rejectEvent, errorHandler);
			resolve();
		};

		errorHandler = (err: any) => {
			this.off(resolveEvent, okHandler);
			reject(err);
		};

		this.once(resolveEvent, okHandler);
		this.once(rejectEvent, errorHandler);

		return promise;
	}

	private _nextSequenceId() {
		return this._sequenceId = this._sequenceId >= Number.MAX_SAFE_INTEGER ? 0 : this._sequenceId + 1;
	}

	private _createPromiseOnSequence<T = any>() {
		let sequenceId = this._nextSequenceId();
		let [promise, resolve, reject] = deferred<T>();
		this._sequenceCallbacks[sequenceId] = [resolve, reject];

		return [promise, sequenceId] as [typeof promise, typeof sequenceId];
	}

	_sequenceCallback<T>(sequenceId: number, error: boolean, ...args: T[]) {
		if (sequenceId){
			let f = this._sequenceCallbacks[sequenceId];
			if (f) {
				delete this._sequenceCallbacks[sequenceId];
				f[+error](...args);
				return true;
			}
		}

		return false;
	}

	private _processMessage(msg: string) {
		let chat = this;
		let dt = JSON.parse(msg) as Packet;
		let room: Room;

		switch (dt.type) {
			case PacketType.error:
				delete dt.type;

				if (!this._sequenceCallback(dt.sequenceId, true, dt)) {
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
				chat.emit(WsChatEvents.message, room, dt as MessageObject);
				break;

			case PacketType.online_list:
				room = chat.getRoomByTarget(dt.target);
				if (room) {
					Room._onlineListChanged(room, dt.list, dt.sequenceId);
				}
				break;

			case PacketType.auth:
				delete dt.type;
				chat._sequenceCallback(dt.sequenceId, false, dt);
				break;

			case PacketType.status:
				delete dt.type;
				room = chat.getRoomByTarget(dt.target);
				Room._userStatusChanged(room, dt as UserObject);
				break;

			case PacketType.join:
				delete dt.type;
				room = chat.getRoomByTarget(dt.target);
				if (room == null) {
					room = new Room(chat, dt.target);
					chat.rooms.push(room);
				}
				Room._joined(room, dt);
				break;

			case PacketType.leave:
				let roomIdx = chat.rooms.findIndex(x => x.target == (dt as PacketLeave).target);

				if (roomIdx >= 0) {
					room = chat.rooms[roomIdx];
					chat.rooms.splice(roomIdx, 1);
				} else {
					room = new Room(chat, dt.target);
				}

				if (!chat._sequenceCallback(dt.sequenceId, false, dt.target)) {
					chat.emit(WsChatEvents.leaveRoom, dt.target);
				}

				break;

			case PacketType.create_room:
			case PacketType.remove_room:
				chat._sequenceCallback(dt.sequenceId, false, dt.target);
				break;

			case PacketType.ping:
				chat._sendRaw({
					type: PacketType.ping,
				});
				break;
		}
	}
}

class Room {
	private _wschat: WsChat;
	target: string;
	members: UserObject[];
	memberId: number;
	memberNick: string;
	private _joined: boolean;

	constructor(wschat: WsChat, target: string) {
		this._wschat = wschat;
		this.target = target;
		this.members = [];

		this.memberId = 0;
		this.memberNick = '';

		this._joined = false;
	}

	sendMessage(text: string) {
		this._wschat._sendRaw({
			type: PacketType.message,
			target: this.target,
			message: text,
			time: Date.now(),
		});
	}

	getMemberById(id: number) {
		return this.members.find(x => x.member_id == id);
	}

	changeStatus(status: UserStatus) {
		this._wschat._sendRaw({
			type: PacketType.status,
			target: this.target,
			status: status,
		});
	}

	static _joined(room: Room, dt: PacketJoin) {
		room.memberId = dt.member_id;
		room.memberNick = dt.login;
	}

	static _onlineListChanged(room: Room, list: PacketStatus[], sequenceId: number) {
		for (let el of list) {
			delete el.type;
			el.typing = false;
		}
		room.members = list as UserObject[];

		if (!room._joined) {
			room._joined = true;

			if (!room._wschat._sequenceCallback(sequenceId, false, room)) {
				room._wschat.emit(WsChatEvents.joinRoom, room);
			}
		}
	}

	static _userStatusChanged(room: Room, dt: UserObject) {
		switch (dt.status) {
			case UserStatus.bad:
				break;

			case UserStatus.online:
				if (room.memberId == dt.member_id) {
					room.memberNick = dt.name;
				}

				dt.typing = false;
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

			case UserStatus.orphan:
				room.getMemberById(dt.member_id).status = UserStatus.orphan;
				break;
		}

		room._wschat.emit(WsChatEvents.userStatusChange, room, dt);
	}
}

export default WsChat;
