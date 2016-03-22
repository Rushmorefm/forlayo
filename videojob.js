var ffmpeg = require('fluent-ffmpeg');
var events = require('events');
var rimraf = require("rimraf");
var fs = require('fs')
var request = require("request");


// Duration of segments in seconds
var HLS_SEGMENT_DURATION = 10;
var HLS_SEGMENT_FILENAME_TEMPLATE = "master.m3u8"
var HLS_DVR_DURATION_SECONDS = 300;

var INITIALIZATION_TRY_INTERVAL = 5000;
var INITIALIZATION_MAX_ERRORS = 100;

// Constructor
function FFmpegJob(id, streamUrl, basePath) {  
  this.id = id;
  this.streamUrl = streamUrl;
  this.outputFolder = basePath + "/" + this.id;
  this.manifestFile = this.outputFolder + "/" + HLS_SEGMENT_FILENAME_TEMPLATE;
  this.status = "initialized";
  this.markedAsEnded = false;
  this.markedAsStopped = false;
  this.initializationErrorCount = 0;
  this.cmd = undefined;
  events.EventEmitter.call(this);
}

// Prepare class for emitting events
FFmpegJob.prototype.__proto__ = events.EventEmitter.prototype;

// start an existent job
// First, check if the resource (m3u8 already exists). If exists, launch
// ffmpeg process, otherwise try again 5 seconds later
FFmpegJob.prototype.start = function() {
    var self = this;
    log("Verifying stream is up...", this);
    request({uri: this.streamUrl, method: "GET"}, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            log("Stream is up! Starting it....", self);
            self.internalStart();
        } else {
            self.initializationErrorCount++;
            if ( self.initializationErrorCount >= INITIALIZATION_MAX_ERRORS || self.markedAsStopped ) {
                log("Stream is down after max retries. Finishing it", self);
                self.signalError(error);
            } else {
                setTimeout(function() {
                    self.start();
                    }, INITIALIZATION_TRY_INTERVAL);
            }
        }
    });
};

FFmpegJob.prototype.internalStart = function() {
    if (this.cmd !== undefined) {
        this.status = "Started";
        // create the output folder if it doesn't exist
        try {
            fs.mkdirSync(this.outputFolder);
        } catch(e) {
            if ( e.code != 'EEXIST' ) {
                throw e;
            } else {
                this.removeAllFiles();
                fs.mkdirSync(this.outputFolder);
            }
        }
             
        this.cmd.run();
    } else {
       log("Command was not set for the stream", this);
    }
    
};

// stop an existent job
FFmpegJob.prototype.stop = function() {
    this.markedAsStopped = true;
    if (this.cmd !== undefined) 
        this.status = "Stopping";{
        this.cmd.kill('SIGSTOP');
        this.signalEnd();
    }
};

// Emit end event
FFmpegJob.prototype.signalEnd = function() {
    this.emit('end');
};

// Emit error event
FFmpegJob.prototype.signalError = function(err) {
    this.emit('errors', err);
};

// mark as finished
FFmpegJob.prototype.markAsFinished = function() {
    this.markedAsEnded = true;
};

// Remove all files associated with a job
FFmpegJob.prototype.removeAllFiles = function() {
    rimraf.sync(this.outputFolder);
};

function FFmpegJobs() {
    
}
// Create a new ffmpeg job
FFmpegJobs.newJob = function(id, streamUrl, basePath) {
  var job = new FFmpegJob(id, streamUrl, basePath);  
  
  job.cmd = ffmpeg(streamUrl)
    .outputOptions([
        '-acodec copy',
        '-vcodec copy',
        '-hls_time ' + HLS_SEGMENT_DURATION,
        '-hls_list_size ' + Math.round(HLS_DVR_DURATION_SECONDS / HLS_SEGMENT_DURATION),
        //'-f segment',
        //'-segment_format mpegts',
        //'-segment_list_type m3u8',
        //'-segment_list master.m3u8'
        ])
    .output(job.manifestFile)
    .on('error', function(err) {
        if (wasKilled(err)) {
            log("Stream stopped as requested", job);
            job.status = "Finished";
            job.signalEnd();
        } else {
            log("An error occurred processing the stream, error: " + err.message, job);
            this.status = "Errors found";
            job.signalError(err);
        }
    })
    .on('end', function() { 
        
        if (!job.markedAsEnded) {
            log("Finished without being signaled as finished", job);
        } else {
            log("Finished processing stream", job);
        }
        job.status = "Finished";
        job.signalEnd();
    })
    .on('progress', function(progress) { 
         job.status = "In progress";
    });
    
    return job;
}

function log(message, job) {
    console.log(message + ", Stream: " + job.streamUrl + " (" + job.id + ")");
}

// Return true if the 
function wasKilled(err) {
    if (err !== undefined && err.message === "ffmpeg was killed with signal SIGKILL") {
        return true;
    }
    return false;
}

// export the class
module.exports = FFmpegJobs;