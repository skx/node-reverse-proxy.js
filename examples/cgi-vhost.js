/**
 *  This is an example configuration for a reverse proxy which listens
 * upon:
 *
 *     127.0.0.1:80
 *
 *  Each incoming request for the virtual host "proxy.example.com" is
 * handled by a function - and the net result is that you can interface
 * with the proxy to:
 *
 *    * Show the current uptime.
 *
 *    * Stop the proxy.
 *
 *  Any other request is ignored.
 *
 *  This script assumes the proxy is launched under the control of
 * "runit", and is called "node-reverse-proxy" - such that the following
 * command shows the uptime:
 *
 *      sv status node-revserse-proxy
 *
 *  Usage:
 *  -----
 *
 *  To use this configuration file please run:
 *
 *   ./node-reverse-proxy.js --config ./examples/cgi-vhost.js
 *
 *  Then point your browser at http://127.0.0.1/
 *
 */
exports.options = {

    'proxy.example.com': {
        'functions': {

            '/stop': (function(orig_host, vhost, req, res)
            {
                var remote = req.connection.remoteAddress;

                if ((remote != "::1") && (remote != "127.0.0.1") && (remote != "::1"))
                {
                    console.log("Ignored stop request from " + remote);
                    res.writeHead(403);
                    res.write("Denied access to " + req.url + " from " + remote);
                    res.end();
                    return true;
                }
                else
                {
                    console.log("Manually stopped by " + remote);
                    process.exit(1);
                    res.end();
                    return true;
                }

            }),

            '/uptime/*': (function(orig_host, vhost, req, res)
            {
                var remote = req.connection.remoteAddress;

                if ((remote != "::1") && (remote != "127.0.0.1") && (remote != "::1"))
                {
                    console.log("Ignored uptime request from " + remote);
                    res.writeHead(403);
                    res.write("Denied access to " + req.url + " from " + remote);
                    res.end();
                    return true;
                }
                else
                {
                    console.log("Uptime request from " + remote);
                    exec = require("child_process").exec;

                    res.writeHead(200, {
                        'content-type': 'text/plain'
                    });
                    exec("sv status node-reverse-proxy", function(err, stdout, stderr)
                    {
                        if (err)
                        {}
                        else
                        {
                            res.write(stdout);
                            res.end();
                            return true;
                        }
                    });
                    return true;
                }
            }),

            '^/$': (function(orig_host, vhost, req, res)
            {
                var remote = req.connection.remoteAddress;

                if ((remote != "::1") && (remote != "127.0.0.1") && (remote != "::1"))
                {
                    console.log("Ignored proxy request from " + remote);
                    res.writeHead(403);
                    res.write("Denied access to " + req.url + " from " + remote);
                    res.end();
                    return true;
                }
                else
                {
                    console.log("proxy index request from " + remote);
                    res.writeHead(200, {
                        'content-type': 'text/html'
                    });
                    res.end("<p>[ <a href=\"/stop\">stop</a> | <a href=\"/uptime\">uptime</a> ]</p>");
                    return true;

                }
            }),
        }
    },

};

/**
 * The port we listen upon.
 */
exports.port = 80;

/**
 * The addresses we will listen upon.
 */
exports.bind = new Array("127.0.0.1", "::1");
