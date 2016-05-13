'use strict';

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
        
        if ((minValue === undefined || tmp >= minVal) && 
            (maxVal === undefined || tmp <= maxVal)) {
            res = tmp;
        }
    }
    
    return res;
}


// export the class
module.exports = Utils;