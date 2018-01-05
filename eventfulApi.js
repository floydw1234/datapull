require('dotenv').config();
var JSON = require('JSON');
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var request = require("request-promise");
var mongoose = require('mongoose');
var yelp = require('yelp-fusion');
var Promise = require('bluebird');
var NodeGeocoder = require('node-geocoder');

mongoose.connect('mongodb://localhost:27017/west');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log('we are connected to mongodb!');
});
var Schema = mongoose.Schema;

var PythonShell = require('python-shell');

var apikeyEventful = process.env.apikeyEventful;
var apikeyGoogleGeocoding = process.env.apikeyGoogleGeocoding;





var die = function(quitMsg)
{
    console.error(quitMsg)
    process.exit(1);
}
