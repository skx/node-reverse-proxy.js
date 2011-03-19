/**
 * This is a proof of concept HTTP reverse-proxy written using Node.js
 *
 *
 * Overview
 * --------
 *
 * This reverse-proxy is designed to do three things:
 *
 *  1.  Listen upon a port for incoming requests and route them to
 *     one of a number of HTTP instances, based entirely upon the
 *     Host: header submitted.
 *
 *  2.  Expand mod_rewrite-like rules - based on URL patterns.
 *
 *  3.  Make arbitrary rewrites via functions hooked on URL paths.
 *
 *  So in combination this means we can accept requests and pass them
 * through to local (or remote) HTTP servers - optionally rewriting
 * parts of the request.
 *
 *
 * Usage
 * -----
 *
 *  This whole file is a program, and it is expected you'll invoke
 * it with the path to a configuration file, via "--config /path/foo.js"
 *
 *
 * Author
 * -----
 *
 * Steve
 * --
 * http://www.steve.org.uk/
 *
*/


/**
 * Load the Node.js HTTP library.
 */
var http = require('http');
var path = require('path');


/**
 * Debug?
 */
var g_debug = false;


/**
 * Our global re-write rules.
 *
 * This will be populated after the command-line parsing at the foot
 * of this script.
 */
var global;



/**
 * Global cache of pre-compiled regular expression objects for path-based
 * rewrites.
 *
 * [We cache based upon the text form of the regexp as this is vhost-agnostic.]
 */
var re_Rewrites = {};


/**
 * Global cache of pre-compiled regular expressions for our known hostnames.
 */
var re_Hosts = {};



/**
 *
 * This is the start of our HTTP handler, which will respond to incoming
 * requests and proxy/rewrite them.
 *
 */
var handler = function(req, res) {

    /**
     * Access the Host: which we received, ensuring it is
     * lower-case for consistancy.
     */
    var vhost = req.headers.host ? req.headers.host : '';
    vhost = vhost.toLowerCase();


    /**
     * Loggy
     */
    if ( g_debug )
    {
        console.log( "Request for " + vhost + req.url + " from " + req.connection.remoteAddress );
    }

    /**
     * If there is a port in the vhost-name then we'll drop it.
     */
    var port  = vhost.indexOf( ':' );
    if ( ( port ) && ( port > 0 ) )
    {
        vhost = vhost.substr( 0, port );
    }

    /**
     * Save away the original submitted Host: header, this might be useful
     * for one of our functional hooks.
     */
    req.headers["ORIG_HOST"] = vhost;


    /**
     * The entry of rules/functions/host/port we're going to lookup
     * for this incoming request.
     */
    var ent;


    /**
     * This lets us use our vhosts as regexps.  We might not want that?
     */
    for( var host in global.options )
    {
        var hostRE = re_Hosts[ host ];
        if ( hostRE.exec(vhost)  )
        {
            ent   = global.options[host];
            vhost = host;
        }
    }


    /**
     * If that succeeded it is a host we know about.
     */
    if ( ent )
    {
        /**
         * Find any rewrite-rules which might be present for this vhost.
         */
        var rules = global.options[vhost]['rules'];
        if ( rules )
        {
            Object.keys(rules).forEach( function(rule) {

                /**
                 * Find the pre-compiled regexp for this rule - execute it.
                 */
                var re    = re_Rewrites[rule];
                var match = re.exec(req.url);

                if ( match )
                {

                    /**
                     * If the rule matches we have a hit; we need
                     * to rewrite.
                     */
                    if ( g_debug )
                    {
                        console.log( "\tRewrite '" + rule + "' -> '"  + rules[rule] + "'" );
                    }

                    var newURL = rules[rule];

                    /**
                     * If we have a positive number of matches (i.e. "captures") then we need to search and replace
                     * them in turn.
                     */
                    if ( match.length > 1 )
                    {
                        var i = 1;
                        while( i <= match.length )
                        {
                            newURL = newURL.replace( "$" + i , match[i] );
                            i = i + 1;
                        }
                    }

                    /**
                     * If the destination rule begins with
                     * "http" we will instead issue a redirect.
                     */
                    if ( newURL.match( "^http" ) )
                    {
                        res.writeHead(301, { 'Location': newURL } );
                        res.end();
                    }
                    else
                    {
                        /**
                         * Otherwise we'll update the request - on the basis that we're going to proxy
                         * it shortly...
                         */
                        req.url = newURL;
                    }
                }
            })
        }


        /**
         * Now a functional modifier, which will be fun.
         */
        var func = global.options[vhost]['functions'];
        if ( func )
        {
            var orig_vhost = req.headers["ORIG_HOST"];

            Object.keys(func).forEach( function(fun) {

                /* The name of the function is a regexp against the path. */
                if ( req.url.match( fun ) )
                {
                    global.options[vhost]['functions'][fun](orig_vhost, vhost, req, res);
                }
            })
        }

        /**
         * OK at this point we have either:
         *
         *  a.  No rewrite rules defined for this vhost.
         *
         *  b.  Rules defined, but with no matches having been made.
         *
         * Lookup the host+port we're going to proxy to.
         */

        port = global.options[vhost]['port'];
        host = global.options[vhost]['host'];

        /**
         * If that lookup fails we're fucked.
         */
        if ( ( ! port ) || ( ! host ) )
        {
            res.writeHead(500, {'content-type': 'text/html'});
            res.end('Error finding host details for virtual host <tt>' + vhost + '</tt>');
        }
        else
        {

            /**
             * Otherwise we need to create the proxy-magic.
             */
            var proxy = http.createClient(port, host);
            req.headers["X-Forwarded-For"] = req.connection.remoteAddress;

            /**
             * Append soemthing to the user-agent.
             */
            var agent = req.headers["User-Agent"] ? req.headers["User-Agent"] : "";
            req.headers["User-Agent"] = agent + ";node-reverse-proxy.js";

            /**
             * Create the proxier
             */
            var proxy_request = proxy.request(req.method, req.url, req.headers);
            proxy_request.addListener('response', function(proxy_response) {
                proxy_response.addListener('data', function(chunk) {
                    res.write(chunk, 'binary');
                });
                proxy_response.addListener('end', function() {
                    res.end();
                });
                res.writeHead(proxy_response.statusCode, proxy_response.headers);
            });

            /**
             * Wire it all up, old-school.
             */
            proxy_request.socket.addListener('error', function(socketException){
                console.log( "Request for " + vhost + " failed - back-end server " + host + ":" + port + " unreachable"  );
                res.writeHead(503, {'content-type': 'text/html'});
                res.end('Back-end host unreachable.');
            });
            req.addListener('data', function(chunk) {
                proxy_request.write(chunk, 'binary');
            });
            req.addListener('end', function() {
                proxy_request.end();
            });
        }

        /**
         * Our work here is done.
         */
    }
    else
    {
        /**
         * OK we received a request for a vhost we don't know about.
         */
        res.writeHead(500, {'content-type': 'text/html'});
        res.end('Error finding host details for virtual host <tt>' + vhost + '</tt>');
    }
};




/**
 * Last ditch error-recovery
 */
process.on('uncaughtException', function (err) {
    console.log("ERROR:" + err );
});









/**
 * Default configuration file
 */
var file = "./rewrites.js";


/**
 * Simple command-line parsing.
 */
var inFile = false;
var inPort = false;

process.argv.forEach(function(arg) {

    if ( inFile )
    {
        file = arg;
        inFile = false;
    }
    if ( inPort )
    {
        port = arg;
        inPort = false;
    }
    if ( arg.match( "-+config" ) )
    {
        inFile = true;
    }
    if ( arg.match( "-+debug" ) )
    {
        g_debug = true;
    }
    if ( arg.match( "-+port" ) )
    {
        inPort = true;
    }
    if ( arg.match( "-+help" ) )
    {
        console.log( "node-reverse-proxy [--help|--config file|--port N]" );
        process.exit(1);
    }
})

/**
 * Ensure we weren't left dangling.
 */
if ( inFile || inPort )
{
    console.log( "Missing argument!" );
    process.exit(1);
}


/**
 * See if our file exists.
 */
if ( path.existsSync( file ) )
{
    global = require( file );
}
else
{
    console.log( "Configuration file not found - " + file );
    process.exit(1);
}



/**
 * Pre-compile each rewrite rule regular expression, and each vhost
 * regexp.
 *
 * Doing this offers a significant speedup.
 *
 */
Object.keys(global.options).forEach( function(vhost) {

    /**
     * Virtual Hostname regexp.
     */
    re_Hosts[vhost] = new RegExp( "^" + vhost + "$" );

    /**
     * Now process each existing rewrite rule for that vhost.
     */
    rules = global.options[vhost]['rules'];
    if ( rules )
    {
        Object.keys(rules).forEach( function(rule) {
            re_Rewrites[rule]  = new RegExp( rule );
        } )
    }
} )

/**
 * Entry point - start our server up on the port & addresses we've got
 * defined.
 */
console.log( "node-reverse-proxy.js starting, reading from " + file + "\n");


/**
 * Port is either that from the command-line parser, or from the
 * configuration file.
 */
var port = port || global.port;

/**
 * Bind to each requested address, defined in the configuration file.
 */
for (val in global.bind)
{
    console.log( "Binding to " + global.bind[val] + ":" + port );
    http.createServer().addListener("request",handler).listen(port, global.bind[val] );
}


/**
 * Now we're cooking on gas.
 */
console.log("\nAwaiting orders ...");
