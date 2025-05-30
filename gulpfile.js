const gulp = require('gulp');

function copyIcons() {
  return gulp.src('nodes/**/*.{png,svg}')
    .pipe(gulp.dest('dist/nodes'));
}

gulp.task('build:icons', copyIcons);

exports.default = gulp.series('build:icons');
