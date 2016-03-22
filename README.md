HLS Proxy
======================


API: 

* Launch a new job (streamUrl must be passed in the body. Ex: {"streamUrl": "http://........"}
```
    POST /jobs/:id/start
```
* Mark a job as finished
```
    GET /jobs/:id/markAsFinished
```
* Stop a job that is currently running
```
    GET /jobs/:id/stop
```
* Get the list of jons
``` 
    GET /jobs
```    