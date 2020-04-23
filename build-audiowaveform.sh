#!/bin/sh
# Instructions: https://github.com/bbc/audiowaveform

# Clone the source code
git clone https://github.com/bbc/audiowaveform.git /opt/build/audiowaveform

# Create a build directory
mkdir -p /opt/build/audiowaveform/build
cd /opt/build/audiowaveform/build

# Start the build of the FLAC dependency
wget "https://github.com/xiph/flac/archive/1.3.3.tar.gz"
tar xzf 1.3.3.tar.gz
cd flac-1.3.3
./autogen.sh
./configure --enable-shared=no
make
make install
cd ../

# Start the build
cmake -D ENABLE_TESTS=0 -D BUILD_STATIC=1 ..
make
make install
