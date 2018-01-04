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
var apikeyYelp = process.env.apikeyYelp;
var apikeyEventful = process.env.apikeyEventful;


var multer = require('multer');
var upload = multer();

var app = express();
app.use(bodyParser.urlencoded({ extended: false}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

var business = new Schema({
    name: String,
    latitude: Number,
    longitude: Number,
    address: String,
    type: Object
});

var googleLazy = new Schema({
    business: Object,
    date: Date,
    place_id: String
});

var model = mongoose.model('business', googleLazy);


// max radius is 50,000m  ~36,000 business come up for a center of the eureka building
/*
googlePlacesQuery(geocode,searchRadius)
.then(result =>{
    console.log(result.length);
});
*/
//testYelpCall(1000);
//3333


var searchRadius = 30000; //distance in meters

function convertListOfCitiesToGeocodes(cities){
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

function buildListOfAllBusinesses(cities, searchRadius){
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


/*
var idealJson = new Schema{
    name: String,
    latitude: Number,
    longitude: Number,
    vicinity: String,
    address: String,
    City: String,
    Zip_Code: String,
    Country: String
}
*/
function parseBusinesses(results){
    return new Promise(resolve=>{
        var newResults = [];
        for(i=0;i<results.length;i++){
            if(i%2 == 0){
                newResults.push(JSON.parse(results[i]));
            }else{
                newResults.push(results[i]);
            }
        }
        if(newResults.length == results.length)
        resolve(newResults);
    });
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

//main();





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



"-----------------------------------------------------------------------------------------"



main();


function main(){
    var cities = ["Irvine, Ca", "San Francisco, Ca","Green Bay, WI", "Manhattan, NY", "Dallas, TX","San Jose", "Mountain View","Half Moon Bay, CA","Atlanta, GA"];
    var searchRadius = 3000; //distance in meters
    convertListOfCitiesToGeocodes(cities).then(list=>{
        console.log(list);
        for(i=0;i<list.length;i++){
            getAndStoreBusinessData(list[i],searchRadius).then(()=>{
                console.log(list.length);
                console.log("done with: " + cities[i]);
            });
        }
    });
}


function getAndStoreBusinessData(geoCode, radius){
    return new Promise(resolve=>{
        firstCall(geoCode, radius).then(allListings=>{
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
                doc.save(function(err) {
                   if (err) throw err;
                });
            }
            resolve();
        });
    });
}

function getMoreData(results){
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


function filterDuplicates(results){
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



function firstCall(geocode, radius){
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


function recursivleyCallNextToken(overallResults,next_token){
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



function googlePlacesQuery(geocode,radius){
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

function YelpPlacesQuery(geocode,radius){ // max value of radius is 40000m or 25 miles
    return new Promise(function(resolve,reject){
        const client = yelp.client(apikeyYelp);
        client.search({
          latitude: geocode.split(",")[0],
          longitude: geocode.split(",")[1],
          raduis: radius
        }).then(response => {
          resolve(response.jsonBody.businesses);
        }).catch(e => {
          reject(e);
        });
    });
}

function testEventfulCall(){ //currently waiting for a response from the eventful team for an error with their api stuff - api key request gives a 404 request
    request("http://api.eventful.com/rest/events/search?...&where=32.746682,-117.162741&within=25")
    .then(result => {
        console.log(result);
    });

}

function convertAddress(address){
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


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');


// error handler
app.get("/", function(req,res){
	res.sendfile('public/index.html');
});

app.post("/postVerve",function(req,res){// recieves data from verve and stores it into mongo
    //console.log(req.body);
    var Verve = mongoose.model('vSensors', verve);
    var verveEntry = new Verve(req.body);
    verveEntry.save(function(err) {
      if (err) res.status(500).send('{"error": "something went wrong"}');
      else res.status(201).send(JSON.stringify(req.body));
    });
});



module.exports = app;
app.listen(3000, function () {
  console.log('your app listening on port 3000!');
});


/*

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
*/
