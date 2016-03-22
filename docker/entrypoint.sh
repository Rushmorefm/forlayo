#!/bin/bash

APP_FOLDER=/app

ORIGIN="$1"

echo "p0=$0"
echo "p1=$1"
echo "p2=$2"
echo "p3=$3"


if [ ! -d "$APP_FOLDER" ]; then

    git clone "$ORIGIN" "$APP_FOLDER" 
    if [ $? -ne 0 ]; then
        echo "Error cloning repository '$ORIGIN'"
        exit 1
    fi

    cd "$APP_FOLDER"
    npm install gulp
        if [ $? -ne 0 ]; then
                echo "Error installing local gulp"
                exit 1
        fi


fi

cd "$APP_FOLDER"
git remote update origin --prune
git fetch
git pull

npm install
typings install --no-insight
gulp clean
gulp build

shift
gulp run "$@"

echo "shutting down ..."
