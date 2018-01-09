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

var apikeyYelp = process.env.apikeyYelp;
var apikeyGoogleGeocoding = process.env.apikeyGoogleGeocoding;


var yelpSchema = new Schema({
    business: Object,
    date: Date,
    place_id: String
});

var model = mongoose.model('yelpBusinesses', yelpSchema);

var geoCode = "33.729228, -117.543850";
var cities = ["hoboken, NJ"]//"Temecula, Ca","Irvine, Ca", "San Francisco, Ca","Green Bay, WI", "Manhattan, NY", "Dallas, TX","San Jose", "Mountain View","Half Moon Bay, CA","Atlanta, GA"];

main(cities);
/*
var url = "https://api.yelp.com/v3/businesses/fob-poke-bar-seattle-2";
request(url,
    {'auth': {
    'bearer': apikeyYelp
}}).then(resp=>{
    console.log(resp);
});
*/
function main(cities){
    var promiseList = [];
    return new Promise(resolve=>{
        convertListOfCitiesToGeocodes(cities).then(geoCodes=>{
            for(i=0;i<geoCodes.length;i++){
                promiseList.push(getAndStoreBusinessData(geoCodes[i]));
            }
            Promise.all(promiseList).then(()=>{
                //die("all done");
            })
        });
    });
}

function getMoreData(list){
    var promiseList = [];
    return new Promise(resolve=>{
        for(i=0;i<list.length -1;i++){
            var url = "https://api.yelp.com/v3/businesses/" + list[i].id;
            console.log(url);

            promiseList.push(request(url,
                {'auth': {
                'bearer': apikeyYelp
            }}));
            /*
            request(url,
                {'auth': {
                'bearer': apikeyYelp
            }}).then(resp=>{
                console.log(resp);
            }).catch(err=>{
                Continue;
            });
*/

        }
        Promise.all(promiseList).then(error =>{
            if(error){
                console.log(error);
            }
            console.log(newList[4]);
            resolve(newList);
        });
    });
}


function getAndStoreBusinessData(geoCode){
    var promiseList = [];
    return new Promise(resolve=>{
        YelpPlacesQuery(geoCode).then(list=>{
            console.log(list[1]);
            return filterDuplicates(list);
        //}).then(list=>{
        //    return getMoreData(list);
        }).then(list=>{
            //console.log(list);
            for(i=0;i<list.length;i++){

                var doc = new model({
                    business: list[i],
                    date: new Date(),
                    place_id: list[i].id
                });
                //promiseList.push(doc.save());
            }
            Promise.all(promiseList).then(()=>{
                resolve();
            });
        });
    });
}




function filterDuplicates(results){ // This function makes sure that we are not duplicating any database entries. this checks the unique Id that google assigns to a business
    // against the id's in the database. If there is a match then it splices the business listing from the array so that it no longer exists
    var promiseList = [];
    return new Promise(resolve=>{
        for(i=0;i<results.length;i++){
            //console.log(i);
            //console.log(results[i].place_id);
            promiseList.push(model.findOne({'place_id': results[i].id},{}));
        }
        Promise.all(promiseList).then(list=>{
            for(i=0;i<list.length;i++){
                if(list[i] != null){
                    results.splice(i,1);
                    list.splice(i,1);
                    i--;
                }
            }
            resolve(results);
        });
    });

}


/*
function YelpPlacesQuery(geocode){ // returns a list of the businesses from Yelp with some data about them in the JSON format.
    return new Promise(function(resolve,reject){
        var latitude = geocode.split(",")[0];
        var longitude = geocode.split(",")[1];
        request("https://api.yelp.com/v3/businesses/search?location=Irvine",
            {'auth': {
            'bearer': apikeyYelp
        }}).then(resp=>{
            resolve(resp);
        });
    });
}
*/

function YelpPlacesQuery(geocode){ // returns a list of the businesses from Yelp with some data about them in the JSON format.
    return new Promise(function(resolve,reject){
        const client = yelp.client(apikeyYelp);
        client.search({
          latitude: geocode.split(",")[0],
          longitude: geocode.split(",")[1]
        }).then(response => {
          resolve(response.jsonBody.businesses);
        }).catch(e => {
          reject(e);
        });
    });
}


function convertAddress(address){ //This takes an address/searchTerm and returns a promise with the geoCode '33.6845673,-117.8265049' as a resolve
		return new Promise(function(resolve){
				  var options = {
				    provider: 'google',
				    httpAdapter: 'https', // Default
				    apiKey: apikeyGoogleGeocoding, // for Mapquest, OpenCage, Google Premier
				    formatter: null         // 'gpx', 'string', ...
				  };
				  var geocoder = NodeGeocoder(options);
				  geocoder.geocode(address)
				    .then(resp => {
				      //console.log(resp);
				      resolve(resp[0].latitude + "," + resp[0].longitude);
				    })
				    .catch(err => {
				      console.log(err);
				    });
		});
}



function convertListOfCitiesToGeocodes(cities){ // takes a list of cities, puts them through a google geocode api to return a list of geocodes
    return new Promise(function(resolve){
        var promiseList = [];
        for(i = 0; i < cities.length ; i++){
            promiseList.push(convertAddress(cities[i]));
        }
        Promise.all(promiseList).then(geocodes=>{
            resolve(geocodes);
        });
    });
}

var die = function(quitMsg)
{
    console.error(quitMsg)
    process.exit(1);
}
/*
-------original schema for yelp with comments-----------------------
var dataFormatYelp = new Schema({
    orgName: String, // easy
    address: String, //easy
    phone: String, // easy
    email: String, //not available from yelp reqeusts for scraping
    website: String, //easy
    tagLine: String, // This is not availabel from scraping
    logo: String, //not available
    photo: String, //Most have a couple of links to images so we can make this a json object with string just like how google does it
    mainCategory: String, // this is easy for yelp
    subCategories: String, // this is kindof givenn
    top5Services: String,// not provided by yelp
    description: String,// not provided by yelp
    optionalInfo: String,// not provided by yelp
    location1Name: ????
    location1Address: String, //Same as above
    location1City: String,//easy for yelp
    location1State: String,//easy for yelp
    location1Zip: Number,//easy for yelp
    location1Phone:// redundant
    location1Email:// not provided by yelp
    areasServed: // not provided by yelp
    daysOp: //  This should be included in the information below- or this could be extracted from the info below(but that is redundant)
    hoursOp: Object, // this should be formatted the way google or yelp does it in a json object with the hours for each day
    ratings: Number, //Easy
    busType: String // not provided by yelp
});

-----------proposed schema based on comments(at least everything that is available from scraping)---------------------

var dataFormatYelp = new Schema({
    orgName: String, // easy
    address: String, //easy
    phone: String, // easy
    website: String, //easy
    photo: String, //Most have a couple of links to images so we can make this a json object with string just like how google does it
    mainCategory: String, // this is easy for yelp
    subCategories: String, // this is kindof givenn
    location1Address: String, //easy for yelp
    location1City: String,//easy for yelp
    location1State: String,//easy for yelp
    location1Zip: Number,//easy for yelp
    daysOp: //  This should be included in the information below- or this could be extracted from the info below(but that is reduntant)
    hoursOp: Object, // this should be formatted the way google or yelp does it in a json object with the hours for each day
    ratings: Number, //Easy
});


/*


*/
