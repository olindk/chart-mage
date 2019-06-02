var gulp = require("gulp");
var browserSync = require("browser-sync").create();
var useref = require("gulp-useref");
var uglify = require("gulp-uglify");
var gulpIf = require("gulp-if");
var cssnano = require("gulp-cssnano");
var del = require("del");
var runSequence = require("run-sequence");
var autoPrefixer = require("gulp-autoprefixer");

gulp.task("clean:dist", function() {
	return del.sync("dist");
})

gulp.task("browserSync", function() {
	browserSync.init({
		server: {
			baseDir: "app"
		}
	})
});

gulp.task("watch", ["browserSync"], function() {
	gulp.watch("app/css/**/*.css", browserSync.reload);
	gulp.watch("app/js/**/*.js", browserSync.reload);
	gulp.watch("app/*.html", browserSync.reload);
})

gulp.task("useref", function() {
	return gulp.src("app/*.html")
		.pipe(useref())
		.pipe(gulpIf("*.js", uglify()))
		.pipe(gulpIf("*.css", autoPrefixer({ browser: [">5%"] })))
		.pipe(gulpIf("*.css", cssnano()))
		.pipe(gulp.dest("dist"))
});

gulp.task("images", function() {
	return gulp.src("app/images/**/*")
		.pipe(gulp.dest("dist/images"));
})

gulp.task("default", function(callback) {
	runSequence("clean:dist", ["useref", "images"], callback);
})