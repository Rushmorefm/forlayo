'use strict';

var express = require('express');
var utils = require('../utils.js');

var router = express.Router();

var s3Mount = true;

// Check if S3 filesystem is accessible
function checkHealth(req, res, next) {
  var fs = require('extfs');

  fs.isEmpty(req.appConfig.HEALTH_PATH, (empty) => {
    if (empty) {
        console.log("S3 Filesystem is not accessible!. Path: " + req.appConfig.HEALTH_PATH);
        req.ravenClient.captureMessage("HealthError. File System not accessible. Path: " + req.appConfig.HEALTH_PATH);
        utils.responseError(res, 500, "Error");  
    } else {
        utils.responseOk(res);  
    }
  });
}

// API REST to verify server status
router.get('/', checkHealth);

module.exports = router;