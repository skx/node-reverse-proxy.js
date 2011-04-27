/**
 * This configuration file is as basic as the rest, but it demonstrates
 * switching to the local Unix "www-data" user, prior to handling
 * requests.
 *
 */
exports.options = {

    /**
     * Rewrite requests for example.com, or www.example.com, to the
     * proxy running on 127.0.0.1:8000
     *
     */
    '(example.com|www.example.com)': {
        'port': '8080',
        'host': 'localhost',
    },

};

/**
 * The port we listen upon.
 */
exports.port = 8080

/**
 * The addresses we will listen upon.
 */
exports.bind = new Array("127.0.0.1", "::1")


/**
 * The user we switch to, after opening our socket to accept
 * requests.
 */
exports.user = 'www-data';
