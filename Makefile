#
#  Show the available targets
#
nop:
	rm *~ || true


#
#  Remove any editor files.
#
clean:
	@find . \( -name '*.bak' -o -name '*~' \) -delete


#
#  If we have test cases, run them
#
test:
	@./tests/run-tests

#
#  Indent our code consistently.
#
tidy:
	@[ -x /usr/bin/js_beautify ] || echo "apt-get install libjavascript-beautifier-perl"
	@[ -x /usr/bin/js_beautify ] && js_beautify -p -o rewrites.js
	@[ -x /usr/bin/js_beautify ] && js_beautify -p -o node-reverse-proxy.js
	@[ -x /usr/bin/perltidy ]    && perltidy ./tests/run-tests


#
#  Steve's personal deployer.  Nice.
#
deploy:
	rsync -vazr *.js root@steve.org.uk://etc/service/node-reverse-proxy/
