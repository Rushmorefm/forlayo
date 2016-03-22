FROM node
MAINTAINER Javier Peletier jm@epiclabs.io

RUN wget https://www.deb-multimedia.org/pool/main/d/deb-multimedia-keyring/deb-multimedia-keyring_2016.3.7_all.deb
RUN dpkg -i deb-multimedia-keyring_2016.3.7_all.deb
RUN echo "deb http://www.deb-multimedia.org jessie main non-free" > /etc/apt/sources.list.d/deb-multimedia.list
RUN apt-get update
RUN apt-get install -y \
	ffmpeg

RUN npm install -g gulp
RUN npm install -g typings
ADD entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
 
WORKDIR /
ENTRYPOINT ["/entrypoint.sh"]