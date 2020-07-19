type EventCallbacks = {
	[k: string]: (...args: any[]) => any;
};

export default class EventEmitter<Events extends EventCallbacks = EventCallbacks> {
	private subscribers = {} as {
		[k in keyof Events]: Events[k][]
	};

	on<T extends keyof Events>(name: T, callback: Events[T]) {
		let subs = this.subscribers;

		if (!subs[name]) {
			subs[name] = [];
		}

		subs[name].push(callback);
	}

	off<T extends keyof Events>(name: T, callback?: Events[T]) {
		let subs = this.subscribers;
		if (subs[name]) {
			subs[name] = callback ? subs[name].filter(x => x !== callback) : [];
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