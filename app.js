var express = require('express');

var path = require('path');
var bodyParser = require('body-parser');
var request = require("request-promise");
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/west');
var Schema = mongoose.Schema;
var PythonShell = require('python-shell');


var app = express();
app.use(bodyParser.urlencoded({ extended: false}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

//one({"type": "hrlyaverage", "value": numpy.average(hourValues), "timeStamp" : hourLimit})

var avgS = new Schema({
    type: String,
    value: Number,
    timeStamp: Number,
    id: Schema.Types.Mixed
});
var values = new Schema({
    type: String,
    value: Number,
    timeStamp: Number,
    id: Schema.Types.Mixed
});
var idList = new Schema({
    id: Schema.Types.Mixed
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// error handler
app.get("/", function(req,res){
	res.sendfile('public/index.html');
});

module.exports = app;
app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
});
