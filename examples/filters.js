/**
 *  This is an example configuration for a reverse proxy which listens
 * upon:
 *
 *     127.0.0.1:8080
 *
 *  It forwards all traffic to 127.0.0.1:80, due to a simple regular
 * expression which matches all incoming Host: headers - and thus
 * all possible virtual hosts.
 *
 *  The interesting thing about this example is that it uses two
 * filters to modify both:
 *
 *   1.  The request sent to the back-end server.
 *
 *   2.  The response from the back-end server.
 *
 *  In both cases "node-reverse-proxy.js" is appended to a header,
 * and additional some URL munging is applied globally to incoming
 * requests.
 *
 *  Usage:
 *  -----
 *
 *  To use this configuration file please run:
 *
 *   ./node-reverse-proxy.js --config ./examples/filters.js
 *
 */
exports.options = {

    /**
     * Accept all hosts and rewrite to localhost:80
     */
    '.*': {
        'host': '127.0.0.1',
        'port': 80,
    }

};

/**
 * Filters, which are applied to all connections.
 */
exports.filters = {

    /**
     * The pre-filter receives three pieces of information:
     *
     * The incoming request object, which it is free to modify, and
     * the virtual hostname - which is read-only.  Additionally it
     * receives a response object to which it may write to if it wishes.
     *
     * If this function returns "true" the further handling of the
     * request is aborted.
     *
     * "True" essentially means "this request was handled; stop now".
     *
     */
    'pre': (function(req, res, vhost)
    {

        console.log("pre-filter");

        /**
         * This is thttpd specific, but it seems that requests with two
         * leading "/" characters result in a "400 bad request" response.
         *
         * Munge the incoming request until it starts with one leading "/".
         *
         */
        while (req.url.substr(0, 2) == "//")
        {
            req.url = req.url.substr(1);
        }

        /**
         * Append ourself to the client-supplied user-agent.
         */
        var agent = ""
        if (req.headers["user-agent"])
        {
            agent = req.headers["user-agent"] + "; ";
        }
        req.headers["User-Agent"] = agent + "node-reverse-proxy.js";

        return false;
    }),

    /**
     *  This filter executes as the initial response comes back
     * from the real HTTP server.
     *
     *  The parameters are the:
     *
     * proxy_response: The response object from the back-end proxy.
     *
     * req: The incoming request.  (Read-only);
     *
     * vhost: The incoming virtual host.  (Read-only).
     */
    'post': (function(proxy_response, req, vhost)
    {

        console.log("post-filter");

        /**
         * Update the Server: header to include our name.
         */
        var server = ""
        if (proxy_response.headers["server"])
        {
            server = proxy_response.headers["server"] + "; ";
        }
        proxy_response.headers["server"] = server + "node-reverse-proxy.js";
    }),

};

/**
 * The port & addresses we listen upon - on my desktop/test host.
 */
exports.port = 8080;
exports.bind = new Array("127.0.0.1", "::1");
