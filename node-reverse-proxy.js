/**
 * A Reverse-HTTP proxy written using Node.js
 *   http://www.steve.org.uk/Software/node-reverse-proxy/
 *
 *
 * Overview
 * --------
 *
 * This reverse-HTTP proxy is designed to do three things:
 *
 *  1.  Listen upon a port for incoming requests and route them to
 *     one of a number of HTTP instances, based entirely upon the
 *     Host: header submitted.
 *
 *  2.  Expand mod_rewrite-like rules - based on URL patterns.
 *
 *  3.  Make arbitrary rewrites via functions hooked on URL paths.
 *
 *  In combination this means we can accept requests and pass them
 * through to local (or remote) HTTP servers, optionally rewriting
 * parts of the request.
 *
 *
 * Usage
 * -----
 *
 *  This whole file is a program, and it is expected you'll invoke
 * it with the path to a configuration file, via "--config /path/foo.js"
 *
 *  (Several example configuration files are provided with the source
 * code distribution; see ./examples/.)
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
 * Load the Node.js HTTP & PATH libraries.
 */
var http = require('http');
var path = require('path');

/**
 * The defaults for our command line parser
 */
var cmdline = {
    'debug': false,
    'dump': false,
    'config': "./rewrites.js"
};

var VERSION = "UNRELEASED";

/**
 * Our global re-write rules.
 *
 * This will be populated after the command-line parsing, and configuration
 * file reading.
 *
 * NOTE:  This is where *all* the vhosts, their rewrite/function
 * definitions are stored.
 *
 * NOTE #2:  We pre-compile all regexps.  See "loadConfigFile" for details
 * and specifically note the use of the 'compiled' + 'rw_compiled' - the
 * former for virtual host regexps and the latter for ReWrite regexps.
 *
 */
var global;

/**
 * Command line parser.
 */

function parseCommandLine()
{
    var inFile = false;
    var inPort = false;

    process.argv.forEach(function(arg)
    {

        if (inFile)
        {
            cmdline['config'] = arg;
            inFile = false;
        }
        if (inPort)
        {
            cmdline['port'] = arg;
            inPort = false;
        }
        if (arg.match("-+config"))
        {
            inFile = true;
        }
        if (arg.match("-+debug"))
        {
            cmdline['debug'] = true;
        }
        if (arg.match("-+dump"))
        {
            cmdline['dump'] = true;
        }
        if (arg.match("-+port"))
        {
            inPort = true;
        }
        if (arg.match("-+help"))
        {
            console.log("node-reverse-proxy.js - " + VERSION + " - <http://steve.org.uk/Software/node-reverse-proxy/>");
            console.log("\nUsage:")
            console.log(" node-reverse-proxy [options]")
            console.log(" ")
            console.log(" --help    Show this help.");
            console.log(" --config  Use the specified config file, not ./rewrites.js.");
            console.log(" --dump    Dump the configuration file, and exit.");
            console.log(" --debug   Show debugging information whilst running.");
            console.log(" --port    Override the port to listen upon from the config file.");
            console.log("");
            process.exit(1);
        }
    })

    /**
     * Ensure we weren't left dangling.
     */
    if (inFile || inPort)
    {
        console.log("Missing argument!");
        process.exit(1);
    }
}

/**
 * Load the specified configuration file, aborting if it isn't present.
 *
 * Pre-compile the virtual host regexps & rewrite rules for speed.
 *
 */

function loadConfigFile(filename)
{

    if (cmdline["debug"])
    {
        console.log("Reading configuration file " + filename);
    }

    /**
     * See if our named configuration file exists.
     */
    if (path.existsSync(filename))
    {
        global = require(filename);
    }
    else
    {
        console.log("Configuration file not found - " + filename);
        process.exit(1);
    }

    /**
     * Pre-compile each rewrite rule regular expression, and each vhost
     * regexp.
     *
     * Doing this offers a significant speedup.
     *
     */
    Object.keys(global.options).forEach(function(vhost)
    {

        /**
         * Virtual Hostname regexp.
         */
        global.options[vhost]['compiled'] = new RegExp("^" + vhost + "$");

        /**
         * Now process each existing rewrite rule for that vhost.
         */
        rules = global.options[vhost]['rules'];

        if (rules)
        {

            /**
             * Create a sub-hash
             */
            global.options[vhost]['rw_compiled'] = {}

            Object.keys(rules).forEach(function(rule)
            {

                /**
                 * Damn that is a lot of nesting...
                 */
                global.options[vhost]['rw_compiled'][rule] = new RegExp(rule);
            })
        }
    })
}

/**
 * Dump the virtual hosts we know about to the console,
 * along with their proxied locations and any rewrite rules
 * which might be present.
 */

function dumpOptions()
{
    Object.keys(global.options).forEach(function(vhost)
    {
        console.log("http://" + vhost + "/");

        /**
         * Dump host + port if present.
         */
        port = global.options[vhost]['port'] || "";
        host = global.options[vhost]['host'] || "127.0.0.1";

        var rules = global.options[vhost]['rules'];

        if (rules)
        {
            Object.keys(rules).forEach(function(rule)
            {
                console.log("\tRewriting " + rule + " to " + rules[rule]);
            })
        }

        if (host.length && port.length)
        {
            console.log("\tproxying to " + host + ":" + port);
        }

    });
}

/**
 *
 * This is the start of our HTTP handler, which will respond to incoming
 * requests and proxy/rewrite them.
 *
 */
var handler = function(req, res)
{

    /**
     * Access the Host: which we received, ensuring it is
     * lower-case for consistancy.
     */
    var vhost = req.headers.host ? req.headers.host : '';
    vhost = vhost.toLowerCase();

    /**
     * Log, if being verbose.
     */
    if (cmdline['debug'])
    {
        console.log("Request for " + vhost + req.url + " from " + req.connection.remoteAddress);
    }

    /**
     * If there are any pre-execution filters apply them
     */
    if ((global.filters) && (global.filters['pre']))
    {
        global.filters['pre'](req, vhost);
    }

    /**
     * If there is a port in the vhost-name then we'll drop it.
     */
    var port = vhost.indexOf(':');
    if ((port) && (port > 0))
    {
        vhost = vhost.substr(0, port);
    }

    /**
     * Save away the original submitted Host: header, this will be passed
     * to any functional hooks which might be present for this virtual host.
     */
    var orig_vhost = vhost;

    /**
     * The entry of rules/functions/host/port we're going to lookup
     * for this incoming request.
     */
    var ent;

    /**
     * Find the virtual host, from our external table.
     *
     * Note that the entries in that table are regular expressions, albeit
     * anchored ones.
     */
    for (var host in global.options)
    {
        var hostRE = global.options[host]['compiled'];
        if (hostRE.exec(vhost))
        {
            ent = global.options[host];
            vhost = host;
        }
    }

    /**
     * If the table lookup failed then we have a request for a virtual
     * host we don't know about.
     */
    if (!ent)
    {

        /**
         * There might be a default host.
         */
        if (global.defaultvhost)
        {
            /**
             *  See if that matches any of our know hosts...
             */
            for (var host in global.options)
            {
                var hostRE = global.options[host]['compiled'];
                if (hostRE.exec(global.defaultvhost))
                {
                    ent = global.options[host];
                    vhost = host;
                }
            }

            /**
             * If we *still* don't have a match then we have to
             * return an error.
             */
            if (!ent)
            {
                res.writeHead(500, {
                    'content-type': 'text/html'
                });
                res.end('Error finding host details for virtual host <tt>' + escape(vhost) + '</tt>');
            }
        }
    }



    /**
     * Find any rewrite-rules which might be present for this vhost.
     */
    var rules = global.options[vhost]['rules'];

    if (rules)
    {

        var stop = false;
        var done = false;

        Object.keys(rules).forEach(function(rule)
        {

            /**
             * Find the pre-compiled regexp for this rule - execute it.
             */
            var re = global.options[vhost]['rw_compiled'][rule];
            var match = re.exec(req.url);

            if ((match) && (!stop))
            {

                /**
                 * If the rule matches we have a hit; we need
                 * to rewrite.
                 *
                 * Note: We generally continue to go through this loop
                 * allowing further rewrites to occur.  That seems more
                 * sensible to me than to stop at the first hit, although
                 * if you configure a rewrite to occur which ends in
                 * "-LAST" it will terminate further updates.
                 *
                 * e.g:
                 *
                 *   '/robots.txt': '/robots.txt-LAST',
                 *   '/(.*)':       '/show.cgi?path=$1',
                 *
                 * That will rewrite all rules to /show.cgi *except*
                 * for /robots.txt which will match the first rule
                 * and due to the "-LAST" will terminate further
                 * matches.
                 *
                 */
                var newURL = rules[rule];

                /**
                 * If we have a positive number of matches
                 * (i.e. "captures") then we need to search and replace
                 * them in turn.
                 *
                 *  So we replace $1 with the first capture,
                 * we replace $2 with the second capture, etc.
                 *
                 */
                if (match.length > 1)
                {
                    var i = 1;
                    while (i <= match.length)
                    {
                        newURL = newURL.replace("$" + i, match[i]);
                        i = i + 1;
                    }
                }

                /**
                 * If the destination rule begins with "http" we will
                 * issue a 301 redirect.
                 */
                if (newURL.match("^http"))
                {

                    /**
                     * TODO: -CODE=302 -> Will generate  a 302 redirect
                     *
                     */
                    res.writeHead(301, {
                        'Location': newURL
                    });
                    res.end();
                    done = true
                }
                else
                {

                    /**
                     * Should we stop the rewrites?
                     */
                    var offset = newURL.indexOf("-LAST");
                    if (offset > 0)
                    {
                        /**
                         * Strip the -LAST suffix
                         */
                        newURL = newURL.substr(0, offset);
                        stop = true;
                    }

                    /**
                     * Otherwise we'll update the request - on the basis
                     * that we're going to proxy it shortly.
                     */
                    req.url = newURL;

                }
            }
        })
    }


    if (done)
    {
        return
    }

    /**
     * See if we have any modification functions to invoke.
     *
     * If there are we execute each one in turn.  If we receive
     * any true response we will regard the request as over
     * and will not continue to proxy that request.
     *
     * The functions are invoked based upon the URL-path requested,
     * but it is possible there will be more than one.
     */
    var func = global.options[vhost]['functions'];
    var over = false;

    if (func)
    {

        Object.keys(func).forEach(function(fun)
        {

            /* The name of the function is a regexp against the path. */
            if (req.url.match(fun))
            {

                if (global.options[vhost]['functions'][fun](orig_vhost, vhost, req, res))
                {
                    over = true;
                }
            }
        })
    }

    /**
     * If (at least one) functional hook returned true then we're
     * done with this request.
     */
    if (over)
    {
        return;
    }

    /**
     * OK at this point we have either:
     *
     *  a.  No rewrite rules/functions defined for this vhost.
     *
     *  b.  Rules defined, but with no matches having been made, or
     *     without a functional hook returning "true".
     *
     * Lookup the host+port we're going to proxy to.
     */
    port = global.options[vhost]['port'];
    host = global.options[vhost]['host'] || "127.0.0.1";

    /**
     * If that lookup fails we're out of luck.
     */
    if ((!port) || (!host))
    {
        res.writeHead(500, {
            'content-type': 'text/html'
        });
        res.end('Error finding host details for virtual host <tt>' + escape(vhost) + '</tt>');
        return;
    }

    /**
     * Otherwise we need to create the proxy-magic.
     */
    var proxy = http.createClient(port, host);

    /**
     * The proxied connection might fail.
     */
    proxy.addListener('error', function(socketException)
    {
        console.log("Request for " + vhost + " failed - back-end server " + host + ":" + port + " unreachable");
        res.writeHead(503, {
            'content-type': 'text/html'
        });
        res.end('Back-end unreachable.');
    });

    /**
     * Preserve the original requesting IP address.
     */
    req.headers["X-Forwarded-For"] = req.connection.remoteAddress;

    /**
     * Create the proxy object.
     */
    var proxy_request = proxy.request(req.method, req.url, req.headers);

    proxy_request.addListener('response', function(proxy_response)
    {

        /**
         * If we have a "Connection: foo" header preserve it.
         *
         * Otherwise defualt to "close".
         */
        if (proxy_response.headers.connection)
        {
            if (req.headers.connection)
            {
                proxy_response.headers.connection = req.headers.connection;
            }
            else
            {
                proxy_response.headers.connection = 'close';
            }
        }

        /**
         * If there are any post-execution filters apply them
         */
        if ((global.filters) && (global.filters['post']))
        {
            global.filters['post'](proxy_response, req, vhost);
        }

        /**
         * Send the proxy's initial response back to the client.
         */
        res.writeHead(proxy_response.statusCode, proxy_response.headers);

        /**
         * No 'data' event and no 'end'
         *
         * Missing this will lead to oddness - don't ask.
         */
        if (proxy_response.statusCode === 304)
        {
            res.end();
            return;
        }

        /**
         * Send results from the proxy server back to the originating
         * client.
         */
        proxy_response.addListener('data', function(chunk)
        {
            res.write(chunk, 'binary');
        });
        proxy_response.addListener('end', function()
        {
            res.end();
        });

    });

    /**
     * Wire it all up, old-school.
     */
    req.addListener('data', function(chunk)
    {
        proxy_request.write(chunk, 'binary');
    });

    req.addListener('end', function()
    {
        proxy_request.end();
    });

    /**
     * Our work here is done.
     */
    return;

}


/**
 * Last ditch error-recovery
 */
process.on('uncaughtException', function(err)
{
    console.log("ERROR:" + err);
    console.log(err.stack);
});

/**
 **
 **  Start of running code.
 **
 **/

/**
 * Parse any command line options which might be present.
 */
parseCommandLine();

/**
 * Load our configuration file.
 */
loadConfigFile(cmdline['config']);

/**
 * If we're just to dump then do so.
 */
if (cmdline['dump'])
{
    dumpOptions();
    process.exit(0);
}

/**
 * Launch and display our starting options.
 */
console.log("node-reverse-proxy.js v" + VERSION + "\n");

/**
 * Port is either that from the command-line parser, or from the
 * configuration file.
 */
var port = cmdline['port'] || global.port;

/**
 * Bind to each requested address, as defined in the configuration file.
 */
for (val in global.bind)
{
    console.log("Binding to " + global.bind[val] + ":" + port);
    http.createServer().addListener("request", handler).listen(port, global.bind[val]);
}

/**
 * Now we're cooking on gas.
 */
console.log("\nAwaiting requests ...");
