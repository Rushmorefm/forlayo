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
* Mark a finished job as deleted. Response 404 when job doesn't exist or it is not finished; otherwise 200 
``` 
    GET /api/v1/jobs/:id/delete
```    
* Mark a finished job as private. Response 404 when job doesn't exist or it is not finished; otherwise 200
``` 
    GET /api/v1/jobs/:id/private
```    
* Restore a job that was previously marked as deleted or private. Response 404 when job doesn't exist or it is not delete or finished; otherwise 200
``` 
    GET /api/v1/jobs/:id/restore
```
* Stop a job in case it is running and delete all its files. Take care using this method!!!!
``` 
    DELETE /api/v1/jobs/:id
```        
* Get the list of jobs
``` 
    GET /api/v1/jobs
```   
* Check API status. Response 500 when there is an error (S3 volume not mount); otherwise 200
``` 
    GET /api/v1/health
```    