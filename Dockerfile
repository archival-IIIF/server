FROM node:12.16.3-alpine AS builder

# Install tooling
RUN apk add git python3 g++ make cmake gcc libmad-dev libid3tag-dev libsndfile-dev gd-dev boost-dev \
  libgd libpng-dev zlib-dev zlib-static libpng-static boost-static autoconf automake libtool gettext

# Install global NPM tooling
RUN npm install typescript grunt-cli -g

# Copy the application
RUN mkdir -p /opt/iiif-server
COPY . /opt/iiif-server
WORKDIR /opt/iiif-server

# Build audiowaveform (No Alpine or Debian package)
RUN chmod +x ./build-audiowaveform.sh && ./build-audiowaveform.sh

# Build viewers
RUN chmod +x ./build-viewers.sh && ./build-viewers.sh

# Install the application
RUN npm install --production

# Transpile the application
RUN tsc

# Create the actual image
FROM node:12.16.3-alpine

# Copy audiowaveform from builder
COPY --from=builder /usr/local/bin/audiowaveform /usr/local/bin/

# Copy application build from builder
COPY --from=builder /opt/ /opt/
WORKDIR /opt/iiif-server

# Run the application
CMD ["node", "src/app.js"]

