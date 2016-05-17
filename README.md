# HLS Proxy


API: 

* Launch a new job (streamUrl must be passed in the body. Ex: {"streamUrl": "http://........"}
```
    POST /api/v1/jobs/:id
    POST /api/v1/jobs/:id/start (available for backward compatibility)
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

## Sentry errors
Sentry Dashboard: https://app.getsentry.com/upclose/hls-proxy/dashboard

* **CallbackError**. Request to callback url failed.
* **JobError**. Job failed while streaming capture was running.
* **InitializationError**. Job failed in the initialization process. Reason: tokbox m3u8 was never available.
* **InitializationFFMPEGError**. Job failed when trying to start ffmpeg process. Reason tokbox m3u8 was available although it doesn't contain a valid HLS stream
* **S3Error**. Error while uploading files to S3.
* **HealthError**. Check health status error (backend or/and S3 volume not available).
* **JobStatusError**. Error while changing status of a job (private/delete/recovery). 