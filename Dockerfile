FROM node:lts-alpine

# Install tooling
RUN apk add --no-cache git

# Install global NPM tooling
RUN npm install yarn typescript grunt-cli pm2 -g

# Copy the application
RUN mkdir -p /opt/iiif-server
COPY . /opt/iiif-server
WORKDIR /opt/iiif-server

# Install viewers
RUN chmod +x ./install-viewers.sh &&\
 ./install-viewers.sh

# Install the application
RUN yarn install --production

# Transpile the application
RUN tsc

# Run the application
CMD ["pm2-runtime", "start", "config.yaml"]
