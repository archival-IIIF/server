FROM node:20-alpine AS builder

# Install global NPM tooling
RUN npm install typescript@5.4.5 -g

# Copy the application
RUN mkdir -p /opt/iiif-server
COPY . /opt/iiif-server
WORKDIR /opt/iiif-server

# Install the application
RUN npm install --omit=dev

# Transpile the application
RUN tsc

# Create the actual image
FROM node:20-alpine

# Install tooling
RUN apk add --no-cache ghostscript ffmpeg

# Copy audiowaveform
COPY --from=realies/audiowaveform /usr/local/bin/audiowaveform /usr/local/bin/

# Copy application build from builder
COPY --from=builder /opt/iiif-server /opt/iiif-server
WORKDIR /opt/iiif-server

# Run the application
CMD ["node", "src/app.js"]
