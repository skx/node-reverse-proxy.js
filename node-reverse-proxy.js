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
 * Are the command line flags --dump or --debug in play?
 */
var g_debug = false;
var g_dump = false;

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
     * Log, if being verbose.
     */
    if (g_debug) {
        console.log("Request for " + vhost + req.url + " from " + req.connection.remoteAddress);
    }

    /**
     * This is thttpd specific, but it seems that requests with two
     * leading "/" characters result in a "400 bad request" response.
     */
    if (req.url.substr(0, 2) == "//") {
        console.log("Request for BOGUS URL [http://" + vhost + req.url + "] from " + req.connection.remoteAddress);
        req.url = req.url.substr(1);
    }

    /**
     * If there is a port in the vhost-name then we'll drop it.
     */
    var port = vhost.indexOf(':');
    if ((port) && (port > 0)) {
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
    for (var host in global.options) {
        var hostRE = re_Hosts[host];
        if (hostRE.exec(vhost)) {
            ent = global.options[host];
            vhost = host;
        }
    }

    /**
     * If the table lookup succeeded then we have a request for a virtual
     * host we know about.
     */
    if (ent) {

        /**
         * Find any rewrite-rules which might be present for this vhost.
         */
        var rules = global.options[vhost]['rules'];

        if (rules) {
            Object.keys(rules).forEach(function(rule) {

                /**
                 * Find the pre-compiled regexp for this rule - execute it.
                 */
                var re = re_Rewrites[rule];
                var match = re.exec(req.url);

                if (match) {

                    /**
                     * If the rule matches we have a hit; we need
                     * to rewrite.
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
                    if (match.length > 1) {
                        var i = 1;
                        while (i <= match.length) {
                            newURL = newURL.replace("$" + i, match[i]);
                            i = i + 1;
                        }
                    }

                    /**
                     * If the destination rule begins with
                     * "http" we will instead issue a redirect.
                     */
                    if (newURL.match("^http")) {
                        res.writeHead(301, {
                            'Location': newURL
                        });
                        res.end();
                    } else {

                        /**
                         * Otherwise we'll update the request - on the basis
                         * that we're going to proxy it shortly.
                         */
                        req.url = newURL;
                    }
                }
            })
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

        if (func) {

            Object.keys(func).forEach(function(fun) {

                /* The name of the function is a regexp against the path. */
                if (req.url.match(fun)) {

                    if (global.options[vhost]['functions'][fun](orig_vhost, vhost, req, res)) {
                        over = true;
                    }
                }
            })
        }

        /**
         * If (at least one) functional hook returned true then we're
         * done with this request.
         */
        if (over) {
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
        if ((!port) || (!host)) {
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
        proxy.addListener('error', function(socketException) {
            console.log("Request for " + vhost + " failed - back-end server " + host + ":" + port + " unreachable");
            res.writeHead(503, {
                'content-type': 'text/html'
            });
            res.end('Back-end unreachable.');
        });

        /**
         * Append something to the user-agent, and add an
         * X-Forwarded-For: header.
         */
        var agent = ""
        if (req.headers["user-agent"]) {
            agent = req.headers["user-agent"] + "; ";
        }
        req.headers["X-Forwarded-For"] = req.connection.remoteAddress;
        req.headers["User-Agent"] = agent + "node-reverse-proxy.js";

        /**
         * Create the proxier
         */
        var proxy_request = proxy.request(req.method, req.url, req.headers);

        proxy_request.addListener('response', function(proxy_response) {

            /**
             * If we have a "Connection: foo" header preserve it.
             *
             * Otherwise defualt to "close".
             */
            if (proxy_response.headers.connection) {
                if (req.headers.connection) proxy_response.headers.connection = req.headers.connection;
                else proxy_response.headers.connection = 'close';
            }

            res.writeHead(proxy_response.statusCode, proxy_response.headers);

            /**
             * No 'data' event and no 'end'
             *
             * Missing this will lead to oddness - don't ask.
             */
            if (proxy_response.statusCode === 304) {
                res.end();
                return;
            }

            proxy_response.addListener('data', function(chunk) {
                res.write(chunk, 'binary');
            });
            proxy_response.addListener('end', function() {
                res.end();
            });

        });

        /**
         * Wire it all up, old-school.
         */
        req.addListener('data', function(chunk) {
            proxy_request.write(chunk, 'binary');
        });

        req.addListener('end', function() {
            proxy_request.end();
        });

        /**
         * Our work here is done.
         */
        return;

    }

    /**
     * OK we received a request for a vhost we don't know about.
     */
    res.writeHead(500, {
        'content-type': 'text/html'
    });
    res.end('Error finding host details for virtual host <tt>' + escape(vhost) + '</tt>');
};

/**
 * Last ditch error-recovery
 */
process.on('uncaughtException', function(err) {
    console.log("ERROR:" + err);
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

    if (inFile) {
        file = arg;
        inFile = false;
    }
    if (inPort) {
        port = arg;
        inPort = false;
    }
    if (arg.match("-+config")) {
        inFile = true;
    }
    if (arg.match("-+debug")) {
        g_debug = true;
    }
    if (arg.match("-+dump")) {
        g_dump = true;
    }
    if (arg.match("-+port")) {
        inPort = true;
    }
    if (arg.match("-+help")) {
        console.log("node-reverse-proxy [--help|--config file|--port N]");
        process.exit(1);
    }
})

/**
 * Ensure we weren't left dangling.
 */
if (inFile || inPort) {
    console.log("Missing argument!");
    process.exit(1);
}

/**
 * See if our named configuration file exists.
 */
if (path.existsSync(file)) {
    global = require(file);
} else {
    console.log("Configuration file not found - " + file);
    process.exit(1);
}

/**
 * Are we just dumping the configuration hash?
 */
if (g_dump) {
    Object.keys(global.options).forEach(function(vhost) {
        console.log("http://" + vhost + "/");

        /**
         * Dump host + port if present.
         */
        port = global.options[vhost]['port'] || "";
        host = global.options[vhost]['host'] || "127.0.0.1";

        var rules = global.options[vhost]['rules'];

        if (rules) {
            Object.keys(rules).forEach(function(rule) {
                console.log("\tRewriting " + rule + " to " + rules[rule]);
            })
        }

        if (host.length && port.length) {
            console.log("\tproxying to " + host + ":" + port);
        }

    });
    process.exit(0);
}

/**
 * Pre-compile each rewrite rule regular expression, and each vhost
 * regexp.
 *
 * Doing this offers a significant speedup.
 *
 */
Object.keys(global.options).forEach(function(vhost) {

    /**
     * Virtual Hostname regexp.
     */
    re_Hosts[vhost] = new RegExp("^" + vhost + "$");

    /**
     * Now process each existing rewrite rule for that vhost.
     */
    rules = global.options[vhost]['rules'];
    if (rules) {
        Object.keys(rules).forEach(function(rule) {
            re_Rewrites[rule] = new RegExp(rule);
        })
    }
})

/**
 * Launch our starting options.
 */
console.log("node-reverse-proxy.js starting, reading from " + file + "\n");

/**
 * Port is either that from the command-line parser, or from the
 * configuration file.
 */
var port = port || global.port;

/**
 * Bind to each requested address, as defined in the configuration file.
 */
for (val in global.bind) {
    console.log("Binding to " + global.bind[val] + ":" + port);
    http.createServer().addListener("request", handler).listen(port, global.bind[val]);
}

/**
 * Now we're cooking on gas.
 */
console.log("\nAwaiting orders ...");