'use strict';

var ffmpeg = require('fluent-ffmpeg');
var events = require('events');
var rimraf = require("rimraf");
var fs = require('fs');
var fsextra = require('fs.extra');
var request = require("request");
var utils = require('../utils.js');

// Duration of segments in seconds
//var HLS_SEGMENT_DURATION = 10;
var HLS_SEGMENT_FILENAME_TEMPLATE = "master.m3u8"
//var HLS_DVR_DURATION_SECONDS = 300;

// Retries during initialization phase (checking master.m3u8 exists)
var INITIALIZATION_TRY_INTERVAL = 5000;
var INITIALIZATION_MAX_ERRORS = 40;

// Retries during ffmpeg process launch 
var FFMPEG_TRY_INTERVAL = 5000;
var FFMPEG_MAX_ERRORS = 20;

// Upclose CDN Url
var UPCLOSE_CDN_URL = "https://cdn.upclose.me/";

// Filename where we will backup the stream master.m3u8
const HLS_MASTER_BACKUP_FILENAME = "/master.bck.m3u8";
const HLS_MASTER_DELETED = "/deleted/deleted.m3u8";
const HLS_MASTER_PRIVATE = "/private/private.m3u8";

// Constructor
class FFmpegJob extends events.EventEmitter {
    constructor(id, streamUrl, callbackUrl, basePath, hlsSegmentSize, hlsMaxSegments, userAgent) {
        super();

        this.id = id;
        this.streamUrl = streamUrl;
        this.callbackUrl = callbackUrl;
        this.basePath = basePath;
        this.outputFolder = basePath + "/" + this.id;
        this.manifestFile = this.outputFolder + "/" + HLS_SEGMENT_FILENAME_TEMPLATE;
        this.status = "initialized";
        this.markedAsEnded = false;
        this.markedAsStopped = false;
        this.initializationErrorCount = 0;
        this.ffmpegErrorCount = 0;
        this.hlsSegmentSize = hlsSegmentSize;
        this.hlsMaxSegments = hlsMaxSegments;
        this.processStarted = false;
        this.cmd = undefined;
        this.upcloseStreamUrl = UPCLOSE_CDN_URL + id + "/master.m3u8";
        this.userAgent = userAgent;
    }

    // start an existent job
    // First, check if the resource (m3u8 already exists). If exists, launch
    // ffmpeg process, otherwise try again 5 seconds later
    start() {
        log("Verifying stream is up...", this);
        request({ uri: this.streamUrl, method: "GET" }, (error, response, body) => {
            if (this.markedAsStopped /*|| this.markedAsEnded*/) {
                log("Stream was marked as stopped. Removed from the queue.", this);
                return;
            }

            if (!error && response.statusCode == 200) {
                log("Stream is up! Starting it....", this);
                this.internalStart();
            } else {
                this.initializationErrorCount++;
                if (this.initializationErrorCount >= INITIALIZATION_MAX_ERRORS) {
                    log("Stream is down after max retries. Finishing it", this);
                    this.signalError("InitializationError. HTTP Error code: " + (response ? response.statusCode : "Unknown"));
                } else {
                    setTimeout(
                        this.start.bind(this)
                        , INITIALIZATION_TRY_INTERVAL);
                }
            }
        });
    }

    internalStart() {
        if (this.cmd !== undefined) {
            this.status = "Started";
            // create the output folder if it doesn't exist
            try {
                fs.mkdirSync(this.outputFolder);
            } catch (e) {
                if (e.code != 'EEXIST') {
                    throw e;
                } else {
                    try {
                        this.removeAllFiles();
                        fs.mkdirSync(this.outputFolder);
                    } catch (e) {
                        this.signalError("S3Error. Desc: " + e);
                    }
                }
            }

            this.cmd.run();
        } else {
            log("Command was not set for the stream", this);
        }

    }

    // stop an existent job
    stop() {
        this.markedAsStopped = true;
        if (this.cmd !== undefined)
            this.status = "Stopping"; {
            this.cmd.kill('SIGSTOP');
            this.signalEnd();
        }
    }

    // Emit end event
    signalEnd() {
        this.emit('end');
    }

    // Emit error event
    signalError(err) {
        this.emit('errors', err);
    }

    // mark as finished
    markAsFinished() {
        this.markedAsEnded = true;
    }

    // Remove all files associated with a job
    removeAllFiles() {
        rimraf.sync(this.outputFolder);
    }
    
    getStatus() {
        // "public|private|deleted"
        return new Promise((resolve, reject) => {
            utils.readNLine(this.manifestFile, 1)
                .then((line) => {
                    console.log("Line: " + line);
                    if (line != null && line.indexOf("#type:") === 0) {
                        resolve(line.split(":")[1]);
                    } else {
                        resolve(FFmpegJobs.STATUS_PUBLIC);
                    }
                }, (err) => {
                    reject(err);
                });
            }); 
    }

    backupMasterFile() {
        return new Promise( (resolve, reject) => {
            let dst = this.outputFolder + HLS_MASTER_BACKUP_FILENAME;
            fsextra.copy(this.manifestFile, dst, { replace: true }, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    
    markAsPrivate() {
        return new Promise ((resolve, reject) => {
           this.backupMasterFile()
           .then (()=> {
               let src = this.basePath + HLS_MASTER_PRIVATE;
               console.log("Mark as private:" + src + " to " + this.manifestFile);
               fsextra.copy(src, this.manifestFile, { replace: true }, function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
           }, (err) => {
               reject(err);
           });
        });
    }
    
    markAsDeleted() {
        return new Promise ((resolve, reject) => {
           this.backupMasterFile()
           .then (()=> {
               let src = this.basePath + HLS_MASTER_DELETED;
               fsextra.copy(src, this.manifestFile, { replace: true }, function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
           }, (err) => {
               reject(err);
           });
        });
    }
    
    markAsRestored() {
        return new Promise( (resolve, reject) => {
            let src = this.outputFolder + HLS_MASTER_BACKUP_FILENAME;
            fsextra.copy(src, this.manifestFile, { replace: true }, function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

}

function FFmpegJobs() {

}

FFmpegJobs.STATUS_RUNNING = "running";
FFmpegJobs.STATUS_PUBLIC = "public";
FFmpegJobs.STATUS_PRIVATE = "private";
FFmpegJobs.STATUS_DELETED = "deleted";


// Create a new ffmpeg job
FFmpegJobs.newJob = function (id, streamUrl, callbackUrl, basePath, hlsSegmentSize, hlsMaxSegments, userAgent) {
    let job = new FFmpegJob(id, streamUrl, callbackUrl, basePath, hlsSegmentSize, hlsMaxSegments, userAgent);

    buildFfmpegCommand(job);

    return job;
}

// Build the ffmpeg command
function buildFfmpegCommand(job) {
    log("Building command. Job: " + job.manifestFile + ", Segment size: " + job.hlsSegmentSize + ", Segments: " + job.hlsMaxSegments, job);
    job.cmd = ffmpeg(job.streamUrl)
        .outputOptions([
            '-acodec copy',
            '-vcodec copy',
            '-hls_time ' + job.hlsSegmentSize,
            '-hls_list_size ' + job.hlsMaxSegments,
        ])
        .output(job.manifestFile)
        .on('error', function (err) {
            log("FFMPEG Error: " + err, job);
            // Process didn't stop, let's give some time
            // to the source to generate HLS stream...
            if (!job.processStarted) {
                job.ffmpegErrorCount++;
                log("Error detected while initializing ffmpeg process", job);

                if (job.markedAsStopped /*|| job.markedAsEnded*/) {
                    log("Stream was marked as stopped. Removed from the queue.", job);
                    return;
                }

                if (job.ffmpegErrorCount >= FFMPEG_MAX_ERRORS) {
                    log("Max initialization errors reached (ffmpeg couldn't connect)", job);
                    job.signalError("InitializationFFMPEGError. Desc: " + err);
                } else {
                    log("Relaunching ffmpeg...", job);

                    setTimeout(() => {
                        log("Rebuilding ffmpeg command and launching the process", job);
                        buildFfmpegCommand(job);
                        job.start();
                    }, FFMPEG_TRY_INTERVAL);
                }
            } else { // Error while processing the stream. Signal and finish
                if (wasKilled(err)) {
                    log("Stream stopped as requested", job);
                    job.status = "Finished";
                    job.signalEnd();
                } else {
                    log("An error occurred processing the stream, error: " + err.message, job);
                    this.status = "Errors found";
                    job.signalError("JobError. Desc: " + err);
                }
            }
        })
        .on('end', function () {

            if (!job.markedAsEnded) {
                log("Finished without being signaled as finished", job);
            } else {
                log("Finished processing stream", job);
            }
            job.status = "Finished";
            job.signalEnd();
        })
        .on('progress', function (progress) {
            if (!job.processStarted) {
                log("Generation of HLS output files started", job);

                if (job.callbackUrl !== undefined && job.callbackUrl.length > 0) {
                    request({ uri: job.callbackUrl, headers: { "User-agent": job.userAgent }, method: "POST", json: { "id": job.id, "upcloseStreamUrl": job.upcloseStreamUrl } }, (error, response, body) => {
                        log("Calling callback to notify stream started: " + job.callbackUrl, job);
                        if (error || response.statusCode != 200) {
                            job.signalError("CallbackError. Error calling callback: " + error + ", body: " + body);
                        }
                    });
                }

            }
            job.status = "In progress";
            job.processStarted = true;
        });
}

function log(message, job) {
    console.log(message + " - Stream: " + job.streamUrl + " (" + job.id + ")");
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
