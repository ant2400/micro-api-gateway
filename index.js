"use strict";

const app = require('express')();
const async = require('async');
const _ = require('lodash');
const amqp = require('seneca-amqp-transport');
const seneca =require('seneca')().use(amqp);
const ready = require('micro-common/ready');

const services = ['one', 'two'];

/**
 * Regular old endpoint.
 */
app.get('/hi', (req, res) => {

    res.send('hi');
});

/**
 * Endpoint that leverages three other services.
 * In actuality, there are four services at play here, since each of these three
 * language services makes another call to a fourth service to reverse their greeting.
 *
 * The API Gateway doesn't care about that though.
 * All it needs to know about are the three services it's explicitly calling.
 */
app.get('/greeting', (req, res) => {

    /**
     * Map each language to a service call.
     */
    async.map(services, (service, callback) => {

        /**
         * Use seneca to call the specified service.
         */
        seneca.act({
            service: `service-${service}`,
            word_type: 'greeting'
        }, callback);

    }, (err, results) => {

        if (err) {
            return res.send('an error occurred!');
        }

        /**
         * Join all the results into a single string.
         * 
         */
        const hello = _.map(results, (result) => {
            
            const greeting = _.get(result, 'greeting', 'unknown');

            return `${greeting}`;
        }).join(', ');

        res.send(`${hello} from the buttside-down world!`);
    });
});

/**
 * Check if rabbitmq is ready before allowing this service to use it.
 */
ready({
    hostname: 'rabbitmq',
    port: 15672,
    path: '/api'
}, () => {

    seneca.client({
        type: 'amqp',
        hostname: 'rabbitmq',
        port: 5672,
        username: 'guest',
        password: 'guest',
        pin: [ // the services that the API Gateway can send requests to.
            {service: 'service-one'},
            {service: 'service-two'}
        ]
    });
    
    app.listen(process.env.APP_PORT, () => {

        console.log('listening on', process.env.APP_PORT);
    });

});