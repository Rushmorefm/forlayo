FROM node
MAINTAINER Javier Peletier jm@epiclabs.io

ENV FFMPEG_VERSION=3.0 \
    X264_VERSION=snapshot-20160218-2245-stable

# Enable Universe and Multiverse and install dependencies.
RUN echo deb http://archive.ubuntu.com/ubuntu precise universe multiverse >> /etc/apt/sources.list; apt-get update; apt-get -y install autoconf automake build-essential git mercurial cmake libass-dev libgpac-dev libtheora-dev libtool libvdpau-dev libvorbis-dev pkg-config texi2html zlib1g-dev libmp3lame-dev wget yasm; apt-get clean


COPY install.sh /var/cache/ffmpeg/install.sh
RUN bash /var/cache/ffmpeg/install.sh

RUN npm install -g gulp
RUN npm install -g typings
ADD entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
 
WORKDIR /
ENTRYPOINT ["/entrypoint.sh"]
