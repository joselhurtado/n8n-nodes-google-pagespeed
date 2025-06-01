const { src, dest, parallel, series, task } = require('gulp');

/**
 * Copy icons to dist folder
 */
function copyIcons() {
	return src(['*.svg', '*.png', '*.jpg', '*.gif'])
		.pipe(dest('dist/'));
}

/**
 * Copy static assets to dist folder
 */
function copyAssets() {
	return src(['src/**/*.svg', 'src/**/*.png', 'src/**/*.jpg', 'src/**/*.gif'])
		.pipe(dest('dist/'));
}

/**
 * Build icons task
 */
const buildIcons = parallel(copyIcons, copyAssets);

/**
 * Export tasks
 */
exports.copyIcons = copyIcons;
exports.copyAssets = copyAssets;
exports['build:icons'] = buildIcons;
exports.default = buildIcons;