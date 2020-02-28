/*jshint node:true */
/*global require, Promise */

'use strict';

// The File System module
var fs = require('fs');

// Logger
var bunyan = require('bunyan');

// Node utils
var url = require('url');

// Application logger
var logger = bunyan.createLogger({
    name: 'app',
    stream: process.stdout,
    level: 'info'
});

// Load configuration
var config = require('./config.json');


// Circuit SDK
logger.info('[APP]: Get Circuit instance');
var Circuit = require('circuit-sdk');

// Create proxy agent to be used by SDKs WebSocket and HTTP requests
if (process.env.http_proxy) {
    var HttpsProxyAgent = require('https-proxy-agent');
    Circuit.NodeSDK.proxyAgent = new HttpsProxyAgent(url.parse(process.env.http_proxy));
    logger.info('[APP]: Using proxy ${process.env.http_proxy}');
}

var SpacesSync = function() {

    var Constants = Circuit.Constants;
    var SCOPES = 'READ_CONVERSATIONS,READ_USER,READ_USER_PROFILE,READ_SPACE,WRITE_SPACE';

    var client;
    var conversationId;
    var spaceId;
    var conversationParticipants = [];
    var spaceParticipants = [];
    var usersToBeAddedInSpace;
    var usersToBeRemovedFromSpace;
    var clientApiHandler;


    var fileExecutionTimeStamp = new Date().toISOString();

    function apiError(err, reject, treatNoResultAsEmptyList, postFn) {
        if (err === Constants.ReturnCode.NO_RESULT && treatNoResultAsEmptyList) {
            return false;
        }
        if (err) {
            var lastError = clientApiHandler.getLastError();
            postFn && postFn(lastError);
            lastError && delete lastError.errObj;
            reject(lastError);
            return true;
        }
        return false;
    }

    function fetchAllConverationParticipants(conversationId, page) {
        var options;
        if (page) {
            options = {pageSize: 100, searchPointer: page};
        } else {
            options = {pageSize: 100};
        }
        return client.getConversationParticipants(conversationId, options)
                .then(function (res) {
                    if (res.participants.length > 0 ) {
                        conversationParticipants = conversationParticipants.concat(res.participants);
                    }
                    if (res.hasMore) {
                        return fetchAllConverationParticipants(conversationId, res.searchPointer);
                    }
                });
    }

    function getSpaceParticipants(spaceId, queryData) {
        return new Promise(function (resolve, reject) {
            clientApiHandler.getSpaceParticipants(spaceId, queryData, function (err, spaceParticipants) {
                if (apiError(err, reject)) { return; }
                resolve(spaceParticipants || []);
            });
        });
    }

    function fetchAllSpaceParticipants(spaceId, page) {
        var options = {
            numberOfResults: 100,
            sortBy: "DISPLAY_NAME",
            sortOrder: "ASCENDING"
        };

        if (page) {
            options.pagePointer = page;
        }
        return new Promise(function (resolve, reject) {
            clientApiHandler.getSpaceParticipants(spaceId, options, function (err, spaceParticipants) {
                if (apiError(err, reject)) { return; }
                resolve(spaceParticipants || []);
            });
        })
        .then(function (res) {
            if (res.participants.length > 0 ) {
                spaceParticipants = spaceParticipants.concat(res.participants);
            }
            if (res.hasMore) {
                return fetchAllSpaceParticipants(spaceId, res.searchPointer);
            }
        });
    }

    function compareUserLists(inputArray){
        return function(currentElement){
          return inputArray.filter(function(other){
            return other.userId === currentElement.userId;
          }).length == 0;
        };
    }

    this.logon = function() {
        logger.info('[APP]: Create client instance');

        var bot = config.bot;

        logger.info('[APP]: createClient');
        // Use Client Credentials grant for the bots
        client = new Circuit.Client({
            client_id: bot.client_id,
            client_secret: bot.client_secret,
            domain: config.domain,
            scope: SCOPES
        });

        clientApiHandler = client._clientApiHandler;

        return client.logon()
            .then(function (user) {
                logger.info('[APP]: Logon on as ' + user.emailAddress);
            });
    };

    this.fetchConversationParticipants = function() {
        logger.info('[APP]: Fetching all conversation participants');
        conversationId = config.conversationId;

        if (!conversationId) {
            logger.error('[APP]: conversationId not provided in config.json');
            throw 'conversationId not provided in config.json';
        }

        return fetchAllConverationParticipants(conversationId);
    };

    this.fetchSpaceParticipants = function() {
        logger.info('[APP]: Fetching all space participants');
        spaceId = config.spaceId;

        if (!spaceId) {
            logger.error('[APP]: spaceId not provided in config.json');
            throw 'spaceId not provided in config.json';
        }

        return fetchAllSpaceParticipants(spaceId);
    };

    this.findDelta = function() {
        logger.info('[APP]: Finding delta in users');  
        usersToBeAddedInSpace = conversationParticipants.filter(compareUserLists(spaceParticipants));
        usersToBeRemovedFromSpace = spaceParticipants.filter(compareUserLists(conversationParticipants));
        logger.info('[APP]: Number of users to be added in space: ' + usersToBeAddedInSpace.length);
        logger.info('[APP]: Number of users to be removed from space: ' + usersToBeRemovedFromSpace.length);
        return Promise.resolve();
    };

    this.addParticipantsInSpace = function() {
        logger.info('[APP]: Adding users in space');

        if (usersToBeAddedInSpace.length > 0) {
            var NEW_USERS_FILE_NAME = 'newUsers' + '_' + fileExecutionTimeStamp + '.txt';

            var streamAdded = fs.createWriteStream(NEW_USERS_FILE_NAME);
            return new Promise(function(resolve, reject) {
                var userIdsToBeAdded;
                streamAdded.on('finish', function () {
                    logger.info('[APP]: Created report ' + NEW_USERS_FILE_NAME);
                    resolve(userIdsToBeAdded);
                });

                userIdsToBeAdded = usersToBeAddedInSpace.map(function(user) {
                    logger.info('[APP]: ---> user to be added: ' + user.firstName + " " + user.lastName);
                    streamAdded.write(user.firstName + " " + user.lastName + '\n');
                    return user.userId;
                });

                streamAdded.end();
            })
            .then(function(userIdsToBeAdded) {
                return new Promise(function(resolve, reject) {
                    var participants = userIdsToBeAdded.map(function (userId) {
                        return {
                            userId: userId,
                            role: null
                        };
                    });
                    clientApiHandler.addSpaceParticipants(spaceId, participants, function (err) {
                        if (apiError(err, reject)) {
                            return;
                        }
                        logger.info('[APP]: Successfully added new users');
                        resolve();
                    });
                });
            });
        } else {
            logger.info('[APP]: No new user(s) need to be added in Space');
            return Promise.resolve();
        }
    };

    this.removeParticipantsFromSpace = function() {
        logger.info('[APP]: Removing users from space');

        if (usersToBeRemovedFromSpace.length > 0) {
            var REMOVED_USERS_FILE_NAME = 'removedUsers' + '_' + fileExecutionTimeStamp + '.txt';

            var streamRemoved = fs.createWriteStream(REMOVED_USERS_FILE_NAME);

            return new Promise(function(resolve, reject) {
                var userIdsToBeRemoved;
                streamRemoved.on('finish', function () {
                    logger.info('[APP]: Created report ' + REMOVED_USERS_FILE_NAME);
                    resolve(userIdsToBeRemoved);
                });

                userIdsToBeRemoved = usersToBeRemovedFromSpace.map(function(user) {
                    logger.info('[APP]: ---> user to be removed: ' + user.firstName + " " + user.lastName);
                    streamRemoved.write(user.firstName + " " + user.lastName  + '\n');
                    return user.userId;
                });

                streamRemoved.end();
            })
            .then(function(userIdsToBeRemoved) {
                return new Promise(function(resolve, reject) {
                    clientApiHandler.removeSpaceParticipants(spaceId, userIdsToBeRemoved, function (err) {
                        if (apiError(err, reject)) {
                            return;
                        }
                        logger.info('[APP]: Successfully removed users');
                        resolve();
                    });
                });
            });
        } else {
            logger.info('[APP]: No new user(s) need to be removed from Space');
            return Promise.resolve();
        }
    };

    this.terminate = function() {
        logger.info('[APP]: Terminating app');
        process.exit(1);
    };

};

function run() {
    var spacesSync = new SpacesSync();

    spacesSync.logon()
        .then(spacesSync.fetchConversationParticipants)
        .then(spacesSync.fetchSpaceParticipants)
        .then(spacesSync.findDelta)
        .then(spacesSync.addParticipantsInSpace)
        .then(spacesSync.removeParticipantsFromSpace)
        .then(spacesSync.terminate)
        .catch(function (err) {
            var error = new Error(err);
            logger.error('[APP]: Error: ' + error.message);
            process.exit(1);
        });
}

//*********************************************************************
//* main
//*********************************************************************

run();
