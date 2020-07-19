export default class CallbackManager {
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