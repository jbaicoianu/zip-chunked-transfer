# What is this?
A proof-of-concept to show loading files from remote zip files using HTTP ranged requests, allowing applications to access resources stored within large hosted zip files without having to download the whole thing into memory.

In theory, this should work with a wide variety of zip-based file formats, for instance:
 * .zip
 * .unitypackage
 * .pk3
 * .docx
 * .xlsx
 * ...many others

# Requirements
* In order for chunked zip loading to work, the server or CDN that hosts the .zip must support HTTP Range requests.
* In order to load zip files hosted on remote-origin servers, the server must send an appropriate `Access-Control-Allow-Origin` header.

# Who is responsible for this?
This project was created by James Baicoianu as a proof of concept of using remote archives efficiently in webapps.  Originally, it was intended for use with the Internet Archive's software emulation project, to allow for on-demand loading of files from zip and ISO files via emulated filesystems.  It's also proven useful for 3d engines that wish to load assets on-demand from remotely-hosted asset packs.
