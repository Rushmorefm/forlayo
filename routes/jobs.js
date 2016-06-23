'use strict';

var express = require('express');
var router = express.Router();

var videoJobs = require('../services/videojob.js');
var utils = require('../utils.js');

// List of current jobs
var jobs = {};

// Return the list of jobs
function listJobs(req, res) {
    let result = Object.keys(jobs).map((key, index) => {
        return {"id":jobs[key].id, "streamUrl": jobs[key].streamUrl, "upcloseStreamUrl": jobs[key].upcloseStreamUrl, "status": jobs[key].status, "liveDelay": jobs[key].liveDelay};
    });
    utils.responseOk(res, result);
}

// Start a new job
function startJob(req, res) {
  let id = req.params.id;
  
  if (jobs[id] !== undefined) {
    console.log("I can not start a job that is already in progress!!!");
    utils.responseError(res, 500, "Stream is already in progress"); 
    return;     
  }
 
  if(req.body === undefined || req.body.streamUrl === undefined) {
      console.log("Bad start request received");
      utils.responseError(res, 500, "Stream url not provided");
  } else {
    console.log("New job. Id: " + id + ", streamUrl: " + req.body.streamUrl);
    let streamUrl = req.body.streamUrl;
    // If we are working with an Akamai stream, force a keyframe in segment boundaries
    if (streamUrl.indexOf("akamaihd.net/i/") > 0) {
        if (streamUrl.indexOf("?") > 0) {
            streamUrl = streamUrl + "&set-akamai-hls-revision=4";
        } else {
            streamUrl = streamUrl + "?set-akamai-hls-revision=4";
        }
    }
    let callbackUrl = req.body.callbackUrl;
    let job = videoJobs.newJob(id, streamUrl, callbackUrl, req.appConfig);
    jobs[id] = job;
    
    job.on("end", function() {
        console.log("Job finished!!!");    
        delete jobs[job.id];
    });
    
    job.on("errors", function(err, desc) {
        console.log("Job with errors. Removing it from the list of pending jobs!!!. Job Id: " + job.id + ". Err: " + err + ", Desc: " + desc);    
        req.ravenClient.captureMessage(err, {extra: {"err": desc, "jobId": job.id, "hlsProcessed": job.processStarted}});
        delete jobs[job.id];
    });
    
    job.on("warning", function(err) {
        console.log("Job with warning");    
        req.ravenClient.captureMessage("Warning: ", {extra: {"err": err, "jobId": job.id, "hlsProcessed": job.processStarted}});
    });
    
    job.start();
    
    utils.responseOk(res);
  }
}

// Delete all the files of a job (m3u8 and ts segments) and stop it
// in case it is still running
function deleteJob(req, res) {
  let id = req.params.id;
  console.log("Deleting job.... Id: " + id);
  
  let job = jobs[id];
  if (job !== undefined) {
      console.log("Stopped job Id: " + id);
      job.stop();   
  } else {
      job = videoJobs.newJob(id, "", "", req.appConfig);
  }
  
  job.removeAllFiles();
  
  utils.responseOk(res);
}

// Stop an existent job
function stopJob(req, res) {
  
  let id = req.params.id;
  console.log("Stopping job.... Id: " + id);
  
  let job = jobs[id];
  if (job !== undefined) {
      console.log("Stopped job Id: " + id);
      job.stop();
      utils.responseOk(res);
  } else {
      console.log("The job Id " + id + " doesn't exist"); 
      utils.responseError(res, 404, "Job " + id + "doesn't exist");
  }
}

// Mark a stream as deleted
function markAsDeleted(req, res) {
    let id = req.params.id;
    console.log("Marking as deleted the job.... Id: " + id);
    
    getStatusInternal(id, req, res)
    .then((status) => {
        if (status !== videoJobs.STATUS_DELETED && status !== videoJobs.STATUS_RUNNING) {
            let job = videoJobs.newJob(id, "", "", req.appConfig);
            job.markAsDeleted()
            .then (() => {
                utils.responseOk(res);
            }, (err) => {
                console.log("Job " + id + ", stream couldn't be marked as deleted");
                req.ravenClient.captureMessage("JobStatusError. Job Delete", {extra: {"err": err, "jobId": id}});
                utils.responseError(res, 400, err);
            });
        } else {
            console.log("Job " + id + ", can not not change status to deleted due to current status is " + status);
            //req.ravenClient.captureMessage("JobStatusError. Job Delete can not not change status to deleted due to current status is " + status, {extra: {"jobId": id}});
            utils.responseError(res, 400, "Can not not change status to deleted due to current status is " + status);
        }    
    }, (err) => {
        console.log("Error in markAsDeleted. " + err);
        req.ravenClient.captureMessage("JobStatusError. Job marking as deleted.", {extra: {"err": err, "jobId": id}});
        utils.responseError(res, 400, err);
    }); 
}

// Mark a stream as private
function markAsPrivate(req, res) {
    let id = req.params.id;
    console.log("Marking as private the job.... Id: " + id);
   
    getStatusInternal(id, req, res)
    .then((status) => {
        if (status !== videoJobs.STATUS_PRIVATE && status !== videoJobs.STATUS_RUNNING) {
            let job = videoJobs.newJob(id, "", "", req.appConfig);
            job.markAsPrivate()
            .then (() => {
                utils.responseOk(res);
            }, (err) => {
                console.log("Job " + id + ", stream couldn't be marked as private");
                req.ravenClient.captureMessage("JobStatusError. Stream couldn't be marked as private", {extra: {"err": err, "jobId": id}});
                utils.responseError(res, 400, err);
            });
        } else {
            console.log("Job " + id + ", can not not change status to private due to current status is " + status);
            //req.ravenClient.captureMessage("JobStatusError. Can not not change status to private due to current status is " + status, {extra: {"jobId": id}});
            utils.responseError(res, 400, "Can not not change status to private due to current status is " + status);
        }    
    }, (err) => {
        console.log("Error in markAsPrivate. " + err);
        req.ravenClient.captureMessage("JobStatusError. Marking as private.", {extra: {"err": err, "jobId": id}});
        utils.responseError(res, 400, err);
    });
}

// Remove deleted/privated flags of a stream
function markAsRestored(req, res) {
    let id = req.params.id;
    console.log("Marking as public the job.... Id: " + id);
    
    getStatusInternal(id, req, res)
    .then((status) => {
        if (status === videoJobs.STATUS_PRIVATE || status === videoJobs.STATUS_DELETED) {
            let job = videoJobs.newJob(id, "", "", req.appConfig);
            job.markAsRestored()
            .then (() => {
                utils.responseOk(res);
            }, (err) => {
                console.log("JobStatusError. Job " + id + ", stream couldn't be restored");
                req.ravenClient.captureMessage("JobStatusError. Stream couldn't be restored", {extra: {"err": err, "jobId": id}});
                utils.responseError(res, 400, err);
            });
            
        } else {
            console.log("Job " + id + ", can not not change status to restored due to current status is neither private nor deleted");
            //req.ravenClient.captureMessage("JobStatusError. Can not not change status to restored due to current status is neither private nor deleted", {extra: {"jobId": id}});
            utils.responseError(res, 400, "Can not not change status to restored due to current status is neither private nor deleted");
        }    
    }, (err) => {
        console.log("Error in markAsRestoredin. " + err);
        req.ravenClient.captureMessage("JobStatusError. Marking as restored.", {extra: {"err": err, "jobId": id}});
        utils.responseError(res, 400, err);
    });
}

// Return the status of a job
function getStatus(req, res) {
    let id = req.params.id;
    console.log("Getting status of the job.... Id: " + id);
    
    getStatusInternal(id, req, res)
    .then((status) => {
        utils.responseOk(res, status);
    }, (err) => {
        req.ravenClient.captureMessage("JobStatusError. While getting status.", {extra: {"err": err, "jobId": id}});
        utils.responseError(res, 404, err);
    });
}

function getStatusInternal(id, req, res) {
    let job = jobs[id];
    
    return new Promise((resolve, reject) => {
        if (job !== undefined) {
            // If we have a reference to the job,then it is running
            resolve(videoJobs.STATUS_RUNNING);
        } else {
            job = videoJobs.newJob(id, "", "", req.appConfig);    
                    
            job.getStatus().
            then ((status) => {
                resolve(status);
            }, (err) => {
                reject(err);
            })
        }
    });
}

/** ROUTES */
// Get the list of jobs
router.get('/', listJobs);

// Start a new job
// curl -H "Content-Type: application/json" -X POST -d '{"streamUrl": "http://tokbox001-lh.akamaihd.net/i/8c891e94f1d240af9e71c15a29137f2c_1@392088/master.m3u8"}' localhost:3000/api/v1/jobs/1231
router.post('/:id', startJob);
router.post('/:id/start', startJob);

// Delete all the files of a job (m3u8 and ts segments) and stop it
// in case it is still running
router.delete('/:id', deleteJob);

// Stop an existent job
router.get('/:id/stop', stopJob);

// Mark a stream as deleted
router.get('/:id/delete', markAsDeleted);

// Mark a stream as private
router.get('/:id/private', markAsPrivate);

// Remove deleted/privated flags of a stream
router.get('/:id/restore', markAsRestored);

// Remove deleted/privated flags of a stream
router.get('/:id/status', getStatus);

module.exports = router;