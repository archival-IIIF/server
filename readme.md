# Archival IIIF server

The Archival IIIF server indexes and provides [IIIF](https://iiif.io) services for digital collections. 
The server can be configured with a number of different services to index the digital collections 
and to create derivatives. 

The [IISH](https://iisg.amsterdam) (International Institute of Social History)  has created a number of services 
to index the DIPs created by [Archivematica](https://www.archivematica.org) and to give access through IIIF. 

1. [Components](#components)
1. [Services](#services)
    1. [Default services](#default-services)
    1. [Workers](#workers)
    1. [Cron jobs](#cron-jobs)
    1. [Standalones](#standalones)
    1. [Libraries](#libraries)
1. [Web API](#web-api)
    1. [IIIF Image API](#iiif-image-api)
    1. [IIIF Presentation API](#iiif-presentation-api)
    1. [IIIF Authentication API](#iiif-authentication-api)
    1. [File API](#file-api)
    1. [Admin API](#admin-api)
1. [Installation](#installation)
    1. [Docker Compose](#docker-compose)
    1. [Manual installation](#manual-installation)
1. [Configuration](#configuration)

## Components

The Archival IIIF server is composed of a web application and various service workers. 
The service workers index collections to [ElasticSearch](https://www.elastic.co/webinars/getting-started-elasticsearch), 
while the web environment gives access to the index through various [IIIF API's](https://iiif.io/technical-details). 
[Redis](https://redis.io) is used to manage the communication between various service workers 
and provides additional caching capabilities.

![](./docs/components.png)

## Services

The Archival IIIF server comes with several services that can be turned on or off using the env variable 
`IIIF_SERVER_SERVICES`. 

![](./docs/iiif-services.png)

### Default services
The `web` service runs the IIIF web environment. The `image` service runs an IIIF image server based on 
[Sharp](https://sharp.pixelplumbing.com). 

### Workers
The worker services wait for new jobs to appear in a queue in [Redis](https://redis.io). A distinction is made 
between index workers that indexes data in 
[ElasticSearch](https://www.elastic.co/webinars/getting-started-elasticsearch) and derivative workers that create 
specific derivatives of collection items. At the moment, the Archival IIIF server identifies four different types 
of worker services:
- **Index worker**: Gets a job with the path of a collection to be indexed in
[ElasticSearch](https://www.elastic.co/webinars/getting-started-elasticsearch). Current implementations:
    - `iish-archivematica-index`: A specific IISH implementation of the index worker. Indexes DIPs created by the 
    Archivematica instance of the IISH.
- **Text index worker**: Gets a job with a collection id and a list of all transcriptions/transliterations 
to be indexed in [ElasticSearch](https://www.elastic.co/webinars/getting-started-elasticsearch). 
Current implementations:
    - `text-index`: Indexes plain text files and ALTO files.
 - **Metadata index worker**: Gets a job with a collection id and/or a OAI identifier and obtains the metadata from
an OAI endpoint to be indexed in [ElasticSearch](https://www.elastic.co/webinars/getting-started-elasticsearch). 
Current implementations:
    - `iish-metadata`: Looks for and indexes metadata from the OAI service of the IISH.
 - **Waveform derivative worker**: Gets a job with a collection id and then builds waveform representations of all 
audio files of the collection with the given collection id. Current implementations:
    - `waveform`: Default implementation.

### Cron jobs
The cron job services run periodically. At the moment, the Archival IIIF server identifies one cron job:
- **Metadata update**: Checks periodically whether some metadata has to be updated. Current implementations:
    - `iish-metadata-update`: Runs daily to query the OAI service of the IISH for updates and 
    sends those to the metadata indexer.

### Standalones
The standalone services do not wait on a trigger like the workers or cron jobs. At the moment, the Archival IIIF server 
identifies one standalone service:
- **Directory watcher**: Watches a directory for any changes (new collections) and sends those to the index worker 
to be indexed. Current implementations:
    - `directory-watcher-changes`: When a directory has had no changes for a certain amount of time, 
    it is assumed that it is safe to send the directory to the index worker to be indexed.
    - `directory-watcher-file-trigger`: When a directory is updated with a specific file, it triggers the index worker 
    to be indexed.

### Libraries
The libraries are lightweight services with specific implementation details that can run together with the 
`web` service on the same running instance. At the moment, the Archival IIIF server identifies 
three different libraries:
- **Access**: Determines whether a user has (limited) access to a specific item. Current implementations:
    - `iish-access`: IISH specific implementation.
- **IIIF metadata**: Provides implementation specific IIIF metadata. Current implementations:
    - `iish-iiif-metadata`: IISH specific implementation.
- **Authentication texts**: Provides implementation specific texts to help the user with authenticating. 
Current implementations:
    - `iish-auth-texts`: IISH specific implementation.

## Web API

### IIIF Image API

_See also the [IIIF Image API 2.1](https://iiif.io/api/image/2.1/) 
and the [IIIF Image API 3.0](https://iiif.io/api/image/3.0/)_

**URL**: `/iiif/image/[id]` / `/iiif/image/[id]/logo/info.json`

**Method**: `GET`

IIIF Image API. Returns the JSON-LD description for the image with the given id.

---

**URL**: `/iiif/image/[id]/[region]/[size]/[rotation]/[quality].[format]`

**Method**: `GET`

IIIF Image API. Returns the image with the given id for the specified options.

### IIIF Presentation API

_See also the [IIIF Presentation API 2.1](https://iiif.io/api/presentation/2.1/) 
and the [IIIF Presentation API 3.0](https://iiif.io/api/presentation/3.0/)_

**URL**: `/iiif/presentation/collection/[id]`

**Method**: `GET`

IIIF Presentation API. Returns the JSON-LD description for the collection with the given id.

---

**URL**: `/iiif/presentation/[id]/manifest`

**Method**: `GET`

IIIF Presentation API. Returns the JSON-LD description for the manifest with the given id.

### IIIF Authentication API

_See also the [IIIF Authentication API](https://iiif.io/api/auth/1.0/)_

**URL**: `/iiif/auth/login`

**Method**: `GET`

IIIF login service. Shows a login screen based on an internal token store.

---

**URL**: `/iiif/auth/login`

**Method**: `POST`

**Parameters**: `token`

Checks the provided token with the internal token store.

---

**URL**: `/iiif/auth/token`

**Method**: `GET`

**Parameters**: `token`

IIIF token service.

---

**URL**: `/iiif/auth/logout`

**Method**: `GET`

IIIF logout service.

### File API

**URL**: `/file/[id]` / `/file/[id]/original` / `/file/[id]/access`

**Method**: `GET`

Provides access to the file with the given id. Explicit access to the original copy or the access copy can be provided.

---

**URL**: `/file/[id]/<derivative type>`

**Method**: `GET`

Provides access to the derivative of the given type for the file with the given id.

### Admin API

**URL**: `/index`

**Method**: `POST`

**Parameters**: `access_token`, `path`

Creates a job for the index worker to index the collection on the given path. 
Can only be used by an administrator with a valid access token.

---

**URL**: `/index_api`

**Method**: `POST`

Indexes the request body right away.
Can only be used by an administrator with a valid access token.

---

**URL**: `/register_token`

**Method**: `POST`

**Parameters**: `access_token`, `token`, `collection`, `from`, `to`

Registers a token which may give access to a specific collection for a specific period of time.
Can only be used by an administrator with a valid access token.

## Installation

Use the provided Docker Compose or install manually.

### Docker Compose

1. Decide which image server to use:
    * The application comes with a build-in image server using [Sharp](https://sharp.pixelplumbing.com). 
    Don't configure an image server URL or start a container with the `image` service to use this image server.
    * Or set up any IIIF image compliant server. 
    The docker compose comes with support for [Loris](https://github.com/loris-imageserver/loris).
1. Adapt the provided `docker-compose.yml`:
    * Clone the `web` service definition to create multiple services and use the env variable `IIIF_SERVER_SERVICES` 
    to define which services that container should run.
1. Set up volumes for the following:
    * `app-conf`: The PM2 configuration file
    * `universal-viewer-conf`: The Universal Viewer configuration file
    * `loris-conf`: The Loris configuration file (if Loris is used)
    * `data`: The volume which contains the collections to be indexed or files to be read, 
    but also allows write access for derivative creation
    * `indexes`: The volume for ElasticSearch indexes to be stored
    * `redis-persistance`: The volume for Redis storage
1. Set up the configuration (See .env.example for the example configuration)
   * [Set up a config.yml file](https://pm2.io/doc/en/runtime/guide/ecosystem-file/) with the environment variables
   * [Configure Loris](https://github.com/loris-imageserver/loris/blob/development/doc/configuration.md) 
   Especially the `src_img_root` configuration should point to the `data` volume
   * [Configure Universal Viewer](https://github.com/UniversalViewer/universalviewer/wiki/Configuration)

### Manual installation

1. Decide which image server to use:
    * The application comes with a build-in image server using [Sharp](https://sharp.pixelplumbing.com). 
    Don't configure an image server URL or start the `image` service to use this image server.
    * Or set up any IIIF image compliant server.
1. Install
    * [Node.js 10.x LTS](https://nodejs.org/en)
    * [yarn](https://yarnpkg.com) or [npm](https://www.npmjs.com)
    * [ElasticSearch 7.3.x](https://www.elastic.co/webinars/getting-started-elasticsearch)
    * (Optional) [Redis 5.x](https://redis.io) (Required for caching, workers and/or IIIF authentication)
    * (Optional) IIIF image server (e.g. [Loris](https://github.com/loris-imageserver/loris))
    * (Optional) [pm2](https://github.com/Unitech/pm2) (Required for managing the processes)
1. Install optional dependencies for derivative creation
    * [audiowaveform](https://github.com/bbc/audiowaveform) (Required by the `waveform` service)
1. Set up the configuration (See .env.example for the example configuration)
    * Copy .env.example to .env and set up the parameters for development
    * Set up the environment variables for production
    * With PM2, [set up a config.yml file](https://pm2.io/doc/en/runtime/guide/ecosystem-file/) 
    with the environment variables
1. `yarn install` or `npm install` (Use the `--production` flag for production with an external IIIF image server)
1. Start the application:
    * Run `yarn run start` or `npm run start`
    * With PM2: `pm2 start config.yml`

## Configuration

The environment variables used to configure the application:

- `NODE_ENV`: Should be `production` in a production environment
- `IIIF_SERVER_SERVICES`: Comma separated list of services to run on this instance:
    - General services:
        - `web`: Sets up a **web server** and the web environment
        - `image`: Sets up an **IIIF image server** using [Sharp](https://sharp.pixelplumbing.com)
        - `directory-watcher-changes`:  Runs a **standalone** script that watches a directory for new collections 
        to index: when a collection has had no changes for a certain amount of time, the index is triggered
        - `directory-watcher-file-trigger`: Runs a **standalone** script that watches a directory for new collections 
        to index: when a collection includes a trigger file, the index is triggered
        - `text-index`: Runs a **worker** that indexes texts (transcriptions, translations, etc.)
    - Derivative services:
        - `waveform`: Runs a **worker** that creates waveforms from audio files
    - IISH specific services:
        - `iish-archivematica-index`: Runs a **worker** that indexes IISH DIPs from Archivematica
        - `iish-metadata`: Runs a **worker** that indexes IISH metadata (MARCXML / EAD)
        - `iish-metadata-update`: Runs a **cron job** that processes changes in the IISH metadata
        - `iish-access`: Loads a **library** that determines access to items for IISH collections
        - `iish-auth-texts`: Loads a **library** that provides authentication assistance texts 
        of items from IISH collections
        - `iish-iiif-metadata`: Loads a **library** that provides IIIF metadata of items from IISH collections
- `IIIF_SERVER_SECRET`: Signed cookie key
- `IIIF_SERVER_ACCESS_TOKEN`: Access token for administrator access
- `IIIF_SERVER_ARCHIVAL_VIEWER_PATH`: Path to the Archival Viewer
- `IIIF_SERVER_UNIVERSAL_VIEWER_PATH`: Path to the Universal Viewer
- `IIIF_SERVER_UNIVERSAL_VIEWER_CONFIG_PATH`: Path to the configuration file of the Universal Viewer
- `IIIF_SERVER_IMAGE_SERVER_URL`: URL of the external IIIF image server (such as Loris)
- `IIIF_SERVER_IMAGE_SERVER_NAME`: Name of the image server (either 'loris' or 'sharp')
- `IIIF_SERVER_METADATA_OAI_URL`: URL of the OAI metadata provider
- `IIIF_SERVER_METADATA_SRW_URL`: URL of the SRW metadata provider
- `IIIF_SERVER_IMAGE_TIER_SEPARATOR`: Separator character to separate between the image identifier and the image tier
- `IIIF_SERVER_CACHE_DISABLED`: Turn caching on/off (Requires Redis)
- `IIIF_SERVER_PORT`: Port to run the web server
- `IIIF_SERVER_ATTRIBUTION`: Attribution to add to the IIIF manifests
- `IIIF_SERVER_BASE_URL`: The public base URL of the application
- `IIIF_SERVER_HOT_FOLDER_PATH`: The path to the hot folder where new collections to be indexed are placed
- `IIIF_SERVER_HOT_FOLDER_PATTERN`: The pattern of a file in the root of a new collection to trigger indexing
- `IIIF_SERVER_DATA_ROOT_PATH`: The root path of the data storage
- `IIIF_SERVER_COLLECTIONS_REL_PATH`: The relative path of the (read-only) collections under the data storage root path
- `IIIF_SERVER_LOGO_REL_PATH`: The relative path to the image with the logo to add to the IIIF manifests
- `IIIF_SERVER_LOGO_DIM`: The dimensions of the logo, separated by a ':'
- `IIIF_SERVER_LOG_LEVEL`: The logging level
- `IIIF_SERVER_INTERNAL_IP_ADDRESSES`: If access may be granted based on IP address, 
provide a comma separated white list of ip addresses (Requires Redis)
- `IIIF_SERVER_LOGIN_DISABLED`: Turn login based authentication on/off (Requires Redis)
- `IIIF_SERVER_ELASTICSEARCH_URL`: URL of the ElasticSearch indexer
- `IIIF_SERVER_REDIS_DISABLED`: Turn Redis on/off
- `IIIF_SERVER_REDIS_HOST`: Host of the Redis server (Requires Redis)
- `IIIF_SERVER_REDIS_PORT`: Port of the Redis server (Requires Redis)
