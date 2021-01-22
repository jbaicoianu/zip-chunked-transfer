function readStringFromDataview(dataview, offset, length) {
  let strbytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    strbytes[i] = dataview.getUint8(offset + i);
  }
  return new TextDecoder('utf-8').decode(strbytes);
}
class ZipChunkedTransfer extends EventTarget {
  constructor(url=false) {
    super();
    if (url) {
      this.load(url);
    }
  }
  async load(url) {
/*
console.log('fetch file', url);
    return fetch(url).then(res => res.arrayBuffer())
              .then(data => this.readEOCDRecord(data))
              .then(record => this.readCDEntries(record.data, record.eocd))
              .then(entries => this.dispatchEvent(new CustomEvent('load')));
*/
    this.reader = new ArrayBufferReader(url);
    let length = await this.reader.getLength();
    if (length > 0) {
      this.readEOCDRecord()
          .then(record => this.readCDEntries(record))
          .then(entries => this.dispatchEvent(new CustomEvent('load')));
    }
  }
  async readEOCDRecord() {
    console.log('read EOCDRecord asynchronously');
    let offset = await this.searchBackwardsForSequence(0x06054b50);
console.log('found eocd offset', offset);
    if (offset) {
      let eocddata = await this.reader.getBytes(offset, await this.reader.getLength());
      let eocdbytes = new DataView(eocddata.buffer, eocddata.byteOffset, eocddata.byteLength)
console.log('got eocd bytes', eocddata, eocdbytes);
      let record = {
        disknum: eocdbytes.getUint16(4, true),
        diskcd: eocdbytes.getUint16(6, true),
        diskcdrecords: eocdbytes.getUint16(8, true),
        totalcdrecords: eocdbytes.getUint16(10, true),
        size: eocdbytes.getUint32(12, true),
        offset: eocdbytes.getUint32(16, true),
        commentlength: eocdbytes.getUint16(20, true),
        comment: ''
      };
      if (record.commentlength > 0) {
        record.comment = readreadStringFromDataview(eocdbytes, 22, record.commentlength);
      }
      this.eocd = record;
      return record;
    }
  }
  async readCDEntries(eocd) {
console.log('read central directory', eocd.offset, eocd.size, eocd, await this.reader.getLength());
    let cddata = await this.reader.getBytes(eocd.offset, eocd.offset + eocd.size);
    let cdbytes = new DataView(cddata.buffer, cddata.byteOffset, cddata.byteLength);
console.log('got cd bytes', cddata, cdbytes);
    let pos = 0;
    let entries = [];
    while (pos < eocd.size) {
      let cdentry = {
        sig: [
          cdbytes.getUint8(pos + 0),
          cdbytes.getUint8(pos + 1),
          cdbytes.getUint8(pos + 2),
          cdbytes.getUint8(pos + 3)
        ],
        versionCreate: cdbytes.getUint16(pos + 4, true),
        versionNeeded: cdbytes.getUint16(pos + 6, true),
        bitflags: cdbytes.getUint16(pos + 8, true),
        compressionMethod: cdbytes.getUint16(pos + 10, true),
        lastmodtime: cdbytes.getUint16(pos + 12, true),
        lastmoddate: cdbytes.getUint16(pos + 14, true),
        crc32: cdbytes.getUint32(pos + 16, true),
        compressedSize: cdbytes.getUint32(pos + 20, true),
        uncompressedSize: cdbytes.getUint32(pos + 24, true),
        filenameLength: cdbytes.getUint16(pos + 28, true),
        extraLength: cdbytes.getUint16(pos + 30, true),
        commentLength: cdbytes.getUint16(pos + 32, true),
        diskStart: cdbytes.getUint16(pos + 34, true),
        internalAttributes: cdbytes.getUint16(pos + 36, true),
        externalAttributes: cdbytes.getUint32(pos + 38, true),
        localFileHeaderOffset: cdbytes.getUint32(pos + 42, true),
      };
      cdentry.fileName = readStringFromDataview(cdbytes, pos + 46, cdentry.filenameLength);
      cdentry.extra = readStringFromDataview(cdbytes, pos + 46 + cdentry.filenameLength, cdentry.extraLength);
      cdentry.comment = readStringFromDataview(cdbytes, pos + 46 + cdentry.filenameLength + cdentry.extraLength, cdentry.commentLength);
      let lastchar = cdentry.fileName.substr(-1, 1);
      let pathparts = cdentry.fileName.split('/');
      if (lastchar == '/') pathparts.pop();
      cdentry.fileBaseName = pathparts.pop();
      entries.push(cdentry);
      pos += 46 + cdentry.filenameLength + cdentry.extraLength + cdentry.commentLength;
    }
    this.entries = entries;
    return entries;
  }
  async searchBackwardsForSequence(bytes) {
    let b = [
      (bytes & 0xff000000) >> 24,
      (bytes & 0x00ff0000) >> 16,
      (bytes & 0x0000ff00) >> 8,
      (bytes & 0x000000ff)
    ];
    let chunksize = 65536,
        end = await this.reader.getLength(),
        start = end - chunksize;

    while (start > 0) {
      let databytes = await this.reader.getBytes(start, start + chunksize);
      // FIXME - this logic could break if the sequence spans a block
      for (let i = databytes.length - 4; i > 0; i--) {
        if (databytes[i] != b[3]) continue;
        if (databytes[i+1] != b[2]) continue;
        if (databytes[i+2] != b[1]) continue;
        if (databytes[i+3] != b[0]) continue;
        return start + i;
      }
      end = start;
      start -= chunksize;
    }
  }
  async getByteRange(start, end) {
    let bytes = await this.reader.getBytes(start, end);
    return bytes
  }
  getDirectoryList() {
    return new Promise(resolve => {
      let files = {};
      if (this.entries) {
        for (let i = 0; i < this.entries.length; i++) {
          let entry = this.entries[i];
          files[entry.fileName] = entry;
        }
        resolve(files);
      } else {
        this.addEventListener('load', (ev) => {
          for (let i = 0; i < this.entries.length; i++) {
            let entry = this.entries[i];
            files[entry.fileName] = entry;
            resolve(files);
          }
        });
      }
    });
  }
  async getDirectoryTree() {
    let filelist = await this.getDirectoryList();
    let filetree = {fileName: '/', fileBaseName: '/'};
    for (let k in filelist) {
      let pathparts = k.split('/');
      let node = filetree;
      while (pathparts.length > 1) {
        let p = pathparts.shift();
        if (!(p in node)) node[p] = {fileName: filelist[k].fileName, fileBaseName: filelist[k].fileBaseName};
        node = node[p];
      }
      if (pathparts[0] != '') {
        node[pathparts[0]] = filelist[k];
      }
    }
    return filetree;
  }
  async getFile(name) {
    let files = await this.getDirectoryList();
    if (files[name]) {
      let f = files[name];
      let data = await this.getByteRange(f.localFileHeaderOffset, f.localFileHeaderOffset + f.compressedSize + 300); // FIXME - arbitrary size to account for header size
      return new ZippedFile(data);
    }
  }
}
class ZippedFile {
  constructor(bytes) {
    this.parse(bytes);
  }
  parse(bytes) {
    let dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    this.sig = [
        dv.getUint8(0),
        dv.getUint8(1),
        dv.getUint8(2),
        dv.getUint8(3)
      ];
    this.versionNeeded = dv.getUint16(4, true);
    this.bitflags = dv.getUint16(6, true);
    this.compressionMethod = dv.getUint16(8, true);
    this.lastmodtime = dv.getUint16(10, true);
    this.lastmoddate = dv.getUint16(12, true);
    this.crc32 = dv.getUint32(14, true);
    this.compressedSize = dv.getUint32(18, true);
    this.uncompressedSize = dv.getUint32(22, true);
    this.filenameLength = dv.getUint16(26, true);
    this.extraLength = dv.getUint16(28, true);
    this.fileName = readStringFromDataview(dv, 30, this.filenameLength);
    this.extra = readStringFromDataview(dv, 30 + this.filenameLength, this.extraLength);

    this.data = bytes.subarray(30 + this.filenameLength + this.extraLength, 30 + this.filenameLength + this.extraLength + this.compressedSize);

    this.fileBaseName = this.fileName.split('/').pop();
    
  }
  inflate() {
    return pako.inflateRaw(this.data);
  }
}

