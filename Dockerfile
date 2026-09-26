FROM php:8.2-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libcurl4-openssl-dev \
    && docker-php-ext-install curl \
    && a2enmod headers \
    && rm -rf /var/lib/apt/lists/*

COPY docker/apache-sendzero.conf /etc/apache2/conf-available/sendzero.conf
COPY docker/php-sendzero.ini /usr/local/etc/php/conf.d/sendzero.ini
RUN a2enconf sendzero

WORKDIR /var/www/html
COPY . /var/www/html

RUN mkdir -p /srv/sendzero-data \
    && chown www-data:www-data /srv/sendzero-data \
    && chmod 700 /srv/sendzero-data

COPY docker/entrypoint.sh /usr/local/bin/sendzero-entrypoint
RUN chmod 0755 /usr/local/bin/sendzero-entrypoint

ENTRYPOINT ["sendzero-entrypoint"]
CMD ["apache2-foreground"]
