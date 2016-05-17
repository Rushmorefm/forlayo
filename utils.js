'use strict';
var fs = require('fs');

function Utils() {
    
}

// Api OK response
Utils.responseOk = function(res, result) {
    if (result === undefined) {
        res.status(200).json({"errorCode": 0, "result": "OK"});
    } else {
        res.status(200).json({"errorCode": 0, "result": result});
    }
}

// API error response
Utils.responseError = function(res, errorCode, errorMessage) {
    res.status(errorCode).json({"errorCode": errorCode, "result": errorMessage});
}

// Read an integer config parameter
Utils.readIntConfigParam = function(envVar, defaultVal, minVal, maxVal) {
    let res = defaultVal;
    if (envVar !== undefined && !isNaN(envVar)) {
        let tmp = parseInt(envVar);
        
        if ((minVal === undefined || tmp >= minVal) && 
            (maxVal === undefined || tmp <= maxVal)) {
            res = tmp;
        }
    }
    
    return res;
}


Utils.readNLine = function (filePath, n) {
    return new Promise((resolve, reject) => {
        let stream = fs.createReadStream(filePath, {
            flags: 'r',
            encoding: 'utf-8',
            fd: null,
            mode: '0666',
            bufferSize: 1024
        });

        let fileData = "";
        stream.on('data', function(data) {
            fileData += data;
            let lines = fileData.split('\n');
            if (lines.length >= n){
                stream.destroy();
                resolve(lines[n]);
            } else {
                // Add this else condition to remove all unnecesary data from the variable
                fileData = Array(lines.length).join('\n');
            }
        });

        stream.on('error', function(err) {
            reject(err);
        });

        stream.on('end', function() {
            resolve(null);
        });
    });
   
};

// export the class
module.exports = Utils;