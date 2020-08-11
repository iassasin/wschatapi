import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import alias from '@rollup/plugin-alias';
import {terser} from "rollup-plugin-terser";
import ttypescript from 'ttypescript';

const production = process.env.NODE_ENV === 'production';

function config(patch = {}) {
	let {alias: aliases, ...other} = patch;
	let optinalPlugins = [];

	if (production) {
		optinalPlugins.push(terser({
			compress: {
				ecma: 2018,
				// inline: 3, // max
				passes: 2,
				unsafe_methods: true, // f: function(){} -> f(){}
				warnings: true,
			},

			mangle: {
				properties: {
					regex: /^_\w/,
				},
			}
		}));
	}

	return merge({
		output: {
			compact: false,
			strict: false,
			exports: 'named', // doesn't works with typescript and commonjs plugins
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
				typescript: ttypescript,
			}),
			alias({entries: aliases}),
			resolve(),
			...optinalPlugins,
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
		{find: 'ws', replacement: __dirname + '/src/ws-browser.ts'}
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