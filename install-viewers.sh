#!/bin/sh

# Install Universal Viewer
mkdir -p /opt/universalviewer
git clone https://github.com/UniversalViewer/universalviewer.git /opt/universalviewer --recursive
cd /opt/universalviewer
npm install
grunt build --dist

# Install IIIF archival viewer
mkdir -p /opt/iiif-viewer
git clone https://github.com/archival-IIIF/viewer.git /opt/iiif-viewer --recursive
cd /opt/iiif-viewer
npm install
npm run build
