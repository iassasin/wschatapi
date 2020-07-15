import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import {terser} from "rollup-plugin-terser";

const mini = process.env.MINI === '1';
const watch = process.env.WATCH === '1';

function config(patch = {}) {
	return merge({
		external: ['ws'],

		output: {
		  format: 'cjs',
		  compact: false,
		  strict: false,
		},

		watch: {
		  exclude: 'node_modules/**',
		  clearScreen: false,
		},

		plugins: [
			resolve(),
			commonjs(),
			terser(),
		],
	}, patch);
}

export default config({
	input: 'src/chat-api.js',
	output: {
		file: 'dist/chat-api-browser.js',
	}
});

function merge(base, ...others) {
	for (let other of others) {
	  for (let key in other) {
		if (!other.hasOwnProperty(key)) {
		  continue;
		}

		let val = other[key];

		if (typeof val === 'object') {
		  if (val instanceof Array) {
			if (!base.hasOwnProperty(key) || typeof base[key] !== 'object' || !(base[key] instanceof Array)) {
			  base[key] = [];
			}
		  } else {
			if (!base.hasOwnProperty(key) || typeof base[key] !== 'object') {
			  base[key] = {};
			}
		  }

		  merge(base[key], val);
		} else {
		  base[key] = val;
		}
	  }
	}

	return base;
  }