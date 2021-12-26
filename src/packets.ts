export const enum PacketType {
	error = 0,
	system = 1,
	message = 2,
	online_list = 3,
	auth = 4,
	status = 5,
	join = 6,
	leave = 7,
	create_room = 8,
	remove_room = 9,
	ping = 10,
}

type PacketBase = {
	type: PacketType,
	sequenceId?: number,
};

export type Packet = PacketError | PacketSystem | PacketMessage | PacketOnlineList | PacketStatus | PacketAuth
	| PacketJoin | PacketLeave | PacketCreateRoom | PacketRemoveRoom | PacketPing;

export type PacketError = PacketBase & {
	type: PacketType.error,
	source: number,
	target: string,
	code: ErrorCode,
	info: string,
}

export const enum ErrorCode {
	unknown = 0,
	database_error = 1,
	already_connected = 2,
	not_found = 3,
	access_denied = 4,
	invalid_target = 5,
	already_exists = 6,
	incorrect_loginpass = 7,
	user_banned = 8,
};

export type PacketSystem = PacketBase & {
	type: PacketType.system,
	message: string;
	target: string;
}

export const enum UserStatus {
	bad = 0,
	offline = 1,
	online = 2,
	away = 3,
	nick_change = 4,
	gender_change = 5,
	color_change = 6,
	back = 7,
	typing = 8,
	stop_typing = 9,
	orphan = 10,
}

export type PacketMessage = PacketBase & Partial<MessageObject> & {
	type: PacketType.message,
}

export type PacketOnlineList = PacketBase & {
	type: PacketType.online_list,
	target: string,
	list: PacketStatus[],
}

export type PacketStatus = PacketBase & Partial<UserObject> & {
	type: PacketType.status,
	target?: string,
}

export type PacketAuth = PacketBase & {
	type: PacketType.auth,
	user_id?: number,
	name?: string,
	ukey?: string,
	api_key?: string,
	login?: string,
	password?: string,
	token?: string,
}

export type PacketJoin = PacketBase & {
	type: PacketType.join,
	target: string,
	member_id?: number,
	login?: string,
	auto_login?: boolean,
	load_history?: boolean,
}

export type PacketLeave = PacketBase & {
	type: PacketType.leave,
	target: string,
}

export type PacketCreateRoom = PacketBase & {
	type: PacketType.create_room,
	target: string,
}

export type PacketRemoveRoom = PacketBase & {
	type: PacketType.remove_room,
	target: string,
}

export type PacketPing = PacketBase & {
	type: PacketType.ping,
}

export const enum MessageStyle {
	message = 0,
	me = 1,
	event = 2,
	offtop = 3,
}

export interface MessageObject {
	/** id сообщения, присутствует только у публичных сообщений, в лс отсутствует */
	id?: string;
	/** Цвет никнейма отправителя сообщения, любой поддерживаемый css формат цвета */
	color: string;
	/** Внутрикомнатный member_id отправителя сообщения */
	from: number;
	/** Внутрикомнатный member_id получается сообщения (0, если сообщение публичное) */
	to: number;
	/** Никнейм отправителя сообщения */
	from_login: string;
	/** Текст сообщения */
	message: string;
	/** Тип сообщения (me, do и т.п.) */
	style: MessageStyle;
	/** Название комнаты, в которую было отправлено сообщение */
	target: string;
	/** Время отправки сообщения в формате unixtime */
	time: number;
};

export interface UserObject {
	/** Цвет никнейма отправителя сообщения, любой поддерживаемый css формат цвета */
	color: string;
	/** Данные события (например, при смене никнейма содержит старый никнейм пользователя) */
	data?: string;
	/** Имеет ли пользователь имеет женский пол */
	girl: boolean;
	/** Является ли пользователь модератором комнаты */
	is_moder: boolean;
	/** Является ли пользователь создателем комнаты */
	is_owner: boolean;
	/** Внутрикомнатный member_id пользователя */
	member_id: number;
	/** Никнейм пользователя */
	name: string;
	/** Статус пользователя */
	status: UserStatus;
	/** ID аккаунта пользователя на sinair.ru (0, если пользователь не авторизирован) */
	user_id: number;
	/** Время последнего присутствия пользователя (время перехода в статус away) в формате unixtime */
	last_seen_time: number;
	/** Признак того, набирает ли пользователь сообщение в данный момент */
	typing: boolean;
}