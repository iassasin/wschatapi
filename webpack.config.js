const webpack = require('webpack');
const path = require('path');

//let mode = 'development';
let mode = 'production';

module.exports = {
	target: 'web',
	mode: mode,
	entry: {
		'chat-api': './chat-api.js',
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, './dist'),
	},

	devtool: 'source-map',

	node: {
		// do not include poly fills...
		console: false,
		process: false,
		global: false,
		buffer: false,
		setImmediate: false,
		__filename: true,
		__dirname: true,
	},
};
