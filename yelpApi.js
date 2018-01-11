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
var q = require('q');
var async = require('async');

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
var cities = ["Manhattan, NY"];//,"Green Bay, WI","Atlanta, GA", "Hoboken, NJ"];// can only have 5 cities right now
//var cities = ["Hoboken, NJ"];
//main(cities,500);


function main(cities,radius){
    return new Promise(resolve=>{
        buildTotalList(cities,radius).then(totalList=>{
            return uniq_fast(totalList);
        }).then(unique_list=>{
            return storeDocs(unique_list);
        }).then(()=>{
            die("all done");
        }).catch(error=>{
            console.log(error);
        });
    });
}

function buildTotalList(cities,radius){
    var promiseList = [];
    return new Promise(resolve=>{
        convertListOfCitiesToGeocodes(cities).then(geoCodes=>{
    //        return addSurroundingGeoCodes(geoCodes);
    //    }).then(geoCodes=>{
            console.log(geoCodes);
            for(i=0;i<geoCodes.length;i++){
                promiseList.push(getAndStoreBusinessData(geoCodes[i],radius));
            }
            Promise.all(promiseList).then(listings=>{
                var totalList = [];
                if(listings.length != 0) totalList = listings[0];
                for(i=1;i<listings.length;i++){
                    totalList.concat(listings[i]);
                }
                resolve(totalList);
            });
        });
    });
}

function getMoreData(list){
    var promiseList = [];
    return new Promise(resolve=>{
        for(i=0;i<list.length -1;i++){

            var url = "https://api.yelp.com/v3/businesses/" + list[i].id;
            var regexp = /^[a-zA-Z0-9-_]+$/;
            if (list[i].id.search(regexp) == -1)
                { console.log("business with id: \"" + list[i].id + "\" could not be queried(yelp can't handle accents)"); }
            else{
                promiseList.push(request(url,
                    {
                        'auth': {
                            'bearer': apikeyYelp
                            }
                    }
                    ));
            }
        }

        Promise.all(promiseList).then(newList =>{
            resolve(newList);
        });

    });
}


function getAndStoreBusinessData(geoCode,radius){
    var promiseList = [];
    return new Promise(resolve=>{
        YelpPlacesQuery(geoCode,radius).then(list=>{
            return filterDuplicates(list);
        }).then(list=>{
            return getMoreData(list);
        }).then(list=>{
            resolve(list);
        });
    });
}


function storeDocs(list){
    var promiseList = [];
    return new Promise(resolve=>{
        for(i=0;i<list.length;i++){
            var doc = new model({
                business: list[i],
                date: new Date(),
                place_id: list[i].id
            });
            promiseList.push(doc.save());
        }
        Promise.all(promiseList).then(()=>{
            resolve();
        });
    });
}


/*

*/



function filterDuplicates(results){ // This function makes sure that we are not duplicating any database entries. this checks the unique Id that google assigns to a business
    // against the id's in the database. If there is a match then it splices the business listing from the array so that it no longer exists
    var promiseList = [];
    return new Promise(resolve=>{
        for(i=0;i<results.length;i++){
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

function uniq_fast(a) {
    return new Promise(resolve=>{
        var seen = {};
        var out = [];
        var len = a.length;
        var j = 0;
        for(var i = 0; i < len; i++) {
             var item = a[i];
             if(seen[item] !== 1) {
                   seen[item] = 1;
                   out[j++] = item;
             }
        }
        resolve(out);
    });
}
/*
YelpPlacesQuery("40.7830603,-73.9712488",5000).then(result=>{
    console.log(result);
    die("all done");
});
*/

main(cities,500);

function YelpPlacesQuery(geocode, radius){ // returns a list of the businesses from Yelp with some data about them in the JSON format.
    var overallResults = [];
    return new Promise(function(resolve,reject){
        var latitude = geocode.split(",")[0];
        var longitude = geocode.split(",")[1];
        var url = "https://api.yelp.com/v3/businesses/search?latitude=" + latitude +"&longitude=" + longitude + "&radius=" + radius + "&limit=50&offset=0";
        console.log(url);
        request(url,
            {'auth': {
            'bearer': apikeyYelp
        }}).then(resp=>{
            //console.log(JSON.parse(resp).businesses.length);
            for(var i = 0; i < JSON.parse(resp).businesses.length; i++){
                overallResults.push(JSON.parse(resp).businesses[i]);
            }
            recursivleyGetNextPage(overallResults,JSON.parse(resp),50,latitude,longitude,radius).then(()=>{
                resolve(overallResults);
            });

        });
    });
}

function recursivleyGetNextPage(overallResults,result,offset,latitude,longitude,radius){
    return new Promise(resolve=>{
        if(result.businesses.length == 0 || offset > 950){
            resolve();
            return;
        }
        var url = "https://api.yelp.com/v3/businesses/search?latitude=" + latitude +"&longitude=" + longitude + "&radius=" + radius + "&limit=50&offset=" + offset;
        console.log(url);
        request(url,
            {'auth': {
            'bearer': apikeyYelp
        }}).then(resp=>{
            console.log(JSON.parse(resp).businesses.length);
            for(var i = 0; i < JSON.parse(resp).businesses.length; i++){
                overallResults.push(JSON.parse(resp).businesses[i]);
            }
            resolve(recursivleyGetNextPage(overallResults,JSON.parse(resp),offset + 50,latitude,longitude,radius));
        });

    });
}



/*
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
*/

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

function addSurroundingGeoCodes(list){
    return new Promise(resolve=>{
        var count = list.length;
        var lat;
        var lng;
        var searchRadius = 0.03;
        for(i=0;i<count;i++){
            lat = parseFloat(list[i].split(",")[0]);
            lng = parseFloat(list[i].split(",")[1]);
            lat += searchRadius;
            list.push(lat + "," + lng);
            lat -= searchRadius*2;
            list.push(lat + "," + lng);
            lat += searchRadius;
            lng += searchRadius;
            list.push(lat + "," + lng);
            lng -= searchRadius*2;
            list.push(lat + "," + lng);
        }
        resolve(list);
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
var url = "https://api.yelp.com/v3/businesses/fob-poke-bar-seattle-2";
request(url,
    {'auth': {
    'bearer': apikeyYelp
}}).then(resp=>{
    console.log(resp);
});
*/
