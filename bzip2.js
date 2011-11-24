//echo "hello world" | bzip2 | hexdump -C | cut -c9-60
var test = "42 5a 68 39 31 41 59 26  53 59 4e ec e8 36 00 00    02 51 80 00 10 40 00 06  44 90 80 20 00 31 06 4c    41 01 a7 a9 a5 80 bb 94  31 f8 bb 92 29 c2 84 82    77 67 41 b0";
//[].slice.call(arr,0).map(function(e){return String.fromCharCode(e)})
var tmp = test.split(/\s+/), fytes = new Uint8Array(tmp.length);
tmp.forEach(function(e, i){
  fytes[i] = parseInt(e, 16);
})


var outputstr = "";


function decompress(bytes){
var bptr = 0, byptr = 0;
var BITMASK = [0, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF ];

pbits = function(n, movePointers) {
  if (n <= 0 || typeof n != typeof 1) {
    return 0;
  }

  var movePointers = movePointers || false,
    bytePtr = byptr,
    bitPtr = bptr,
    result = 0;

  while (n > 0) {
    var numBitsLeftInThisByte = (8 - bitPtr);
    if (n >= numBitsLeftInThisByte) {
      result <<= numBitsLeftInThisByte;
      result |= (BITMASK[numBitsLeftInThisByte] & bytes[bytePtr]);
      bytePtr++;
      bitPtr = 0;
      n -= numBitsLeftInThisByte;
    }
    else {
      result <<= n;
      result |= ((bytes[bytePtr] & (BITMASK[n] << (8 - n - bitPtr))) >> (8 - n - bitPtr));

      bitPtr += n;
      n = 0;
    }
  }

  if (movePointers) {
    bptr = bitPtr;
    byptr = bytePtr;
  }

  return result;
};

function bits(n){
  return pbits(n, true);
}

var selectors = new Uint8Array(32768);

if(bits(8*3) != 4348520) throw "No magic number found";
var i = bits(8) - 48;
if(i < 1 || i > 9) throw "Not a BZIP archive";
var bufsize = 100000 * i;
var buf = new Uint32Array(bufsize);

function readData(){
var header = "";
for(var i = 0; i < 6; i++){
  header += bits(8).toString(16);
}
if(header == "177245385090"){
  console.log('last block');
//  throw "i dont know what to do";
return -1;
}else if(header != '314159265359'){
  throw "eek not valid bzip data"
}
console.log(header);

var headerCRC = bits(32);
if(bits(1)) throw "Obsolete version of BZIP and unsupported";
var origPtr = bits(24);
if(origPtr > bufsize) throw "Initial position larger than buffer size";
t = bits(16)
var symToByte = new Uint8Array(256);
symTotal=0;
for (i = 0; i < 16; i++) {
	if(t & (1 << (15 - i))) {
		k = bits(16);
		for(j = 0; j < 16; j++)
			if(k & (1 << (15 - j)))
			  symToByte[symTotal++] = (16 * i) + j;
	}
}

groupCount = bits(3);
if(groupCount < 2 || groupCount > 6) throw "another error";
var nSelectors = bits(15);
if(nSelectors == 0) throw "meh";
var mtfSymbol = [] //new Uint8Array(256);
for(var i = 0; i < groupCount; i++){
  mtfSymbol[i] = i;
}
for(var i = 0; i < nSelectors; i++){
  for(var j = 0; bits(1); j++){
    if(j >= groupCount) throw "whoops another error"; 
  }
  uc = mtfSymbol[j];
//  console.log(mtfSymbol, j, uc)
  mtfSymbol.splice(j, 1);
  mtfSymbol.splice(0, 0, uc);
  selectors[i] = uc;
  //console.log('xel', j);
}

symCount=symTotal+2;
MAX_HUFCODE_BITS = 20;
MAX_SYMBOLS = 258;
var groups = [];
for (var j=0; j<groupCount; j++) {
	//unsigned char length[MAX_SYMBOLS],temp[MAX_HUFCODE_BITS+1];
	var length = new Uint8Array(MAX_SYMBOLS), temp = new Uint8Array(MAX_HUFCODE_BITS+1);
	var	minLen,	maxLen, pp;
	/* Read lengths */
	t= bits(5);
	for (var i = 0; i < symCount; i++) {
		for(;;) {
			if (t < 1 || t > MAX_HUFCODE_BITS) throw "I gave up a while ago on writing error messages";
				if(!bits(1)) break;
				if(!bits(1)) t++;
				else t--;
		}
		length[i] = t;
	}
	/* Find largest and smallest lengths in this group */
	minLen=maxLen=length[0];
	for(i = 1; i < symCount; i++) {
		if(length[i] > maxLen) maxLen = length[i];
		else if(length[i] < minLen) minLen = length[i];
	}
	hufGroup = groups[j] = {};
	hufGroup.permute = new Uint32Array(MAX_SYMBOLS);
	hufGroup.limit = new Uint32Array(MAX_HUFCODE_BITS + 1);
	hufGroup.base = new Uint32Array(MAX_HUFCODE_BITS + 1);
	hufGroup.minLen = minLen;
	hufGroup.maxLen = maxLen;
	base=hufGroup.base.subarray(1);
	limit=hufGroup.limit.subarray(1);
	/* Calculate permute[] */
	pp = 0;
	for(i=minLen;i<=maxLen;i++) 
		for(t=0;t<symCount;t++) 
			if(length[t]==i) hufGroup.permute[pp++] = t;
	/* Count cumulative symbols coded for at each bit length */
	for (i=minLen;i<=maxLen;i++) temp[i]=limit[i]=0;
	for (i=0;i<symCount;i++) temp[length[i]]++;
	/* Calculate limit[] (the largest symbol-coding value at each bit
	 * length, which is (previous limit<<1)+symbols at this level), and
	 * base[] (number of symbols to ignore at each bit length, which is
	 * limit-cumulative count of symbols coded for already). */
	pp=t=0;
	for (i=minLen; i<maxLen; i++) {
		pp+=temp[i];
		limit[i]=pp-1;
		pp<<=1;
		base[i+1]=pp-(t+=temp[i]);
		//console.log("xero", hufGroup.limit[i], limit[i], i)
	}
	limit[maxLen]=pp+temp[maxLen]-1;
	base[minLen]=0;
	
//	console.log("zero", hufGroup.limit[5]);
}

var byteCount = new Uint32Array(256);
for(var i = 0; i < 256; i++) mtfSymbol[i] = i;
runPos = dbufCount = symCount = selector = 0;
SYMBOL_RUNA = 0;
SYMBOL_RUNB = 1;
GROUP_SIZE = 50;
	//console.log("symcount", symCount);
for(;;) {
	/* Determine which huffman coding group to use. */
	if(!(symCount--)) {
		symCount=GROUP_SIZE-1;
		//console.log("sel",selector, selectors[selector])
		if(selector>=nSelectors) throw "meow i'm a kitty, that's an error";
		hufGroup=groups[selectors[selector++]];
//		base = hufGroup.base;
//		limit = hufGroup.limit;
			base=hufGroup.base.subarray(1);
    	limit=hufGroup.limit.subarray(1);
    	
    	//for(var i = 0; i < 13; i++){
    	//  console.log("base", i, base[i]);
    	//}
	}
	/* Read next huffman-coded symbol */
	i = hufGroup.minLen;
	j=bits(i);
	for(;;) {
		if (i > hufGroup.maxLen) throw "rawr im a dinosaur";
		
///  console.log("Got a moo ", limit[i], "for", i)
		if (j <= limit[i]) break;
		i++;
		j = (j << 1) | bits(1);
	}

	/* Huffman decode nextSym (with bounds checking) */
	j-=base[i];
	if (j < 0 || j >= MAX_SYMBOLS) throw "moo i am a cow";
	nextSym = hufGroup.permute[j];

	/* If this is a repeated run, loop collecting data */
	if (nextSym == SYMBOL_RUNA || nextSym == SYMBOL_RUNB) {
		/* If this is the start of a new run, zero out counter */
		if(!runPos) {
			runPos = 1;
			t = 0;
		}
		if (nextSym == SYMBOL_RUNA) t += runPos;
		else t += 2*runPos;
		runPos <<= 1;
		continue;
	}
	if(runPos) {
		runPos=0;
		if(dbufCount+t>=bufsize) throw "Boom. yeah. that's it";

		uc = symToByte[mtfSymbol[0]];
		byteCount[uc] += t;
		while(t--) buf[dbufCount++]=uc;
  	//console.log("zoop a poop", uc, mtfSymbol[0]);
	}
	/* Is this the terminating symbol? */
	if(nextSym>symTotal) break;
	if(dbufCount>=bufsize) throw "well it took me like an hour to write this error message so you better appreciate it";
	i = nextSym - 1;
	uc = mtfSymbol[i];
	//memmove(mtfSymbol+1,mtfSymbol,i);
  	//console.log("moop a zoop", uc, i);
	mtfSymbol.splice(i, 1);
  mtfSymbol.splice(0, 0, uc);

	//mtfSymbol[0] = uc;
	uc=symToByte[uc];
	/* We have our literal byte.  Save it into dbuf. */
	byteCount[uc]++;
	buf[dbufCount++] = uc;
}
//console.log("monkey", origPtr, dbufCount, bufsize);
if(origPtr < 0 || origPtr >= dbufCount) throw "I'll pretend that I'm a monkey and I'm throwing something at someone, namely you";
j = 0;
for(i = 0; i < 256; i++){
  k = j + byteCount[i];
  byteCount[i] = j;
  j = k;
}

for(var i = 0; i < dbufCount; i++){
  uc = buf[i] & 0xff;
  buf[byteCount[uc]] |= (i << 8);
  byteCount[uc]++;
}

if(dbufCount) {
	writePos=buf[origPtr];
//	console.log(buf[origPtr])
  writeCurrent=(writePos&0xff);
	writePos>>=8;
	writeRun=-1;
}
//console.log(writePos, writeCurrent, writeRun)
writeCount=dbufCount;

}

readData()
gotcount = 0
for(;;) {
  console.log("poopy");
	if(writeCount<0) throw "this shouldn't actually be an error, but for now it is"; //return bd->writeCount;
	/* If we need to refill dbuf, do it. */
	if(!writeCount) {
	  
	  if(readData() == -1){
	    console.log("terminatoring");
	    break;
	  }
		//throw "this shoudn't be an error but too bad it is";
	}
	/* Loop generating output */
	count=writeCount;
	pos=writePos;
	current=writeCurrent;
	run=writeRun;
//		console.log("WOWW",pos);
	while(count) {
		/* If somebody (like busybox tar) wants a certain number of bytes of
		data from memory instead of written to a file, humor them */
		//if(len && bd->outbufPos>=len) goto dataus_interruptus;
		count--;
		/* Follow sequence vector to undo Burrows-Wheeler transform */
		previous = current;
		pos = buf[pos];
		current=pos&0xff;
		pos >>= 8;
		/* Whenever we see 3 consecutive copies of the same byte,
		   the 4th is a repeat count */
		if(run++==3) {
			copies=current;
			outbyte=previous;
			current=-1;
		} else {
			copies=1;
			outbyte=current;
		}
		/* Output bytes to buffer, flushing to file if necessary */
		while(copies--) {
		  outputstr += (String.fromCharCode(outbyte))
			//if(bd->outbufPos == IOBUF_SIZE) flush_bunzip_outbuf(bd,out_fd);
			//outbuf[bd->outbufPos++] = outbyte;
			//bd->dataCRC = (bd->dataCRC << 8)	^ bd->crc32Table[(bd->dataCRC >> 24) ^ outbyte];
		}
		if(current!=previous) run=0;
	}
	
	writeCount = count;
	/* Decompression of this block completed successfully */
	//bd->dataCRC=~(bd->dataCRC);
	//bd->totalCRC=((bd->totalCRC << 1) | (bd->totalCRC >> 31)) ^ bd->dataCRC;
	/* If this block had a CRC error, force file level CRC error. */
	//if(bd->dataCRC!=bd->headerCRC) {
	//	bd->totalCRC=bd->headerCRC+1;
	//	return RETVAL_LAST_BLOCK;
	//}
	
}
}


var xhr = new XMLHttpRequest();
xhr.open('GET', 'swab.bz2', true);
xhr.responseType = 'arraybuffer';
xhr.send();
var logconsole = '';
xhr.onload = function(){
   result = xhr.response;
    console.log('ready');
}
