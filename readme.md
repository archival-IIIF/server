# Archival IIIF server

## Components

![](https://github.com/archival-IIIF/server/blob/master/components.png)

## Installation

Use the provided Docker Compose or the provided Ansible scripts. Or install manually:

1. Install [Node.js](https://nodejs.org/en)
1. Install [yarn](https://yarnpkg.com) or [npm](https://www.npmjs.com)
1. Install [ElasticSearch](https://www.elastic.co/webinars/getting-started-elasticsearch)
1. (Optional) Install [Redis](https://redis.io) (Required for caching, workers and/or IIIF authentication)
1. (Optional) Install IIIF image server (e.g. [Loris](https://github.com/loris-imageserver/loris))
1. (Optional) Install [pm2](https://pm2.io/runtime/)
1. Set up the configuration: (See .env.example for the environment variables)
    * Copy .env.example to .env and set up the parameters for development
    * Set up the environment variables for production
    * With PM2, [set up a config.yml file](https://pm2.io/doc/en/runtime/guide/ecosystem-file/) with the environment variables
1. `yarn install` or `npm install` (Use the `--production` flag for production with an external IIIF image server)
1. Start the application:
    * Run `yarn run start` or `npm run start`
    * With PM2: `pm2 start config.yml`

## Configuration

### Application configuration: environment variables

- `NODE_ENV`: Should be `production` in a production environment
- `IIIF_SERVER_SERVICES`: Comma separated list of services to run on this instance:
  - `web`: Sets up a **web server** and the web environment
  - `directory-watcher-changes`:  Runs a **standalone** script that watches a directory for new collections to index: when a collection has had no changes for a certain amount of time, the index is triggered
  - `directory-watcher-file-trigger`: Runs a **standalone** script that watches a directory for new collections to index: when a collection includes a trigger file, the index is triggered
  - `text-index`: Runs a **worker** that indexes texts (transcriptions, translations, etc.)
  - `iish-archivematica-index`: Runs a **worker** that indexes IISH DIPs from Archivematica
  - `iish-metadata`: Runs a **worker** that indexes IISH metadata (MARCXML / EAD)
  - `iish-metadata-update`: Runs a **cron job** that processes changes in the IISH metadata
  - `iish-access`: Loads a **library** that determines access to items for IISH collections
  - `iish-auth-texts`: Loads a **library** that provides authentication assistance texts of items from IISH collections
  - `iish-iiif-metadata`: Loads a **library** that provides IIIF metadata of items from IISH collections
- `IIIF_SERVER_SECRET`: Signed cookie key
- `IIIF_SERVER_ACCESS_TOKEN`: Access token for administrator access
- `IIIF_SERVER_ARCHIVAL_VIEWER_PATH`: Path to the Archival Viewer
- `IIIF_SERVER_UNIVERSAL_VIEWER_PATH`: Path to the Universal Viewer
- `IIIF_SERVER_UNIVERSAL_VIEWER_CONFIG_PATH`: Path to the configuration file of the Universal Viewer
- `IIIF_SERVER_IMAGE_SERVER_URL`: URL of the external IIIF image server (such as Loris)
- `IIIF_SERVER_METADATA_OAI_URL`: URL of the OAI metadata provider
- `IIIF_SERVER_METADATA_SRW_URL`: URL of the SRW metadata provider
- `IIIF_SERVER_IMAGE_TIER_SEPARATOR`: Separator character to separate between the image identifier and the image tier
- `IIIF_SERVER_CACHE_DISABLED`: Turn caching on/off (Requires Redis)
- `IIIF_SERVER_PORT`: Port to run the web server
- `IIIF_SERVER_LOGO`: Path to the image with the logo to add to the IIIF manifests
- `IIIF_SERVER_ATTRIBUTION`: Attribution to add to the IIIF manifests
- `IIIF_SERVER_BASE_URL`: The public base URL of the application
- `IIIF_SERVER_HOT_FOLDER_PATH`: The path to the hot folder where new collections to be indexed are placed
- `IIIF_SERVER_HOT_FOLDER_PATTERN`: The pattern of a file in the root of a new collection to trigger indexing
- `IIIF_SERVER_DATA_PATH`: The root path of the collections to serve
- `IIIF_SERVER_LOG_LEVEL`: The logging level
- `IIIF_SERVER_INTERNAL_IP_ADDRESSES`: If access may be granted based on IP address, provide a comma separated white list of ip addresses (Requires Redis)
- `IIIF_SERVER_LOGIN_DISABLED`: Turn login based authentication on/off (Requires Redis)
- `IIIF_SERVER_ELASTICSEARCH_URL`: URL of the ElasticSearch indexer
- `IIIF_SERVER_REDIS_DISABLED`: Turn Redis on/off
- `IIIF_SERVER_REDIS_HOST`: Host of the Redis server (Requires Redis)
- `IIIF_SERVER_REDIS_PORT`: Port of the Redis server (Requires Redis)
