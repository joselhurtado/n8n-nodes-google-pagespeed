const { src, dest, parallel } = require('gulp');

/**
 * Copy icons from icons folder to both dist root and node folder
 */
function copyIcons() {
	return src(['icons/*.svg', 'icons/*.png', '*.svg', '*.png'], { allowEmpty: true })
		.pipe(dest('dist/'))
		.pipe(dest('dist/nodes/GooglePageSpeed/'));
}

/**
 * Copy static assets from src to dist folder
 */
function copyAssets() {
	return src(['src/**/*.svg', 'src/**/*.png'], { allowEmpty: true })
		.pipe(dest('dist/'));
}

/**
 * Copy index.js to dist folder
 */
function copyIndex() {
	return src(['index.js'], { allowEmpty: true })
		.pipe(dest('dist/'));
}

/**
 * Export tasks
 */
const buildIcons = parallel(copyIcons, copyAssets, copyIndex);
exports['build:icons'] = buildIcons;
exports.default = buildIcons;