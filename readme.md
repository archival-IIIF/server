# Archival IIIF server

## Components

![](https://github.com/archival-IIIF/server/blob/master/doc/components/components.png)

## API Documentation

https://github.com/archival-IIIF/server/blob/master/doc/api/readme.md

## Installation

1. Install [Node.js](https://nodejs.org/en/https://nodejs.org/en/)
1. Install [yarn](https://yarnpkg.com) or [npm](https://www.npmjs.com/)
1. Install PostgreSQL
1. Initialize [manifest database table](https://github.com/archival-IIIF/server/blob/master/doc/database/create.sql) 
1. Install IIIF image server (e.g. [Loris](https://github.com/loris-imageserver/loris))
1. Copy config/config_example.js to config/config.js and set up the parameters
1. ```yarn install``` or ```npm install```
1. ```yarn run start``` or  ```npm run start```
