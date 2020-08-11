type EventCallbacks = {
	[k: string]: (...args: any[]) => any;
};

type CallbackType<T> = (T & {_origCallback?: T});

export default class EventEmitter<Events extends EventCallbacks = EventCallbacks> {

	private subscribers = {} as {
		[k in keyof Events]: CallbackType<Events[k]>[]
	};

	on<T extends keyof Events>(name: T, callback: Events[T]) {
		let subs = this.subscribers;

		if (!subs[name]) {
			subs[name] = [];
		}

		subs[name].push(callback);
	}

	once<T extends keyof Events>(name: T, callback: Events[T]) {
		let f = ((...args: any[]) => {
			this.off(name, f);
			return callback(...args);
		}) as CallbackType<Events[T]>;

		f._origCallback = callback;

		this.on(name, f);
	}

	off<T extends keyof Events>(name?: T, callback?: Events[T]) {
		let subs = this.subscribers;

		if (!name) {
			this.subscribers = {} as typeof subs;
		} else if (subs[name]) {
			subs[name] = callback ? subs[name].filter(x => x !== callback && x._origCallback != callback) : [];
		}
	}

	emit<T extends keyof Events>(name: T, ...data: Parameters<Events[T]>) {
		let subs = this.subscribers[name];
		if (subs) {
			for (let callback of subs) {
				callback(...data);
			}
		}
	}
}