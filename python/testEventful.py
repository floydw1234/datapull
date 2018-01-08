import eventful
import pymongo
import datetime

client = pymongo.MongoClient("localhost", 27017)
db = client.west

collection = db.eventfulevents

api = eventful.API('LXjPQvppHPrvFstn')

# If you need to log in:
# api.login('username', 'password')
counter = 0

events = api.call('/events/search', q='music', l='San Francisco')
for event in events['events']['event']:
    print "%s" % (event['city_name'])
    collection.insert_one({"event": event,"date": datetime.datetime.now(),"title": event['title']})

    counter += 1
    print counter
    print"---------------------------------------------\n"


"""
{'olson_path': 'America/New_York', 'recur_string': None, 'image': None, 'modified': '2017-12-26 22:50:32', 'postal_code': '30643', 'owner': 'evdb', 'geocode_type': 'EVDB Geocoder', 'id': 'E0-001-108637459-0', 'link_count': None, 'region_name': 'Georgia', 'country_abbr': 'USA', 'going_count': None, 'venue_id': 'V0-001-003984905-5', 'region_abbr': 'GA', 'privacy': '1', 'venue_address': 'Depot Street', 'venue_display': '1', 'created': '2017-11-13 01:52:17', 'tz_country': None, 'comment_count': None, 'going': None, 'stop_time': None, 'venue_name': 'High Cotton Music Hall', 'country_name': 'United States', 'watching_count': None, 'country_abbr2': 'US', 'description': u' $20 in advance, $25 at the door www.randallbramblett.com Randall Bramblett may be known for writing for and playing on stage with rock\u2019s legends like Bonnie Raitt, The Allman Brothers Band, Steve Winwood and Widespread Panic, but it\u2019s Bramblett\u2019s own career as frontman where his artistry is in full display. He continues his storied four decade career with continual reinvention and true conviction on his 11th album, &quot;Juke Joint at the Edge of the World&quot;\xa0on New West Records was released July 7th, 2017.Conjuring equal parts Tom Waits, Ray Charles, William Burroughs, and hallelujah chorus, his music again comes alive on this collection. The live show is thoroughly vibrant, with a top shelf band who command the stage and connect with the audience. With a commitment to the necessary mutation of music, Bramblett has kept his solo career as fresh as the day it began. And he\u2019s still in demand to create with the legends of rock, both on stage and lyrically. Reason #528 he is considered Georgia\u2019s Musical Treasure. \xa0\xa0\u201cYou can\u2019t do better than Randall Bramblett.\u201d\xa0\xa0Bonnie Raitt \xa0\u201cOne of the South\u2019s most lyrical and literate songwriters.\u201d\xa0\xa0Rolling Stone \xa0\u201cRandall is in my opinion the most gifted & talented southern singer-songwriter musicians of the past several decades.\u201d\xa0 Chuck Leavell\xa0(Rolling Stones, Allman Brothers) \xa0\u201cRandall Bramblett is the William Faulkner of Southern music\u201d \xa0Hittin\u2019 the Note \xa0\u201cRandall is one of Georgia\u2019s musical treasures\u201d \xa0\xa0\xa0Dave Schools\xa0\u2013\xa0Widespread Panic \xa0\u201cRandall is the most talented and prolific songwriter I have the privilege of knowing.\u201d\xa0\xa0Bill Berry (R.E.M. \u201cThis is music for people who like to think, and it delves the dark side of life and emotion with amazing musicianship and skill. Randall Bramblett is a genius.\u201d \xa0Rhetta Akamatsu, Blog Critics \u201cRandall Bramblett is the William Faulkner of Southern Music.\u201d Hittin\u2019 the Note Magazine\u201cThis is a cool album that combines the vibe of a real-as-hell vintage soulman with modern musical ideas.\u201d Jambands.com Don&#39;t miss the return of Randall and his fabulaous band to High Cotton Music Hall!\xa0This is a favorite show with our audiences, and a sellout would not be unusal - get you tickets now!! All sales are final - No refunds or exchanges ', 'start_time': '2018-01-12 20:00:00', 'calendars': None, 'venue_url': 'http://eventful.com/hartwell/venues/high-cotton-music-hall-/V0-001-003984905-5?utm_source=apis&utm_medium=apim&utm_campaign=apic', 'latitude': '34.3518048', 'groups': None, 'city_name': 'Hartwell', 'tz_city': None, 'tz_olson_path': None, 'performers': None, 'url': 'http://eventful.com/hartwell/events/randall-bramblett-band-/E0-001-108637459-0?utm_source=apis&utm_medium=apim&utm_campaign=apic', 'tz_id': None, 'all_day': '0', 'longitude': '-82.9333535', 'calendar_count': None, 'title': 'Randall Bramblett Band'}


"""
