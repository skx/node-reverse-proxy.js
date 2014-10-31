
Homepage:
    http://www.steve.org.uk/Software/node-reverse-proxy

Repository:
    http://github.com/skx/node-reverse-proxy.js/

Author:
    Steve Kemp <steve@steve.org.uk>





Introduction
------------

node-reverse-proxy is a simple reverse HTTP proxy, which is designed
to listen upon a public IP address, and redirect each incoming
request to a back-end server.

The reverse proxy is written with the intention that multiple virtual
hosts will each have their own back-end server to handle them, so it
must mediate incoming requests and dispatch each one to the appropriate
server by examining the submitted Host-header  present in each incoming
HTTP request.

Due to the scalable event-based model node.js uses this reverse-proxy
server can handle many many concurrent connections without the heavy-weight
resource-usage of a larger solution such as Apache.



Features
--------

In addition to proxying incoming connections to remote HTTP servers,
on a per-virtualhost basis, this server can also rewrite requests before
they are proxied, and alter the response from the proxy server before
it is sent back to the originating client.

Simple rewrites of incoming requests may be specified either by:

* Regular expressions matched against the incoming URL requested, in
a similar fashion to the way that "RewriteRule" works in Apache's
mod_rewrite.

* Via Javascript callbacks, which are based upon the requested URL path.

Both of these are demonstrated by the configuration files provided in
the ./examples subdirectory.



Installation
------------

To install the software you need only have the node.js binary
installed upon your system, and the "node-reverse-proxy.js" file
located upon your filesystem.

Once you've created a suitable configuration file the proxy may
be launched as:

    $ node ./node-reverse-proxy.js --config ./rules.js

This will load the rules you've defined in the file "rules.js" and launch
the server appropriately.


The Configuration File
----------------------

The configuration file is the core of the reverse-proxy, and it will generally contain three things:

* The global options, such as the address and port to bind upon.
* The list of virtual hosts for which requests will be proxied.
   * Requests for virtual hosts which aren't recognised will be ignored.
   * Although you can change this via a "wildcard virtual host" - as demonstrated in the filter example.
* The destination host & port to forward each request to.

Optionally you may also define & use:

* A list of rewrite rules to apply to incoming requests - based upon regular expression matches against incoming URLs.
* A list of functions to call for requests matching a particular regular expression.
* Pre/Post-request filters.

The simplest possible configuration file would define a single virtual host, and give the destination of a "back-end" proxy to route the incoming requests to. That configuration file would look something like this:

* [examples/one-vhost.js](examples/one-vhost.js)


**Note**:  The hostnames which are listed in the examples are actually regular expressions, so you can match multiple hosts with ease. This is best demonstrated via:

* [examples/regexp-vhosts.js](examples/regexp-vhosts.js)


The next most complex file might have a number of virtual hosts, including some simple rewrites of incoming requests. The simplest possible rewrite would be to redirect each incoming request against a particular host to another server. For example redirecting all visitors of "http://www.example.com/" to the preferred domain "http://example.com/ :

* [examples/one-host-rewrites.js](examples/one-host-rewrites.js)


Other Features
--------------

As documented on the [homepage](http://www.steve.org.uk/Software/node-reverse-proxy/) you can apply rewrites to incoming requests.

A simple rewriting example is:

    'example.com':
        {
           'port': '1020',
           'host': 'localhost',
           rules: {
                      '/random': '/cgi-bin/random.cgi',
                     '/people/([^/]+)/*$': '/people/$1.html',
           }
    },

This remaps http://example/people/bob/ to http://example.com/people/bob.html, as well as changing the requested URL for requests to http://example.com/random.

Similarly there is the facility to perform ACL-checks, and perform other complicated handling:

* [examples/wildcard-hosts.js](examples/wildcard-hosts.js) - Wildcard hosting with conditional handling.
* [examples/filters.js](examples/filters.js) - Filters applied before and after requests are executed.


Bugs?
-----

Please report bugs to the author, where they will be fixed as
quickly as possible.


Steve
--
