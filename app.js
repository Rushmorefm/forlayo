'use strict';

var express = require('express');
var app = express();
var bodyParser = require('body-parser')

// Routes
var health = require('./routes/health.js');
var jobs = require('./routes/jobs.js');
var utils = require('./utils.js');

require('log-timestamp'); 

// Sentry setup
var raven = require('raven');

var sentryDSN = 'https://8b07943bc95049ac9ffb4b679fd57d06:7b2e4c9eb78b41fa86ae5e5dc7b82581@app.getsentry.com/77434';
if (app.settings.env === 'testing') {
    console.log("Using testing sentry dsn");
    sentryDSN = 'https://9995947dda524121b4c84b43eda83e71:6db3521c823b432c957965e11eb2f801@app.getsentry.com/78245';   
}

var ravenClient = new raven.Client(sentryDSN);

ravenClient.patchGlobal(function (p, err) {
    console.log(err);
    console.log(err.stack);
});

class Config {
    
    constructor() {
        // Version
        this.VERSION = "0.3";
        
        // HLS Proxy user agent
        this.USER_AGENT = "HLSProxy/" + this.VERSION;
        
        // Parse output path
        this.OUTPUT_BASE_PATH = process.env.videoOutput;
        if (this.OUTPUT_BASE_PATH === undefined || this.OUTPUT_BASE_PATH.length == 0) {
            this.OUTPUT_BASE_PATH = "./output";   
        }   
        
        // Parse HLS segment size (in seconds)
        this.OUTPUT_VIDEO_HLS_SEGMENT_SIZE = utils.readIntConfigParam(process.env.hlsSegmentSize, 4, 2, 8);
        

        // Parse max number of segments. 0 means no limit 
        this.OUTPUT_VIDEO_MAX_SEGMENTS = utils.readIntConfigParam(process.env.hlsMaxSegments, 0, 0, undefined);

        // Server port
        this.SERVER_PORT = utils.readIntConfigParam(process.env.hlsProxyPort, 3000, 1025, 32000);

        // Folder to check S3 health 
        this.HEALTH_PATH = this.OUTPUT_BASE_PATH + "/health"

        // Upclose API Base
        this.UPCLOSE_API_BASE_URL = process.env.upcloseAPI;
        if (this.UPCLOSE_API_BASE_URL === undefined || this.UPCLOSE_API_BASE_URL.length == 0) {
            this.UPCLOSE_API_BASE_URL = "https://api.upclose.me";   
        }   

    }
}

// App configuration
var config = new Config();
console.log("Output base path set in " + config.OUTPUT_BASE_PATH);
console.log("HLS Config. Version: " + config.VERSION + ", Max duration " + config.OUTPUT_VIDEO_MAX_SEGMENTS + " segments, Segment size: " + config.OUTPUT_VIDEO_HLS_SEGMENT_SIZE + " seconds");
console.log("Upclose API EndPoint: " + config.UPCLOSE_API_BASE_URL);

// The request handler must be the first item
app.use(raven.middleware.express.requestHandler(sentryDSN));

// Add json support (post/put with json objects)
app.use(bodyParser.json());

app.use((req, res, next) => {
    req.ravenClient = ravenClient;
    req.appConfig = config;
    next();
});

// Routes
app.use('/api/v1/health', health);
app.use('/api/v1/jobs', jobs);

app.use((req, res, next) => {
    console.log("Sorry can't find the url: " + req.url);
    res.status(404).send('Sorry cant find that');
});

// The error handler must be before any other error middleware
app.use(raven.middleware.express.errorHandler(sentryDSN));

// Launch the web server
app.listen(config.SERVER_PORT, () => {
    console.log("Server listening on port %d in %s mode", config.SERVER_PORT, app.settings.env);
});

// Close all the pending streams gracefully
process.on('SIGTERM', () => {
    for (let key in jobs) {
        job.stop();
    }
    ravenClient.captureMessage("AppClose");
});