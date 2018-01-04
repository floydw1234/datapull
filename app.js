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

var apikeyGooglePlaces = "AIzaSyBKXwgZdao35HxDge4AEqj1VYR5l2z-dOI";
var apikeyGoogleGeocoding = "AIzaSyBfS4LBIkk4XtD0_IvR0TRad0AVEfYazdM";
var apikeyYelp = "_LE2dOfmMJQmui2Ez8gXR4RCRm392itaMOpMBvVHxIwevwts2y7dqkjLN6-fYEc9lqaXNZUAmGtQXXqxlwAakoyv0WsgVxTEJUqG3J36OYQOUlJfVoORL2_mZ0JMWnYx";
var apikeyEventful = "LXjPQvppHPrvFstn";


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
    dateTime: Date
});

function getDateTime() {

    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + ":" + hour + ":" + min + ":" + sec;

}
// max radius is 50,000m  ~36,000 business come up for a center of the eureka building
/*
googlePlacesQuery(geocode,searchRadius)
.then(result =>{
    console.log(result.length);
});
*/
//testYelpCall(1000);
//3333

var cities = ["Irvine, Ca"];
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





function main(){
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

function storeBusinessInfo(results){
    var model = mongoose.model('business', business);

    for(i=0;i<results.length;i++){
        if(results[i].results[0].scope == "GOOGLE"){//something unique to the format of the google results so this will parse everything else correctly
            var doc = new model({
                name: results[i].results.name,
                latitude: results[i].results.geometry.location.lat,
                longitude: results[i].results.geometry.location.lng,
                address: results[i].results,
                City: results[i].results,
                Zip_Code: results[i].results,
                Country: results[i].results
            });
            doc.save(function(err) {
               if (err) throw err;
           });
        }else if(results[i].hasOwnProperty('is_closed')){//something unique to the format of the yelp results so this will parse everything else correctly
            var doc = new model({
                name: results[i].name,
                latitude: results[i].coordinates.latitude,
                longitude: results[i].coordinates.longitude,
                address: results[i].location.address1,
                City: results[i].location.city,
                Zip_Code: results[i].location.zip_code,
                Country: results[i].location.country
            });
            doc.save(function(err) {
               if (err) throw err;
           });
        }else{
            //add other providers here for using api's other than yelp and google's
        }
    }
}









function main(){
    firstCall('40.755933, -73.986929',500).then(allListings=>{
        return getMoreData(allListings);
    }).then(list => {
        var model = mongoose.model('business', googleLazy);
        for(i=0;i<list.length;i++){
            var doc = new model({
                business: JSON.parse(list[i]),
                dateTime: getDateTime()
            });
            doc.save(function(err) {
               if (err) throw err;
            });
        }
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
