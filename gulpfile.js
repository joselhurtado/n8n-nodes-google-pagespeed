const { src, dest, parallel } = require('gulp');

/**
 * Copy icons from icons folder and root to dist folder
 */
function copyIcons() {
	return src(['icons/*.svg', 'icons/*.png', '*.svg', '*.png'], { allowEmpty: true })
		.pipe(dest('dist/'));
}

/**
 * Copy static assets from src to dist folder
 */
function copyAssets() {
	return src(['src/**/*.svg', 'src/**/*.png'], { allowEmpty: true })
		.pipe(dest('dist/'));
}

/**
 * Export tasks
 */
const buildIcons = parallel(copyIcons, copyAssets);
exports['build:icons'] = buildIcons;
exports.default = buildIcons;