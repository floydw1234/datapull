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

var eventfulSchema = new Schema({
    event: Object,
    date: Date,
    title: String
});

var model = mongoose.model('eventfulEvents', eventfulSchema);



var die = function(quitMsg)
{
    console.error(quitMsg)
    process.exit(1);
}


var eventful = require('eventful-node');
var client = new eventful.Client(apikeyEventful);

client.searchEvents({ keywords: 'music' }, function(err, data){

  if(err){

    return console.error(err);

  }

  console.log('Recieved ' + data.search.total_items + ' events');

  console.log('Event listings: ');

  //print the title of each event

  var promiseList = [];
  for(i=0; i< data.search.events.event.length;i++){

    //console.log(data.search.events.event[i]);

    var doc = new model({
        event: data.search.events.event[i],
        date: new Date(),
        title: data.search.events.event[i].title
    });
    promiseList.push(doc.save());
  }
  Promise.all(promiseList).then(()=>{
      console.log("docs stored");
  });
/*D
  for(i=0;i<list.length;i++){


  }

  */

});
