#!/bin/sh
# Instructions: https://github.com/bbc/audiowaveform

# Clone the source code
git clone https://github.com/bbc/audiowaveform.git /opt/build/audiowaveform

# Create a build directory
mkdir -p /opt/build/audiowaveform/build
cd /opt/build/audiowaveform/build

# Start the build
cmake -D ENABLE_TESTS=0 ..
make
make install
