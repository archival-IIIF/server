# API Documentation

## Import 

````
PUT: /import
````

__Input parameters__

 * Manifest container json file (see example)
 
__Response__

 * On successful creation: `201 Created`
 * On successful update: `200 OK`
 * On error: see [error returning](#error-returning)

## Image (IIIF)

[IIIF Image API 2.1.1](http://iiif.io/api/image/2.1/)

````
GET: /iiif/image/<image_id>/info.json
GET: /iiif/image/<image_id>
````

__Input parameters__

 * [image_id](http://iiif.io/api/image/2.1/#identifier) 

__Response__

IIIF image manifast file

__Example__

 * http://example.com/iiif/image/abcd1234
 * http://example.com/iiif/image/abcd1234/info.json

---

````
GET: /iiif/image/<image_id>/<region>/<size>/<rotation>/<quality>.<format>
````

__Input parameters__

 * [image_id](http://iiif.io/api/image/2.1/#identifier) 
 * [region](http://iiif.io/api/image/2.1/#region)
 * [size](http://iiif.io/api/image/2.1/#size)
 * [rotation](http://iiif.io/api/image/2.1/#rotation)
 * [quality](http://iiif.io/api/image/2.1/#quality)
 * [format](http://iiif.io/api/image/2.1/#format)


__Response__

Image

__Example__

http://example.com/iiif/image/abcd1234/full/100,100/0/default.jpg

## Presentation (IIIF)

[IIIF Presentation API 2.1.1](http://iiif.io/api/image/2.1/)

````
GET: /iiif/manifest/<manifest_id>
````

__Input parameters__

 * [manifest_id](http://iiif.io/api/image/2.1/#identifier) 

__Response__

IIIF image manifast file

__Example__

 * http://example.com/iiif/manifest/abcd1234
 * http://example.com/iiif/manifest/abcd1234/info.json


## File


````
GET: /file/<file_id>
GET: /file/<file_id>/info.json
````

__Input parameters__

 * file_id

__Response__

file info as json

__Example__

 * http://example.com/file/abcd1234
 * http://example.com/file/abcd1234/info.json

---

````
GET: /file/<file_id>/<representation>
````


__Input parameters__

 * file_id
 * representation: original, access, preservation1, ...

__Response__

file info as json

__Example__

http://example.com/file/abcd1234/original


## Error returning

 * status: HTTP status code
 * message: Error message
 * more_info: Info url
 * type: Error type 

Example:

````json
{
    "status": 401,
    "message": "Unauthorized failed",
    "type": "AuthorizationError",
    "more_info": "http://example.com/error/authorizationError"
}
````
