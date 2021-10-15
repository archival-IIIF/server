FROM node:14-alpine AS builder

# Install global NPM tooling
RUN npm install typescript -g

# Copy the application
RUN mkdir -p /opt/iiif-server
COPY . /opt/iiif-server
WORKDIR /opt/iiif-server

# Install the application
RUN npm install --production

# Transpile the application
RUN tsc

# Create the actual image
FROM node:14-alpine

# Install tooling
RUN apk add --no-cache ghostscript ffmpeg

# Copy audiowaveform
COPY --from=registry.diginfra.net/archival-iiif/audiowaveform:1.5.1 /usr/local/bin/audiowaveform /usr/local/bin/

# Copy application build from builder
COPY --from=builder /opt/iiif-server /opt/iiif-server
WORKDIR /opt/iiif-server

# Run the application
CMD ["node", "src/app.js"]
