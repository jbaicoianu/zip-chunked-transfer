const MimeTypes = {
  'txt': 'text/plain',
  'html': 'text/html',
  'htm': 'text/html',
  'url': 'text/x-uri',
  'uri': 'text/uri-list',
  'json': 'application/json',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg',
  'mp4': 'video/mp4',
  'glb': 'model/gltf-binary',
  'gltf': 'model/gltf+json',
  'dae': 'model/vnd.collada+xml',
  'obj': 'model/x-obj',
  'fbx': 'model/x-fbx',
  'stl': 'model/stl',
  'zip': 'application/zip',
};

class ZipViewer extends HTMLElement {
  connectedCallback() {
    let panel = document.createElement('header');
    let url = document.createElement('input');
    url.value = this.getAttribute('src') || 'samples/tower-defense-kit-1.zip';
    this.urlinput = url;
    let button = document.createElement('button');
    button.innerHTML = 'load';
    panel.appendChild(url);
    panel.appendChild(button);
    this.appendChild(panel);
    let files = document.createElement('zip-viewer-directory');
    this.appendChild(files);
    this.preview = document.createElement('zip-viewer-preview');
    this.appendChild(this.preview);
    this.rootdir = files;
    button.addEventListener('click', async (ev) => {

      this.load(url.value);
    });

    this.addEventListener('select', (ev) => this.selectItem(ev.detail));
    this.addEventListener('keydown', (ev) => this.handleKeyPress(ev))
    this.addEventListener('dragenter', (ev) => this.handleDragEnter(ev))
    this.addEventListener('dragover', (ev) => this.handleDragEnter(ev))
    this.addEventListener('drop', (ev) => this.handleDrop(ev))
    this.tabIndex = 1;
  }
  async load(url) {
    let zip = new ZipChunkedTransfer(url);
    this.zip = zip;

    let dirtree = await zip.getDirectoryTree();
    this.rootdir.setData(dirtree);
    this.selectItem(this.rootdir);
  }
  selectItem(item) {
    if (this.selectedItem !== item) {
      if (this.selectedItem) {
        this.selectedItem.selected = false;
      }
      this.selectedItem = item;
      this.selectedItem.selected = true;
      this.preview.set(item);

      let offsetTop = this.getScrollPosition(item);
      if (offsetTop + item.firstChild.offsetHeight > this.rootdir.scrollTop + this.rootdir.offsetHeight) {
        item.scrollIntoView();
      } else if (offsetTop < this.rootdir.scrollTop) {
        this.rootdir.scrollTo(0, offsetTop + item.firstChild.offsetHeight - this.rootdir.offsetHeight);
      }
    }
  }
  getScrollPosition(item) {
    let scrollpos = 0;
    let n = item;
    while (n !== this.rootdir) {
      scrollpos += n.offsetTop;
      n = n.offsetParent;
    }
    return scrollpos;
  }
  handleKeyPress(ev) {
    if (ev.key == 'ArrowUp') {
      if (this.selectedItem && this.selectedItem !== this.rootdir) {
        if (this.selectedItem.previousSibling) {
          if (this.selectedItem.previousSibling instanceof HTMLLabelElement) {
            this.selectItem(this.selectedItem.parentNode);
          } else if (this.selectedItem.previousSibling instanceof ZipViewerDirectory && !this.selectedItem.previousSibling.collapsed) {
            // recursively select the last file from uncollapsed directories
            let lastnode = this.selectedItem.previousSibling;
            while (lastnode instanceof ZipViewerDirectory && !lastnode.collapsed) {
              lastnode = lastnode.lastChild;
            }
            this.selectItem(lastnode);
          } else {
            this.selectItem(this.selectedItem.previousSibling);
          }
        }
      }
    } else if (ev.key == 'ArrowDown') {
      if (this.selectedItem && !(this.selectedItem === this.rootdir && this.rootdir.collapsed)) {
        if (this.selectedItem instanceof ZipViewerDirectory && !this.selectedItem.collapsed && this.selectedItem.childNodes.length > 1) {
          // Currently selecting an uncollapsed directory which has some children, descend into it
          this.selectItem(this.selectedItem.childNodes[1]);
        } else if (this.selectedItem.nextSibling) {
          // If we still have a next sibling, select it
          this.selectItem(this.selectedItem.nextSibling);
        } else {

            // recursively select the next file from our parents' next sibling
            let nextnode = this.selectedItem;
            while (nextnode !== this.rootdir) {
              if (nextnode.parentNode === this.rootdir) {
                nextnode = null;
                break;
              } else {
                nextnode = nextnode.parentNode;
                if (nextnode.nextSibling) {
                  nextnode = nextnode.nextSibling;
                  break;
                }
              }
            }
            if (nextnode) {
              this.selectItem(nextnode);
            }
        }
      }
    } else if (ev.key == 'ArrowLeft') {
      if (this.selectedItem instanceof ZipViewerDirectory && !this.selectedItem.collapsed) {
        this.selectedItem.collapsed = true;
      } else if (this.selectedItem !== this.rootdir) {
        this.selectItem(this.selectedItem.parentNode);
      }
    } else if (ev.key == 'ArrowRight') {
      if (this.selectedItem instanceof ZipViewerDirectory && this.selectedItem.childNodes.length > 1) {
        this.selectedItem.collapsed = false;
        this.selectItem(this.selectedItem.childNodes[1]);
      }
    } else if (ev.key == 'Escape') {
      this.preview.set(null);
    }
  }
  handleDragEnter(ev) {
    console.log(ev.type);
    ev.preventDefault();
  }
  handleDrop(ev) {
    console.log('drop');
    ev.preventDefault();
    var files = ev.dataTransfer.files,
        items = ev.dataTransfer.items;
    if (files.length > 0) {
      for (var i = 0; i < files.length; i++) {
        var file = files[i];
console.log(file);
        if (file.type == 'application/zip') {
          let url = URL.createObjectURL(file);
          this.load(url);
          this.urlinput.value = file.name;
        }
      }
    }
  }
}
class ZipViewerFile extends HTMLElement {
  set selected(v) { return (v && v != 'false' ? this.setAttribute('selected', v) : this.removeAttribute('selected')); }
  get selected() { return this.getAttribute('selected') == 'true'; }
  connectedCallback() {
    this.addEventListener('click', (ev) => this.handleClick(ev));
    this.addEventListener('touchstart', (ev) => this.handleTouchStart(ev));
    this.addEventListener('touchmove', (ev) => this.handleTouchMove(ev));
    this.addEventListener('touchend', (ev) => this.handleTouchEnd(ev));
  }
  setData(file) {
    this.file = file;
    this.innerHTML = '<label>' + file.fileBaseName + '</label> (' + (Math.round(file.uncompressedSize / 102.4) / 10) + 'kB)';
  }
  getZip() {
    let node = this;
    while (node.parentNode) {
      node = node.parentNode;
      if (node instanceof ZipViewer) {
        return node.zip;
      }
    }
  }
  async getFileData() {
    if (this.filedata) {
      return this.filedata;
    }
    let zip = this.getZip();
    if (zip) {
      return zip.getFile(this.file.fileName)
        .then(f => { 
          this.filedata = f;
          return this.filedata;
        });
    }
  }
  handleClick(ev) {
    if (!this.touchcancelled) {
      this.dispatchEvent(new CustomEvent('select', {bubbles: true, detail: this}));
    }
  }
  handleTouchStart(ev) {
    this.touchcancelled = false;
  }
  handleTouchMove(ev) {
    this.touchcancelled = true;
  }
  handleTouchEnd(ev) {
    if (!this.touchcancelled) {
      this.dispatchEvent(new CustomEvent('select', {bubbles: true, detail: this}));
      ev.preventDefault();
      ev.stopPropagation();
    }
  }
}
class ZipViewerPreview extends HTMLElement {
  async set(file) {
    if (!(file instanceof ZipViewerFile)) return;
    let compressed = await file.getFileData();
    let filedata = compressed.inflate();
    let filetype = this.detectType(file).split('/');
    if (filetype[0] == 'image') {
      if (!this.img) {
        this.img = document.createElement('img');
      }
      if (this.img.parentNode !== this) {
        this.innerHTML = '';
        this.appendChild(this.img);
      }
      let bloburl = URL.createObjectURL(new Blob([filedata]));
      this.img.src = bloburl;
      this.img.onload = () => URL.revokeObjectURL(bloburl);
    } else if (filetype[0] == 'video') {
      this.innerHTML = 'TODO - video preview goes here';
    } else if (filetype[0] == 'model') {
      this.innerHTML = 'TODO - 3d model preview goes here';
    } else if (filetype[0] == 'text') {
      this.innerText = new TextDecoder('utf-8').decode(filedata);
    } else {
      this.innerText = 'Unknown type: ' + filetype.join('/');
    }
  }
  detectType(filedata) {
/*
    let types = {
      png: [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],
      jpg: [0xff,0xd8,0xff],
      gif: [0x47,0x49,0x46,0x38],
      glb: [0x67, 0x6c, 0x54, 0x46],
    };
*/
    let fname = filedata.file.fileBaseName,
        idx = fname.lastIndexOf('.'),
        extension = filedata.file.fileBaseName.substr(idx+1);
    return MimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}
class ZipViewerDirectory extends HTMLElement {
  set collapsed(v) { return (v && v != 'false' ? this.setAttribute('collapsed', v) : this.removeAttribute('collapsed')); }
  get collapsed() { return this.getAttribute('collapsed') == 'true'; }

  set selected(v) { return (v && v != 'false' ? this.setAttribute('selected', v) : this.removeAttribute('selected')); }
  get selected() { return this.getAttribute('selected') == 'true'; }

  connectedCallback() {
    this.addEventListener('click', (ev) => this.handleClick(ev));
  }
  setData(files) {
    this.innerHTML = '<label>' + files.fileBaseName + '</label>';
    for (let k in files) {
      if (k == 'fileName' || k == 'fileBaseName') continue; // FIXME - hack, should represent files and directories with one nested class
      let file = files[k];
      let lastchar = (file.fileName ? file.fileName.substr(-1, 1) : '/'); 
      let element = document.createElement(lastchar == '/' ? 'zip-viewer-directory' : 'zip-viewer-file');
      if (element instanceof ZipViewerDirectory) {
        element.collapsed = true;
      }
      element.setData(file);
      this.appendChild(element);
    }
  }
  handleClick(ev) {
    if (ev.target === this) {
      this.collapsed = !this.collapsed;
      ev.preventDefault();
      ev.stopPropagation();
      this.dispatchEvent(new CustomEvent('select', {bubbles: true, detail: this}));
    }
  }
}
customElements.define('zip-viewer', ZipViewer);
customElements.define('zip-viewer-preview', ZipViewerPreview);
customElements.define('zip-viewer-file', ZipViewerFile);
customElements.define('zip-viewer-directory', ZipViewerDirectory);
