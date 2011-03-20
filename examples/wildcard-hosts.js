
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
        'functions': {

            '/': (function(orig_host, vhost,req,res) {

            /**
             * Get the path requested.
             */
                var oPath     = req.url;

            /**
             * The regular expression to pull out the hostname of
             * the project.
             */
                var hostRE    = new RegExp("^([^.]+)\.repository\.steve.\org\.uk" );
                var hostMatch = hostRE.exec(orig_host)

            /**
              *  If that worked ..
              */
                if ( hostMatch != null )
                {

                    /**
                     * If the request is for the root of the project
                     * then just redirect to:
                     *
                     *   /hgwebdir.cgi/$project
                     */
                    if ( req.url == "/" )
                    {
                        req.url = "/cgi-bin/hgwebdir.cgi/" + hostMatch[1];
                    }
                    else
                    {
                        /**
                         * Otherwise tack on the request
                         *
                         * This allows:
                         *
                         * http://foo.r.s.o.u/file/tip/path
                         *
                         * To redirect to
                         *
                         * /cgi-bin/hgwebdir.cgi/fooo/file/tip/path
                         */
                        req.url = "/cgi-bin/hgwebdir.cgi/" + hostMatch[1] + "/" + req.url
                    }

                    /**
                     * Now that we've updated the path we'll redirect
                     * to the staticly defined server, which will receive
                     * the updated request and hostname.
                     */
                    res.writeHead(301, { 'Location': "http://repository.steve.org.uk" + req.url } );
                    res.end();
                }
            })
        }
    },

    /**
     * The static host.
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
