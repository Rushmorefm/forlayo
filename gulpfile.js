var gulp = require('gulp'),
    spawn = require('child_process').spawn,
    node;

gulp.task('run', function() {
  if (node) {
      node.kill()
  }
  
  node = spawn('node', ['app.js'], {stdio: 'inherit'})
  node.on('close', function (code) {
    if (code === 8) {
      gulp.log('Error detected, waiting for changes...');
    }
  });
});

gulp.task('default', ["run"]);

// clean up if an error goes unhandled.
process.on('exit', function() {
    if (node) {
        node.kill()
    }
});
