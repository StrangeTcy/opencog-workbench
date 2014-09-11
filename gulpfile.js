/* jshint camelcase:false */
var gulp = require('gulp');
var pkg = require('./package.json');
var common = require('./gulp/common.js');
var plug = require('gulp-load-plugins')();
var env = plug.util.env;
var log = plug.util.log;

gulp.task('help', plug.taskListing);

/**
 * @desc Annotate only
 *  Mostly for show.
 *  See the output of each file?
 *      Uncomment rename, comment concat and uglify
 *  See min'd and concat'd output?
 *      Comment rename, uncomment concat and uglify,
 *      add to index.html, then run it with `gulp serve-dev`.
 */
gulp.task('ngAnnotateTest', function() {
    log('Annotating AngularJS dependencies');
    var source = [].concat(pkg.paths.js);
    return gulp
        // .src(source)
        .src(pkg.paths.client + '/app/avengers/avengers.js')
        .pipe(plug.ngAnnotate({add: true, single_quotes: true}))
        .pipe(plug.rename(function(path) {
            path.extname = '.annotated.js';
        }))
        // .pipe(plug.concat('all.min.js'))
        // .pipe(plug.uglify({mangle: true}))
        // .pipe(gulp.dest(pkg.paths.client + '/app'));
        .pipe(gulp.dest(pkg.paths.client + '/app/avengers'));
});

/**
 * @desc Lint the code
 */
gulp.task('analyze', function() {
    log('Linting the JavaScript');

    var sources = [].concat(pkg.paths.js, pkg.paths.nodejs);
    return gulp
        .src(sources)
        .pipe(plug.jshint('./.jshintrc'))
        .pipe(plug.jshint.reporter('jshint-stylish'))
        .pipe(plug.jscs('./.jscsrc'));
});

/**
 * @desc Create $templateCache from the html templates
 */
gulp.task('templatecache', function() {
    log('Creating an AngularJS $templateCache');

    return gulp
        .src(pkg.paths.htmltemplates)
        .pipe(plug.angularTemplatecache('templates.js', {
            module: 'app.core',
            standalone: false,
            root: 'app/'
        }))
        .pipe(gulp.dest(pkg.paths.stage));
});

/**
 * @desc Minify and bundle the app's JavaScript
 */
gulp.task('js', ['analyze', 'templatecache'], function() {
    log('Bundling, minifying, and copying the app\'s JavaScript');

    var source = [].concat(pkg.paths.js, pkg.paths.stage + 'templates.js');
    return gulp
        .src(source)
       // .pipe(plug.sourcemaps.init()) // get screwed up in the file rev process
        .pipe(plug.concat('all.min.js'))
        .pipe(plug.ngAnnotate({add: true, single_quotes: true}))
        .pipe(plug.bytediff.start())
        .pipe(plug.uglify({mangle: true}))
        .pipe(plug.bytediff.stop(common.bytediffFormatter))
        // .pipe(plug.sourcemaps.write('./'))
        .pipe(gulp.dest(pkg.paths.stage));
});

/**
 * @desc Copy the Vendor JavaScript
 */
gulp.task('vendorjs', function() {
    log('Bundling, minifying, and copying the Vendor JavaScript');
    return gulp.src(pkg.paths.vendorjs)
        .pipe(plug.concat('vendor.min.js'))
        .pipe(plug.bytediff.start())
        .pipe(plug.uglify())
        .pipe(plug.bytediff.stop(common.bytediffFormatter))
        .pipe(gulp.dest(pkg.paths.stage)); // + 'vendor'));
});

/**
 * @desc Minify and bundle the CSS
 */
gulp.task('css', function() {
    log('Bundling, minifying, and copying the app\'s CSS');
    return gulp.src(pkg.paths.css)
        .pipe(plug.concat('all.min.css')) // Before bytediff or after
        .pipe(plug.autoprefixer('last 2 version', '> 5%'))
        .pipe(plug.bytediff.start())
        .pipe(plug.minifyCss({}))
        .pipe(plug.bytediff.stop(common.bytediffFormatter))
//        .pipe(plug.concat('all.min.css')) // Before bytediff or after
        .pipe(gulp.dest(pkg.paths.stage + 'content'));
});

/**
 * @desc Minify and bundle the Vendor CSS
 */
gulp.task('vendorcss', function() {
    log('Compressing, bundling, copying vendor CSS');
    return gulp.src(pkg.paths.vendorcss)
        .pipe(plug.concat('vendor.min.css'))
        .pipe(plug.bytediff.start())
        .pipe(plug.minifyCss({}))
        .pipe(plug.bytediff.stop(common.bytediffFormatter))
        .pipe(gulp.dest(pkg.paths.stage + 'content'));
});

/**
 * @desc Copy fonts
 */
gulp.task('fonts', function() {
    var dest = pkg.paths.stage + 'fonts';
    log('Copying fonts');
    return gulp
        .src(pkg.paths.fonts)
        .pipe(gulp.dest(dest));
});

/**
 * @desc Compress images
 */
gulp.task('images', function() {
    var dest = pkg.paths.stage + 'content/images';
    log('Compressing, caching, and copying images');
    return gulp
        .src(pkg.paths.images)
        .pipe(plug.cache(plug.imagemin({optimizationLevel: 3})))
        .pipe(gulp.dest(dest));
});

/**
 * @desc Inject all the files into the new index.html
 * rev, but no map
 */
gulp.task('rev-and-inject',
    ['js', 'vendorjs', 'css', 'vendorcss'], function() {
        log('Rev\'ing files and building index.html');

        var minified = pkg.paths.stage + '**/*.min.*';
        var index = pkg.paths.client + 'index.html';
        var minFilter = plug.filter(['**/*.min.*', '!**/*.map']);
        var indexFilter = plug.filter(['index.html']);

        var stream = gulp
            // Write the revisioned files
            .src([].concat(minified, index)) // add all staged min files and index.html
            .pipe(minFilter) // filter the stream to minified css and js
            .pipe(plug.rev()) // create files with rev's
            .pipe(gulp.dest(pkg.paths.stage)) // write the rev files
            .pipe(minFilter.restore()) // remove filter, back to original stream
            
            // inject the files into index.html
            .pipe(indexFilter) // filter to index.html
            .pipe(inject('content/vendor.min.css', 'inject-vendor'))
            .pipe(inject('content/all.min.css'))
            .pipe(inject('vendor.min.js', 'inject-vendor'))
            .pipe(inject('all.min.js'))
            .pipe(gulp.dest(pkg.paths.stage)) // write the rev files
            .pipe(indexFilter.restore()) // remove filter, back to original stream

            // replace the files referenced in index.html with the rev'd files            
            .pipe(plug.revReplace())         // Substitute in new filenames
            .pipe(gulp.dest(pkg.paths.stage)) // write the index.html file changes
            .pipe(plug.rev.manifest()) // create the manifest (must happen last or we screw up the injection)
            .pipe(gulp.dest(pkg.paths.stage)); // write the manifest

        function inject(path, name) {
            var glob = pkg.paths.stage + path;
            var options = {
                ignorePath: pkg.paths.stage.substring(1),
                read: false
            };
            if (name) { options.name = name; }
            return plug.inject(gulp.src(glob), options);
        }
    });

/**
 * @desc Stage the optimized app
 */
gulp.task('stage',
    ['rev-and-inject', 'images', 'fonts'], function() {
        log('Staging the optimized app');

        return gulp.src('').pipe(plug.notify({
            onLast: true,
            message: 'Deployed code to stage!'
        }));
    });

/**
 * @desc Remove all files from the build folder
 * One way to run clean before all tasks is to run
 * from the cmd line: gulp clean && gulp stage
 */
gulp.task('clean', function() {
    var paths = pkg.paths.build;
    log('Cleaning: ' + plug.util.colors.blue(paths));

    return gulp
        .src(paths, {read: false})
        .pipe(plug.rimraf({force: true}));
});

/**
 * @desc Watch files and build
 */
gulp.task('watch', function() {
    log('Watching all files');

    var css = ['gulpfile.js'].concat(pkg.paths.css, pkg.paths.vendorcss);
    var images = ['gulpfile.js'].concat(pkg.paths.images);
    var js = ['gulpfile.js'].concat(pkg.paths.js);

    gulp
        .watch(js, ['js', 'vendorjs'])
        .on('change', logWatch);

    gulp
        .watch(css, ['css', 'vendorcss'])
        .on('change', logWatch);

    gulp
        .watch(images, ['images'])
        .on('change', logWatch);

    function logWatch(event) {
        log('*** File ' + event.path + ' was ' + event.type + ', running tasks...');
    }
});

/**
 * @desc Run all tests
 */
gulp.task('test-serve-midway', function() {
    log('Pre test serve');
    var testFiles = [pkg.paths.test + 'spec.mocha/*[Ss]pec.js'];
    var options = {
        script: pkg.paths.server + 'app.js',
        env: {'NODE_ENV': 'dev', 'PORT': 8888}
    };
    plug.nodemon(options);
});

/**
 * @desc Run non-midway tests
 * @example
 *    gulp test                         // Run once and then close
 *    gulp test --watch                 // Run and keep open with watch
 *    gulp test --watch --startServers  // Start servers, run, and keep open with watch
 */
 //gulp.task('test', ['test-serve-midway'], function() {
gulp.task('test', function() {
    
    if (env.startServers){
        log('Starting servers');
        var options = {
            script: pkg.paths.server + 'app.js',
            env: {'NODE_ENV': 'dev', 'PORT': 8888}
        };
        plug.nodemon(options);    
    }

    log('Running tests');
    var action = (env.watch == null || env.watch === 'run') ? 'run' : 'watch';
    var testFiles = [pkg.paths.test + 'spec.mocha/*[Ss]pec.js'];

    return gulp
        .src('./useKarmaConfAndNotThis')
        .pipe(plug.plumber())
        .pipe(plug.karma({
            configFile: pkg.paths.test + '/karma.conf.js',
//            singleRun: true,
            delay: 5,
            action: action // run (once) or watch (keep open)
        }))
        // .pipe(plug.plumber.stop())
        .on('error', function(err) {
            // failed tests cause gulp to exit
            log(err);
            throw err;
        });
});

/**
 * serve the dev environment, with debug,
 * and with node inspector
 */
gulp.task('serve-dev-debug', function() {
    serve({env: 'dev', debug: '--debug'});
    startLivereload('development');
});

/**
 * serve the dev environment, with debug-brk,
 * and with node inspector
 */
gulp.task('serve-dev-debug-brk', function() {
    serve({env: 'dev', debug: '--debug-brk'});
    startLivereload('development');
});

/**
 * serve the dev environment
 */
gulp.task('serve-dev', function() {
    serve({env: 'dev'});
    startLivereload('development');
});

/**
 * serve the staging environment
 */
gulp.task('serve-stage', function() {
    serve({env: 'stage'});
    startLivereload('stage');
});

function startLivereload(env) {
    
    //TODO: gulp-livereload is failing due to tiny-lr issue. Re-enable when fixed.

    // var path = (env === 'stage' ? [pkg.paths.stage, pkg.paths.client + '/**'] : [pkg.paths.client + '/**']);
    // var options = {auto: true};
    // plug.livereload.listen(options);
    // gulp
    //     .watch(path)
    //     .on('change', function(file) {
    //         plug.livereload.changed(file.path);
    //     });

    // log('Serving from ' + env);
}

function serve(args) {
    var options = {
        script: pkg.paths.server + 'app.js',
        delayTime: 1,
        ext: 'html js',
        env: {'NODE_ENV': args.env},
        watch: [
            'gulpfile.js', 
            'package.json',
            pkg.paths.server, 
            pkg.paths.client
        ]
    };

    if (args.debug) {
        gulp.src('', {read: false})
            .pipe(plug.shell(['node-inspector']));
        options.nodeArgs = [args.debug + '=5858'];
    }

    return plug.nodemon(options)
        //.on('change', tasks)
        .on('restart', function() {
            log('restarted!');
        });
}