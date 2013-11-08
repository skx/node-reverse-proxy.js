
Homepage:
    http://www.steve.org.uk/Software/node-reverse-proxy

Repository:
    http://github.com/skx/node-reverse-proxy/

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

   node ./node-reverse-proxy.js --config ./rules.js

This will load the rules you've defined in the file "rules.js" and launch
the server appropriately.



Bugs?
-----

Please report bugs to the author, where they will be fixed as
quickly as possible.


Steve
--
