class ArrayBufferReader {
  constructor(src) {
    this.src = src;
    this.chunksize = 64*1024; // 64k chunk size
    this.readahead = 0; // Readahead not implemented yet
    this.chunks = {};
    this.length = undefined;
    this.chunkable = false;

    if (this.src) {
      this.getLength()
    }
  }
  async getLength() {
    if (this.length !== undefined) {
      return this.length;
    } else {
      return fetch(this.src, { method: 'HEAD' })
        .then(res => this.handleHeadResponse(res))
        .catch (e => {
          console.log('HEAD not supported, disable chunking');
          return this.getWholeFile().then(f => f.length);
        });
    }
  }
  handleHeadResponse(res) {
    let length = parseInt(res.headers.get('content-length')),
        acceptranges = res.headers.get('accept-ranges');

    if (length) {
      this.length = length;
      if (acceptranges) {
        this.chunkable = true;
      }
    }
    return this.length;
  }
  async getBytes(startbyte, endbyte) {
    let startchunk = Math.floor(startbyte / this.chunksize),
        endchunk = Math.ceil(endbyte / this.chunksize);
    if (this.chunkable) {
      return this.getChunks(startchunk, endchunk)
          .then(chunks => this.data.subarray(startbyte, endbyte));
    } else {
      console.warn('Chunking not supported, downloading the whole file instead');
      return this.getWholeFile().then(filedata => filedata.subarray(startbyte, endbyte));
      
    }
  }
  async getChunks(start, end) {
    if (!this.data) {
      this.data = new Uint8Array(this.length);
    }
    return fetch(this.src, {headers: { Range: 'bytes=' + (start * this.chunksize) + '-' + (end * this.chunksize - 1) } })
      .then(res => res.arrayBuffer())
      .then(buffer => {
        let bytes = new Uint8Array(buffer);
        this.data.set(bytes, start * this.chunksize);
        //console.log('chunks got', start, end, bytes, this.data);
        let subarr = this.data.subarray(start * this.chunksize, end * this.chunksize);
        //console.log(subarr);
        return subarr;
      });
  }
  async getWholeFile() {
    if (this.data) {
      return this.data;
    } else {
      return fetch(this.src)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          this.data = new Uint8Array(buffer);
          return this.data;
        });
    }
  }
}

