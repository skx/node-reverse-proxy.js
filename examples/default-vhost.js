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
 *  Each incoming request for the virtual host "example.org" is
 * forwarded to the local IP address & port pair:
 *
 *     127.0.0.1:9090
 *
 *  The interesting thing with this example is that incoming requests
 * with NO Host: header will be mapped to example.org - via the
 * "defaultvhost" option.
 *
 *  Usage:
 *  -----
 *
 *  To use this configuration file please run:
 *
 *   ./node-reverse-proxy.js --config ./examples/default-vhost.js
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
    'example.org': {
        /**
         * The host and port to which we forward the requests.
         */
        'host': '127.0.0.1',
        'port': '9090',
    },
};

/**
 * The port we listen upon.
 */
exports.port = 80

/**
 * The default virtual host, for incoming requests without a Host:
 * header present.
 */
exports.defaultvhost = "example.org";

/**
 * The addresses we will listen upon.
 */
exports.bind = new Array("192.168.1.100", "127.0.0.1")
