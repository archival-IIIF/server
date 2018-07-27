# Archival IIIF server

## Components

![](https://github.com/archival-IIIF/server/blob/iish/doc/components/components.png)

## Installation

Use the provided Docker Compose or the provided Ansible scripts. Or install manually:

1. Install [Node.js](https://nodejs.org/en/https://nodejs.org/en/)
1. Install [yarn](https://yarnpkg.com) or [npm](https://www.npmjs.com/)
1. Install Redis
1. Install PostgreSQL
1. Initialize [manifest database table](https://github.com/archival-IIIF/server/blob/master/doc/database/create.sql) 
1. (Optional) Install IIIF image server (e.g. [Loris](https://github.com/loris-imageserver/loris))
1. (Optional) Install [pm2](https://pm2.io/runtime/)
1. Set up the configuration: (See .env.example for the environment variables)
    * Copy .env.example to .env and set up the parameters for development
    * Set up the environment variables for production
    * With PM2, [set up a config.yml file](https://pm2.io/doc/en/runtime/guide/ecosystem-file/) with the environment variables
1. `yarn install` or `npm install` (Use the `--production` flag for production with an external IIIF image server)
1. Start the application:
    * Run `yarn run start` or  `npm run start`
    * With PM2: `pm2 start config.yml`
