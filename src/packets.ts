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
	sequenceId: number,
};

export type Packet = PacketError | PacketSystem;

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
