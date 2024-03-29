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

var apikeyGooglePlaces = process.env.apikeyGooglePlaces;
var apikeyGoogleGeocoding = process.env.apikeyGoogleGeocoding;


var googleSchema = new Schema({
    business: Object,
    date: Date,
    place_id: String
});

var model = mongoose.model('googleBusiness', googleSchema);

33.710257, -117.753272
33.652698, -117.819131



var cities = ["Irvine, Ca","San Francisco, Ca"];//,"Green Bay, WI", "Manhattan, NY", "Dallas, TX","San Jose", "Mountain View","Half Moon Bay, CA","Atlanta, GA"];


storeCityData(cities);

// this function below does everything. pretty much my main function of the file.
function storeCityData(cities){ //Gets a list of cities, converts to geocode, then does a for loop, storing business data in the database for each city using "getAndStoreBusinessData"
    promiseList = [];
    var searchRadius = 500000; //radius of search in meters
    return new Promise(resolve=>{
        convertListOfCitiesToGeocodes(cities).then(list=>{
            return addSurroundingGeoCodes(list);
        }).then(list=>{
            console.log(list);
            for(i=0;i<list.length;i++){
                promiseList.push(getAndStoreBusinessData(list[i],searchRadius));
            }
            Promise.all(promiseList).then(()=>{
                die("all done!")
            });
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


function getAndStoreBusinessData(geoCode, radius){ // This takes geoCode, radius and stores the detailed business data into the database using the helping functions below.
    var promiseList = [];
    return new Promise(resolve=>{
        buildGoogleList(geoCode, radius).then(allListings=>{
            console.log("starting to filterDuplicates");
            return filterDuplicates(allListings);
        }).then(list => {
            console.log("starting to Get more data");
            return getMoreData(list);
        }).then(list => {
            console.log("starting saving");
            for(i=0;i<list.length;i++){
                var doc = new model({
                    business: JSON.parse(list[i]),
                    date: new Date(),
                    place_id: JSON.parse(list[i]).result.place_id
                });
                promiseList.push(doc.save());
            }
            Promise.all(promiseList).then(()=>{
                resolve();
            });

        });
    });
}

function getMoreData(results){ // This function takes the unique key from the "surface data"(data from the places search Api) and puts it through the place api to get extra info
// the info comming out of this function is incredibly detailed and includes website, lists of pics, ratings, reviews etc. returns an array of detailed data.
    var promiseList = [];
    return new Promise(resolve=>{
        for(i=0;i<results.length;i++){
            promiseList.push(request("https://maps.googleapis.com/maps/api/place/details/json?placeid=" + results[i].place_id + "&key="+apikeyGooglePlaces));
        }
        Promise.all(promiseList).then(list=>{
            resolve(list);
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
            promiseList.push(model.findOne({'place_id': results[i].place_id},{}));
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



function buildGoogleList(geocode, radius){ //this builds the list of businesses from googles places api response by calling the below function "recursivleyCallNextToken" to traverse the tokens and store the data
    var overallResults = [];
    return new Promise(resolve=>{
        googlePlacesQuery(geocode, radius)
        .then(results=>{
            for(i = 0;i<JSON.parse(results).results.length;i++){
                overallResults.push(JSON.parse(results).results[i]);

            }
            //recursivleyCallNextToken(JSON.parse(results).next_page_token)
            recursivleyCallNextToken(overallResults,JSON.parse(results).next_page_token)
            .then(()=>{
                resolve(overallResults);
            });

        });
    });
}


function recursivleyCallNextToken(overallResults,next_token){ // this is a helper function that is neccessary for the data collection from google
    // This recursivley resolves promises. This is needed because the end functoin needs to return a promise, and we are not sure when the end function will occur
    // basically this function recursivley traverses nex_page_tokens from googles responses and adds all of the data to the "overallResults" variable that it is passing as an argument/parameter
    return new Promise(resolve=>{

        if(next_token == undefined){
            resolve();
            return;
        }
        var url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=" + next_token +  "&key=" + apikeyGooglePlaces;
        setTimeout(()=>{
            request(url).then(results=>{
                for(i = 0;i<JSON.parse(results).results.length;i++){
                    overallResults.push(JSON.parse(results).results[i]);

                }
                resolve(recursivleyCallNextToken(JSON.parse(results).next_page_token));
            });
        },3000);
    });

}



function googlePlacesQuery(geocode,radius){ // returns a list of the businesses from GOOGLE with some data about them in the JSON format.
    return new Promise(function(resolve,reject){
        var url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=" + geocode +"&radius="+ radius +"&key="+ apikeyGooglePlaces;
        request(url)
        .then(function(result){
            resolve(result);
        }).catch(e => {
            reject(e);
        });
    });
}



function testEventfulCall(){ //To be implemented
    request("http://api.eventful.com/rest/events/search?...&where=32.746682,-117.162741&within=25")
    .then(result => {
        console.log(result);
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

function buildListOfAllBusinesses(cities, searchRadius){ // function that takes surface data from yelp and google places and puts it into an array --- unformated
    return new Promise(function(resolve){
        convertListOfCitiesToGeocodes(cities).then(geocodes=>{
            var promiseList = [];
            for(i = 0; i < cities.length ; i++){
                    promiseList.push(googlePlacesQuery(geocodes[i],searchRadius));
                    promiseList.push(YelpPlacesQuery(geocodes[i],searchRadius));
            }
            Promise.all(promiseList).then(results=>{
                resolve(results);
            });
        });
    });
}


function parseList(results){ // helper function for JSON.parsing the data in a list
    return new Promise(resolve=>{
        var newResults = [];
        for(i=0;i<results.length;i++){
            newResults.push(JSON.parse(results[i]));
        }
        if(newResults.length == results.length)
        resolve(newResults);
    });
}

var die = function(quitMsg)
{
    console.error(quitMsg)
    process.exit(1);
}


/*

----------------Below here lies the gode graveyard. Functions/snippets here were just useless enough to not be needed, but took enough time to make me think that
they might be worth something in the future. Most of these half work so use with extreme caution or probably not at all-------------------------------------------

function subsequentCalls(token){
    return new Promise(resolve=>{
        console.log(token);
        var url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=" + token +  "&key=" + apikeyGooglePlaces;
        setTimeout(()=>{
            request(url).then(results=>{
                for(i = 0;i<JSON.parse(results).results.length;i++){
                    globalResults.push(JSON.parse(results).results[i]);
                    console.log(i);
                }
                if(JSON.parse(results).next_page_token != undefined){
                    resolve(JSON.parse(results).next_page_token);
                }else{
                    resolve(new Promise());
                }
            });
        },3000);
    });
}
firstCall('40.755933, -73.986929',5000).then(token=>{
    return subsequentCalls(token);
}).then(token=>{
    return subsequentCalls(token);
}).catch(()=>{
    return new Promise();
}).then(()=>{
    console.log(globalResults.length);
});

setInterval(()=>{
    console.log(globalResults.length);
},3000);


function testPrintId(results){
    console.log(results.length);
    for(i=0;i<results.length;i++){
        request("https://maps.googleapis.com/maps/api/place/details/json?placeid=" + results[i].place_id + "&key="+apikeyGooglePlaces)
        .then(response=>{
            console.log(response);
            console.log("--------------------------------");
        });

    }
}



var yelpJson = { id: 'bill-barber-community-park-irvine',
  name: 'Bill Barber Community Park',
  image_url: 'https://s3-media3.fl.yelpcdn.com/bphoto/b-eP7kbTCFcKzNR90y2y6Q/o.jpg',
  is_closed: false,
  url: 'https://www.yelp.com/biz/bill-barber-community-park-irvine?adjust_creative=5CbWkzfGkndKoLoJgJLs3A&utm_campaign=yelp_api_v3&utm_medium=api_v3_business_search&utm_source=5CbWkzfGkndKoLoJgJLs3A',
  review_count: 95,
  categories: [ { alias: 'parks', title: 'Parks' } ],
  rating: 4.5,
  coordinates: { latitude: 33.6874996588192, longitude: -117.822344547658 },
  transactions: [],
  location:
   { address1: '4 Civic Center Plz',
     address2: '',
     address3: '',
     city: 'Irvine',
     zip_code: '92606',
     country: 'US',
     state: 'CA',
     display_address: [ '4 Civic Center Plz', 'Irvine, CA 92606' ] },
  phone: '+19497246714',
  display_phone: '(949) 724-6714',
  distance: 504.9263533697999
}

var googleJson = { geometry: { location: [Object], viewport: [Object] },
    icon: 'https://maps.gstatic.com/mapfiles/place_api/icons/geocode-71.png',
    id: '432c5fca2ea64a148520f0c77b0c1a47ac0dd80e',
    name: 'Westpark',
    photos: [ [Object] ],
    place_id: 'ChIJ7cySrzHc3IARSHSTK3btySI',
    reference: 'CmRbAAAAzQdwcrzwqxWUaQdQxLKaYBat_fdV3nuUz1dypQfmzKuMezixiG4w9nrO0P6meO6afiBOY9FHoC1KmBlJrcIfVDK5cVqhVVZb-LxNNS1t--neMXzyWaF2W6IyL6RjHPG-EhCQhaFUePsJIZH8BBUkjDnLGhQlrKRMX-mYF5C7_12hkJmoiqZd9w',
    scope: 'GOOGLE',
    types: [ 'neighborhood', 'political' ],
    vicinity: 'Irvine'
}



function lookupGoogleAdresses(results){
    console.log("asdf");
    var promiseList = [];
    return new Promise(resolve=>{
        for(i=0;i<results.length;i++){
            if(i%2 == 0){
                //console.log(results[i].results.length);
                for(j=0;j<results[i].results.length;j++){
                    promiseList.push(request("https://maps.googleapis.com/maps/api/geocode/json?latlng="+ results[i].results[j].geometry.location.lat +","+ results[i].results[j].geometry.location.lng +"&key="+ apikeyGoogleGeocoding));
                }
            }
        }
        Promise.all(promiseList).then(addresses=>{
            //console.log(JSON.parse(addresses[1]));
            var addressCounter = 0;
            for(i=0;i<results.length;i++){
                if(i%2 == 0){
                    for(j=0;j<results[i].results[j].lenght;j++){
                        results[i].results[j].address = JSON.parse(addresses[addressCounter]).results[0].formatted_address;
                        addressCounter++;
                    }
                }
            }
            resolve(results);
        });
    });
}
function mainOld(){
    buildListOfAllBusinesses(cities, searchRadius)
    .then(results=>{
        parseBusinesses(results).then(results=>{
            lookupGoogleAdresses(results).then(results=>{
                console.log(results[0].results.length);
                //testPrintId(results[0].results);
            });
        });

    });
}






*/
