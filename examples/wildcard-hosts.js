
/**
 * This configuration file is a little more advanced than the previous
 * ones, and relies upon having wildcard DNS-entries present.
 *
 * The basic intention is that a request to:
 *
 *   http://"project".repository.steve.org.uk/
 *
 * Will :
 *
 *   a.  Succeed.
 *
 *   b.  Present the hgwebdir interface to the specific project
 *     named in the hostname.
 *
 * This is a pretty basic operation, but it requires that we modify
 * the incoming "Host:" header which was submitted by the client,
 * and also allow some files to be passed through unmolested:
 *
 *    /favicon.ico
 *    /robots.txt
 *
 * The configuration presented here does precisely that.
 *
 */
exports.options = {


    /**
      * rewrites for dynamic domains.
      *
      * This rule matches any hostname with a "repository.steve.org.uk"
      * suffix - because these keys are regular expressions, not literal
      * hostnames.
      *
      */
    '([^.]*).repository.steve.org.uk':
    {
        /**
         * Rewrites for static files - these will be handled via a
         * separate virtual host.
         */
        'rules': {
            '^/robots.txt':  'http://repository.steve.org.uk/robots.txt',
            '^/favicon.ico': 'http://repository.steve.org.uk/favicon.ico',
        },

        /**
         * This function will be invoked for each requested file,
         * as it matches against "/" - which all requests will be
         * prefixed with.
         *
         * Again the key here "/" is a regular expression; albeit a permissive
         * one.
         *
         */
        'functions': {
            '/': (function(orig_host, vhost, req, res) {

                /**
                 * Get the requested hostname.
                 */
                var hostRE = new RegExp("^([^.]+)\.repository\.steve.\org\.uk");
                var hostMatch = hostRE.exec(orig_host)

                if (hostMatch != null) {

                    /**
                     * If that worked and we update the path
                     */
                    req.url = "/cgi-bin/hgwebdir.cgi/" + hostMatch[1] + req.url

                    /**
                     * And rewrite to the static host
                     */
                    res.writeHead(301, {
                        'Location': "http://repository.steve.org.uk" + req.url
                    });
                    res.end();

                    /**
                     * We return here because we've handled the result,
                     * (issuing a redirect) and that means that we don't
                     * need the server to proxy the request for us.
                     */
                    return true;

                }

                /**
                 * If we reach here then we haven't carried out our
                 * mission, and the request should be proxied.
                 *
                 * However that isn't actually possible - we'll
                 * not be invoked if our hostname doesn't match the
                 * (simplified) regexp: *.repository.steve.org.uk, and
                 * similarly every URL request is going to match "/".
                 *
                 * So this is a "can't happen" situation.
                 *
                 */
                return false;
            })
        }
    },

    /**
     * The static host: proxy all requests to the localhost:1018 server.
     */
    'repository.steve.org.uk':
    {
        'port': '1018',
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
exports.bind = new Array( "127.0.0.1", "::1" )
