#!/bin/sh
# Instructions: https://github.com/bbc/audiowaveform

# Install required packages
apk add --no-cache --virtual build-dependencies make cmake gcc g++ libmad-dev libid3tag-dev libsndfile-dev gd-dev boost-dev

# Clone the source code
git clone https://github.com/bbc/audiowaveform.git /opt/build/audiowaveform

# Create a build directory
mkdir -p /opt/build/audiowaveform/build
cd /opt/build/audiowaveform/build

# Start the build
cmake -D ENABLE_TESTS=0 ..
make
sudo make install

# Clean up required packages
apk del build-dependencies
