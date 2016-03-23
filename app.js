
var express = require('express');
var app = express();
var bodyParser = require('body-parser')
var videoJobs = require('./videojob.js');

require('log-timestamp'); 

var jobs = {};
var OUTPUT_BASE_PATH = process.env.videoOutput;
if (OUTPUT_BASE_PATH === undefined || OUTPUT_BASE_PATH.length == 0) {
 OUTPUT_BASE_PATH = "./output";   
}

console.log("Output base path set in " + OUTPUT_BASE_PATH);

// Add json support (post/put with json objects)
app.use( bodyParser.json() );

// Start a new job
// curl -H "Content-Type: application/json" -X POST -d '{"streamUrl": "http://tokbox001-lh.akamaihd.net/i/8c891e94f1d240af9e71c15a29137f2c_1@392088/master.m3u8"}' localhost:3000/jobs/1231/start
app.post('/api/v1/jobs/:id/start', function(req, res) {
  var id = req.params.id;
 
  if(req.body === undefined || req.body.streamUrl === undefined) {
      console.log("Bad start request received");
      responseError(res, 500, "Stream url not provided");
  } else {
    console.log("New job. Id: " + id + ", streamUrl: " + req.body.streamUrl);
    var streamUrl = req.body.streamUrl;
    
    var job = videoJobs.newJob(id, streamUrl, OUTPUT_BASE_PATH)
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

// Launch the web server
app.listen(3000, function(){
    console.log("Server listening on port %d in %s mode", 3000, app.settings.env);
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