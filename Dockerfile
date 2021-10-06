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
COPY --from=knawhuc/audiowaveform:latest /usr/local/bin/audiowaveform /usr/local/bin/

# Copy UniversalViewer
COPY --from=knawhuc/universalviewer:latest /usr/share/nginx/html /opt/universalviewer

# Copy IIIF viewer
# COPY --from=knawhuc/archival-iiif-viewer:latest /usr/share/nginx/html /opt/iiif-viewer

# Copy application build from builder
COPY --from=builder /opt/iiif-server /opt/iiif-server
WORKDIR /opt/iiif-server

# Run the application
CMD ["node", "src/app.js"]
