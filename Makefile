.PHONY: build
build:
	blogator --outputDirectory tmp
	rm -f index.html
	rm -rf css
	rm -f favicon.ico
	cp -r tmp/* ./
	rm -rf tmp

