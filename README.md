![Rowan Framework](http://idmillington.github.com/rowan/media/img/logo.png)

Rowan Framework
===============

**Rowan** is a **Hierarchical Microframework** for
[node](http://github.com/ry/node/) (currently targetting
[0.1.94](http://github.com/ry/node/commits/v0.1.94))


What is a Hierarchical Framework?
---------------------------------

Web frameworks are built around the architectural pattern of the
*dispatcher*. A dispatcher is a piece of code that looks at a message
(in the web case, an incoming HTTP request) and sends it off to some
piece of code for processing. Using a dispatch based system makes it
easy to modularize your web app. And that should reduce your
maintenance burden, make new features easier to add, and make your
code more reusable.

There are a couple of criteria that are commonly used to dispatch
requests. The most common is the *URL*. You create a list of URLs
(often regular expressions for those frameworks inspired by
[Django](http://djangoproject.com/)), and if an incoming request
matches one of those URLs, the framework asks a corresponding piece of
code to generate a response.

A second important criteria is the *HTTP method* (e.g. POST, GET or
PUT). Some frameworks, notably those inspired by Ruby's
[Sinatra](http://sinatra.github.com/), support this by default too. It is
essential if you want your framework to be able to support RESTful
webservices as well as just HTML web-sites.

But there are other criteria too: sometimes you need different
behavior based on the *HTTP Headers* you receive. You may want to
respond to `Cache-Control` data, or look at the values in a `Cookie`
before responding, or dispatch based on the `Accept-Language` codes
that the client can read, or on the `User-Agent` that hints at their
browser's capabilities.

Each framework typically chooses a fixed structure for these
dispatches. Normally they force you to dispatch on URL first, then
(for those frameworks that support it) on HTTP method. Some
frameworks, to compensate for the woeful lack of flexibility this
provides, then wrap the whole system in a completely separate
mechanism so you can alter the dispatching logic if you need to
dispatch on another criteria. Django's caching middleware works this
way, for example, but it only serves to confuse the fact that,
actually, it is performing a dispatch service based on HTTP header.

A **Hierarchical Framework** is different, and better engineered. It
provides a set of dispatchers that can be combined in any way you
choose, hierarchically. So you can first check for matching URLs, then
for some of those URLs, further refine your dispatch based on HTTP
method. Or you can first distinguish based on cache information, and
return early if possible, then defer matching URLs for those requests
that fail the cache look-up. Or you can first split by HTTP method,
and only later determine what resource the user is accessing or
altering. In short, a hierarchical framework makes the dispatcher part
of the toolkit, to be used and configured however you like.


How a Rowan App is Structured
-----------------------------

In Rowan, each node of the hierarchy is called a *controller*. The
overall hierarchy is called a *tree*.

Each controller in the tree has the same structure: it takes a context
object that contains both the Node.js request and response objects and
a callback function that it will notify when it is done.

If the controller has some response to send to the user, it can write
that content into the response object. Alternatively, the controller
might serve only to dispatch the request to one of a further set of
controllers. Eventually, a controller should generate a response or
find some error. In either case, it calls the callback function to
notify Rowan that the request has been processed, or that an error was
encountered.

Controllers are composed into a tree structure, making it very easy to
customize the behavior of whole chunks of a site and to implement
fall-over behavior, security wrappers, authentication, and so on.

Most often, the trees can be relatively flat. They might have an
`error_handler` node at their root (which catches and reports any
problems in the tree), then a single URL `router` which forwards
different urls to controllers that generate the correct output. This
pattern is shown in the first example application.

![An example Rowan structure](http://idmillington.github.com/rowan/media/img/rowan-dispatch.png)

The illustration above shows the structure of a web-site with its own
API. It shows the way these simple components can work together to
build a complex strucutre. The first controller in the tree determines
from the URL whether the request is part of the human readable site or
an API request. If it is part of the human-readable site, an error
handler is added that will generate a HTML formatted, helpful error
message if something goes wrong. Then another URL router decides which
of a series of controllers gets to respond to the user's request.

If the initial router determines that the request is an API request,
then the next controller will attempt to confirm that the user has a
valid license key. If this succeeds another error handler catches
further errors and the request is dispatched to the correct controller
by its HTTP method. Notice that no matter where the source of the
error in the API section of the site, the same error handler will be
called. This illustrates a feature of Rowan - its trees can merge as
well as diverge (strictly, the tree is actually a directed graph, and
usually you want it to be acyclic).

Acknowledgments
----------------

The code is based on my Python/WSGI Rowan framework code (on github at
http://github.com/idmillington/Rowan-Python). There are two major
differences between this Node.js implementation and that:

1. This version doesn't have the hierarchical blackboard data
structure that can be useful for hiding data from controllers. I might
add this later, it certainly improves modularity.

2. Because Node.js doesn't have an established templating language, I
have added a simple templating system. Possibly too simple!

I am using this microframework as the glue in an SOA project,
integrating with conventional servers, databases and CouchDB.

It has been updated to work with Node 0.1.94. Its upgrade to support
the radical changes in Node 0.1.30 say updates to much of the code and
API and made it considerably simpler as a result.

Get in touch with any observations or questions.

---

Copyright (c) 2009-2010 Ian Millington. See the LICENSE file for details.
