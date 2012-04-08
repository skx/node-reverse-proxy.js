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
 *  The same thing happens for "www.example.com" - but without any
 * duplication or need to define two rules.  This is achieved by using
 * a regular expression in the host definition.
 *
 *  Usage:
 *  -----
 *
 *  To use this configuration file please run:
 *
 *   ./node-reverse-proxy.js --config ./examples/regexp-vhosts.js
 *
 */
exports.options = {

    /**
     * The virtual host we're responding to.  Note that we're using
     * a regular expression here which will match either of:
     *
     *   - www.example.com
     * or
     *   - example.com
     */
    '(example.com|www.example.com)': {
        /**
         * The host and port to which we forward the requests.
         */
        'host': '127.0.0.1',
        'port': '8080'
    }

};

/**
 * The port we listen upon.
 */
exports.port = 80;

/**
 * The addresses we will listen upon.
 */
exports.bind = new Array("192.168.1.100", "127.0.0.1");
