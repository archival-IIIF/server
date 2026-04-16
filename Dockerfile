FROM node:24-alpine

# Install tooling
RUN apk add --no-cache ghostscript ffmpeg

# Copy audiowaveform
COPY --from=realies/audiowaveform /usr/local/bin/audiowaveform /usr/local/bin/

# Init the work dir
RUN mkdir -p /opt/iiif-server
WORKDIR /opt/iiif-server

# Install the application
COPY package.json /opt/iiif-server
COPY package-lock.json /opt/iiif-server
RUN npm install --omit=dev

# Copy the application
COPY src /opt/iiif-server/src

# Run the application
CMD ["node", "src/app.ts"]
