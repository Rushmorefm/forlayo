
var express = require('express');
var app = express();
var bodyParser = require('body-parser')

var videoJobs = require('./videojob.js'); 

var jobs = {};
var OUTPUT_BASE_PATH = "./output";


// Add json support (post/put with json objects)
app.use( bodyParser.json() );

// Start a new job
// curl -H "Content-Type: application/json" -X POST -d '{"streamUrl": "http://tokbox001-lh.akamaihd.net/i/8c891e94f1d240af9e71c15a29137f2c_1@392088/master.m3u8"}' localhost:3000/jobs/1231/start
app.post('/api/v1/jobs/:id/start', function(req, res) {
  var id = req.params.id;
  console.log("New job. Id: " + id + ", streamUrl: " + req.body);
  
  if(req.body === undefined || req.body.streamUrl === undefined) {
      responseError(res, 500, "Stream url not provided");
  } else {
    var streamUrl = req.body.streamUrl;
    
    var job = videoJobs.newJob(id, streamUrl, OUTPUT_BASE_PATH)
    jobs[id] = job;
    
    job.on("end", function() {
        console.log("Job finished!!!");    
        delete jobs[job.id];
    })
    
    job.on("errors", function() {
        console.log("Job with errors. Removing it!!!");    
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
  } else {
      console.log("The job id " + id + " doesn't exist");
  }
  responseOk(res);
});

// Stop an existent job
app.get('/api/v1/jobs/:id/stop', function(req, res) {
  
  var id = req.params.id;
  console.log("Stop job. Id: " + id);
  
  var job = jobs[id];
  if (job !== undefined) {
      console.log("Stop job id: " + id);
      job.stop();
  } else {
      console.log("The job id " + id + " doesn't exist");
  }
  responseOk(res);
});

// Return the list of jobs
app.get('/api/v1/jobs', function(req, res) {
    responseOk(res, jobs);
});

// Launch the web server
app.listen(3000, function(){
    console.log("Server listening on port %d in %s mode", 3000, app.settings.env);
});

function responseOk(res, result) {
    if (result === undefined) {
        res.json({"errorCode": 0, "result": "OK"});
    } else {
        res.json({"errorCode": 0, "result": result});
    }
}

function responseError(res, errorCode, errorMessage) {
    res.json({"errorCode": errorCode, "result": errorMessage});
}

