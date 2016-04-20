HLS Proxy
======================


API: 

* Launch a new job (streamUrl must be passed in the body. Ex: {"streamUrl": "http://........"}
```
    POST /api/v1/jobs/:id/start
```
* Mark a job as finished
```
    GET /api/v1/jobs/:id/markAsFinished
```
* Stop a job that is currently running
```
    GET /api/v1/jobs/:id/stop
```
* Get the list of jons
``` 
    GET /api/v1/jobs
```   
* Check API status. Response 500 when there is an error (S3 volume not mount); otherwise 200
``` 
    GET /api/v1/health
```    