import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import {terser} from "rollup-plugin-terser";

const mini = process.env.MINI === '1';
const watch = process.env.WATCH === '1';

function config(patch = {}) {
	let {alias: aliases, ...other} = patch;
	return merge({
		output: {
			compact: false,
			strict: false,
			// exports: 'default', // doesn't works with typescript and commonjs plugins
			interop: false,
			esModule: false,
			externalLiveBindings: false,
		},

		watch: {
		  exclude: 'node_modules/**',
		  clearScreen: false,
		},

		plugins: [
			typescript({

			}),
			alias({entries: aliases}),
			resolve({browser: false}),
			commonjs({extensions: ['.js', '.ts']}),
			terser({
				compress: {
					ecma: 2017,
					// inline: 3, // max
					passes: 2,
					unsafe_methods: true, // f: function(){} -> f(){}
					warnings: true,
				},
			}),
		],
	}, other);
}

export default [config({
	external: ['ws'],
	input: 'src/api.ts',
	output: {
		format: 'cjs',
		file: 'dist/chat-api-node.js',
	},
}), config({
	input: 'src/api.ts',
	output: {
		format: 'cjs',
		file: 'dist/chat-api-browser.js',
	},

	alias: [
		{find: 'ws', replacement: __dirname + '/src/ws/browser.js'}
	],
})];

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