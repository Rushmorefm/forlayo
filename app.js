var express = require('express');
var app = express();

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function(req, res) {
  res.send('hello world');
});


app.listen(3000, function(){
    console.log("Server listening on port %d in %s mode", 3000, app.settings.env);
});
