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
    logger.info('Using proxy ${process.env.http_proxy}');
}

var Stats = function() {

    var client;
    var conversationId;
    var conversationParticipants = [];
    var botUserId;


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

    this.logon = function() {
        logger.info('[APP]: Create client instance');

        var bot = config.bot;

        logger.info('[APP]: createClient');
        // Use Client Credentials grant for the bots
        client = new Circuit.Client({
            client_id: bot.client_id,
            client_secret: bot.client_secret,
            domain: config.domain
        });

        //self.addEventListeners(client);  // register evt listeners

        return client.logon()
            .then(function (user) {
                logger.info('[APP]: Logon on as ' + user.emailAddress);
                botUserId = user.userId;
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

    this.addParticipantsInSpace = function() {
        logger.info('[APP]: Adding conversation participants in Space');

        // Exclude the bot user from the conference participants list
        conversationParticipants.find(function (participart, idx) {
            if (participart.userId === botUserId) {
                conversationParticipants.splice(idx, 1);
                return true;
            }
            return false;
        });


        logger.info('[APP]: Number of conversation particapants: ' + conversationParticipants.length);
        return;
    };

    this.terminate = function() {
        logger.info('[APP]: Terminating app');
        process.exit(1);
    };

};

function run() {
    var stats = new Stats();

    stats.logon()
        .then(stats.fetchConversationParticipants)
        .then(stats.addParticipantsInSpace)
        .then(stats.terminate)
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
