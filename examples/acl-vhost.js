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
 *  Any other request is ignored.
 *
 *  Any request for /private is only permitted from two IP addresses:
 *  1.2.3.4 & 2.3.4.5
 *
 *  Usage:
 *  -----
 *
 *  To use this configuration file please run:
 *
 *   ./node-reverse-proxy.js --config ./examples/acl-vhost.js
 *
 */

/**
 * The trusted IP addresses for access to /private.
 */
trusted = new Array("1.2.3.4", "2.3.4.5");

/**
 * A helper function for finding a value in an array.
 */
trusted.grep = function(value) {
    for (var i = 0; i < this.length; ++i) {
        if (this[i] == value) {
            return true;
        }
    }
    return false;
};

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

        /**
         * Hook called for requests beneath /private.
         */
        'functions': {
            '/private': (function(orig_host, vhost, req, res) {
                var remote = req.connection.remoteAddress;;

                if (trusted.grep(remote)) {
                    /**
                     * this request wasn't handled, so it should
                     * proceed to be proxied.
                     */
                    return false;
                }
                else {
                    res.writeHead(403);
                    res.write(req.url + " denied to " + remote);
                    res.end()

                    /**
                     * This request was handled; so no further action
                     * required.
                     */
                    return true;
                }
            }),
        }
    }
}

/**
 * The port we listen upon.
 */
exports.port = 80

/**
 * The addresses we will listen upon.
 */
exports.bind = new Array("192.168.1.100", "127.0.0.1")