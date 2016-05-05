
var express = require('express');
var app = express();
var bodyParser = require('body-parser')
var videoJobs = require('./videojob.js');

require('log-timestamp'); 

var jobs = {};

var s3Mount = false;

var fs = require('extfs');

// Parse output path
var OUTPUT_BASE_PATH = process.env.videoOutput;
if (OUTPUT_BASE_PATH === undefined || OUTPUT_BASE_PATH.length == 0) {
 OUTPUT_BASE_PATH = "./output";   
}

function checkS3Mount() {
    var healthPath = OUTPUT_BASE_PATH + "/health";
    fs.isEmpty(healthPath, function (empty) {
        s3Mount = !empty;
        console.log("S3Mount: " + s3Mount + ", " + OUTPUT_BASE_PATH);
    });
}
checkS3Mount();

// Parse HLS segment size (in seconds)
var OUTPUT_VIDEO_HLS_SEGMENT_SIZE = 10;
var segmentSize = process.env.hlsSegmentSize;
if (segmentSize !== undefined && !isNaN(segmentSize)) {
    OUTPUT_VIDEO_HLS_SEGMENT_SIZE = parseInt(segmentSize);   
    if (OUTPUT_VIDEO_HLS_SEGMENT_SIZE <= 0) {
        OUTPUT_VIDEO_HLS_SEGMENT_SIZE = 10;
    }
}


// Parse max number of segments. 0 means no limit
var OUTPUT_VIDEO_MAX_SEGMENTS = 0;
var maxSegments = process.env.hlsMaxSegments;
if (maxSegments !== undefined && !isNaN(maxSegments)) {
    OUTPUT_VIDEO_MAX_SEGMENTS = parseInt(maxSegments);   
    if (OUTPUT_VIDEO_MAX_SEGMENTS < 0) {
        OUTPUT_VIDEO_MAX_SEGMENTS = 0;
    }
} 

// Server port
var SERVER_PORT = 3000;
var serverPort = process.env.hlsProxyPort;
if (serverPort !== undefined && !isNaN(serverPort)) {
    SERVER_PORT = parseInt(serverPort);   
    if (SERVER_PORT < 1024 || SERVER_PORT > 32000) {
        SERVER_PORT = 3000;
    }
} 
 

console.log("Output base path set in " + OUTPUT_BASE_PATH);
console.log("HLS Config. Max duration " + OUTPUT_VIDEO_MAX_SEGMENTS + " segments, Segment size: " + OUTPUT_VIDEO_HLS_SEGMENT_SIZE + " seconds");
// Add json support (post/put with json objects)
app.use( bodyParser.json() );

// Start a new job
// curl -H "Content-Type: application/json" -X POST -d '{"streamUrl": "http://tokbox001-lh.akamaihd.net/i/8c891e94f1d240af9e71c15a29137f2c_1@392088/master.m3u8"}' localhost:3000/api/v1/jobs/1231/start
app.post('/api/v1/jobs/:id/start', function(req, res) {
  var id = req.params.id;
  
  if (jobs[id] !== undefined) {
    console.log("I can not start a job that is already in progress!!!");
    responseError(res, 500, "Stream is already in progress"); 
    return;     
  }
 
  if(req.body === undefined || req.body.streamUrl === undefined) {
      console.log("Bad start request received");
      responseError(res, 500, "Stream url not provided");
  } else {
    console.log("New job. Id: " + id + ", streamUrl: " + req.body.streamUrl);
    var streamUrl = req.body.streamUrl;
    var callbackUrl = req.body.callbackUrl;
    
    
    var job = videoJobs.newJob(id, streamUrl, callbackUrl, OUTPUT_BASE_PATH, OUTPUT_VIDEO_HLS_SEGMENT_SIZE, OUTPUT_VIDEO_MAX_SEGMENTS);
    jobs[id] = job;
    
    job.on("end", function() {
        console.log("Job finished!!!");    
        delete jobs[job.id];
    })
    
    job.on("errors", function() {
        console.log("Job with errors. Removing it from the list of pending jobs!!!");    
        delete jobs[job.id];
    })
    
    job.start();
    
    responseOk(res);
  }
});

// Mark as finished
app.get('/api/v1/jobs/:id/markAsFinished', function(req, res) {
  var id = req.params.id;
  console.log("Marking as finished. Id: " + id);
  
  var job = jobs[id];
  if (job !== undefined) {
      job.markAsFinished();
      responseError(res, 404, "Job " + id + "doesn't exist");
  } else {
      console.log("The job Id " + id + " doesn't exist");
      responseOk(res);
  }
});

// Stop an existent job
app.get('/api/v1/jobs/:id/stop', function(req, res) {
  
  var id = req.params.id;
  console.log("Stopping job.... Id: " + id);
  
  var job = jobs[id];
  if (job !== undefined) {
      console.log("Stopped job Id: " + id);
      job.stop();
      responseOk(res);
  } else {
      console.log("The job Id " + id + " doesn't exist"); 
      responseError(res, 404, "Job " + id + "doesn't exist");
  }
});

// Return the list of jobs
app.get('/api/v1/jobs', function(req, res) {
    var result = Object.keys(jobs).map(function(key, index) {
        return {"id":jobs[key].id, "streamUrl": jobs[key].streamUrl, "status": jobs[key].status};
    });
    responseOk(res, result);
});

app.get('/api/v1/health', function(req, res) {
    var fs = require('extfs');

    // Response as soon as possible and check s3 again to be ready for the next health request
    if (!s3Mount) {
        responseError(res, 500, "Error");
    } else {
        responseOk(res); 
    }
    
    checkS3Mount();
});

// Mark a stream as deleted
app.get('/api/v1/delete/:id', function(req, res) {
    var id = req.params.id;
    console.log("Marking as deleted the job.... Id: " + id);
    
    if (videoJobs.getStatus(id) !== "deleted") {
        
    }
    responseOk(res);
});

// Mark a stream as private
app.get('/api/v1/private/:id', function(req, res) {
    var id = req.params.id;
    console.log("Marking as private the job.... Id: " + id);
    
    if (videoJobs.getStatus(id) !== "private") {
        
    }
    responseOk(res);
});

// Remove deleted/privated flags of a stream
app.get('/api/v1/restore/:id', function(req, res) {
    var id = req.params.id;
    console.log("Marking as public the job.... Id: " + id);
    
    if (videoJobs.getStatus(id) !== "public") {
        
    }
    responseOk(res);
});


// Stop an existent job and delete all its files (m3u8 and ts segments)
app.delete('/api/v1/jobs/:id', function(req, res) {
  var id = req.params.id;
  console.log("Deleting job.... Id: " + id);
  
  var job = jobs[id];
  if (job !== undefined) {
      console.log("Stopped job Id: " + id);
      job.stop();   
  } else {
      job = videoJobs.newJob(id, "", "", OUTPUT_BASE_PATH, OUTPUT_VIDEO_HLS_SEGMENT_SIZE, OUTPUT_VIDEO_MAX_SEGMENTS);
  }
  
  job.removeAllFiles();
  
  responseOk(res);
});

app.use(function(req, res, next) {
    console.log("Sorry can't find the url: " + req.url);
  res.status(404).send('Sorry cant find that');
});

// Launch the web server
app.listen(SERVER_PORT, function(){
    console.log("Server listening on port %d in %s mode", SERVER_PORT, app.settings.env);
});

function responseOk(res, result) {
    if (result === undefined) {
        res.status(200).json({"errorCode": 0, "result": "OK"});
    } else {
        res.status(200).json({"errorCode": 0, "result": result});
    }
}

function responseError(res, errorCode, errorMessage) {
    res.status(errorCode).json({"errorCode": errorCode, "result": errorMessage});
}


// Close all the pending streams gracefully
process.on('SIGTERM', function () {
    for (var key in jobs) {
        job.stop();
    }
});