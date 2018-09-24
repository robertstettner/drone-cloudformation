#!/usr/bin/env bash

if [ "$TRAVIS_PULL_REQUEST" == "false" ]; then

    if [ "$TRAVIS_BRANCH" == "master" ]; then
        # push latest tag when pushing to master
        docker login -u="$DOCKER_USERNAME" -p="$DOCKER_PASSWORD";
        docker build . -t robertstettner/drone-cloudformation;
        docker push robertstettner/drone-cloudformation;

    fi

    if [ -n "$TRAVIS_TAG" ]; then
        # push version tag when pushing a tag
        docker login -u="$DOCKER_USERNAME" -p="$DOCKER_PASSWORD";
        docker build . -t robertstettner/drone-cloudformation:$TRAVIS_TAG;
        docker push robertstettner/drone-cloudformation:$TRAVIS_TAG;

    fi

fi