/**
 *  This is an example configuration for a reverse proxy which listens
 * upon:
 *
 *     192.168.1.100:80
 *
 *  Each incoming request for the virtual host "example.com" is
 * forwarded to the local IP address & port pair:
 *
 *     127.0.0.1:8080
 *
 *  Any request for "www.example.com" will also be forwarded, after
 * rewriting.
 *
 *  Usage:
 *  -----
 *
 *  To use this configuration file please run:
 *
 *   ./node-reverse-proxy.js --config ./examples/one-host-rewrites.js
 *
 */
exports.options = {

    /**
     * The virtual host we're responding to.
     */
    'example.com': {
        /**
         * The host and port to which we forward the requests.
         */
        'host': '127.0.0.1',
        'port': '8080',
    },

    /**
     * The virtual host we're responding to.
     */
    'www.example.com': {
        /**
         * Notice we don't define any 'host' and 'port' here, as we're
         * merely redirecting visitors to example.com.
         */

        /**
         * Here we rewrite http://www.example.com/foo to
         * http://example.com/foo
         */
        rules: {
            '^/(.*)': 'http://example.com/$1'
        },

        /**
         * If we didn't care what path was requested, and just wanted
         * to redirect a user to the root of the other site we could
         * use this:
         *
         *
        rules: {
            '^/': 'http://example.com/'
        },

        *
        */
    },

};

/**
 * The port we listen upon.
 */
exports.port = 80

/**
 * The addresses we will listen upon.
 */
exports.bind = new Array("192.168.1.100", "127.0.0.1")