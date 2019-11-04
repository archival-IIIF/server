FROM ubuntu:18.04

# Install tooling
RUN apt-get update -y &&\
 apt-get install -y git python-setuptools python-pip python-dev apache2 libapache2-mod-wsgi build-essential \
 libjpeg-turbo8-dev libjpeg8 libjpeg8-dev libfreetype6 libfreetype6-dev zlib1g-dev \
 liblcms2-2 liblcms2-dev liblcms2-utils libtiff5-dev libwebp-dev libssl-dev libffi-dev

# Install PIP
RUN pip install --upgrade pip configobj

# Install Loris
RUN useradd -d /var/www/loris2 -s /sbin/false loris
RUN mkdir -p /opt/loris &&\
  git clone --branch 'v2.3.3' --depth 1 https://github.com/loris-imageserver/loris.git /opt/loris
WORKDIR /opt/loris
RUN ./setup.py install

# Configure Apache
RUN a2enmod headers expires
COPY ./000-default.conf /etc/apache2/sites-enabled
EXPOSE 80

# Run the application
CMD ["/usr/sbin/apachectl", "-D", "FOREGROUND"]
