var fs = require('fs');
var bz2 = require('./bzip2.js');

var bufferSize = 1;

var reader = fs.createReadStream('test.txt.bz2', { bufferSize: bufferSize });

// var blockSize;
// reader.on('data', function (data) {
// 	var bitReader = bz2.array(data);
// 	if (!blockSize) {
// 		blockSize = bz2.header(bitReader);
// 	}
// 	console.log( bz2.decompress(bitReader, blockSize) );
// });


// var bit = 0, readBytes = 0;
// var BITMASK = [0, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF ];


// var buffer = new Buffer(0)
// var hasBytes = 0;
// var blockOffset = 0;
// var blockSize = 0;

// function bitReader(n){
// 	var result = 0;
// 	while(n > 0){
// 		var left = 8 - bit;
// 		var currentByte = buffer[readBytes - blockOffset];
// 		if(n >= left){
// 			result <<= left;
// 			result |= (BITMASK[left] & currentByte);
// 			readBytes++;
// 			bit = 0;
// 			n -= left;
// 		}else{
// 			result <<= n;
// 			result |= ((currentByte & (BITMASK[n] << (8 - n - bit))) >> (8 - n - bit));
// 			bit += n;
// 			n = 0;
// 		}
// 	}
// 	return result;
// }

// reader.on('data', function (data) {
// 	var newData = data.length;
// 	blockOffset = readBytes;
// 	var newBuffer = new Buffer(hasBytes - readBytes + newData); //create a buffer for all the unread bytes
// 	buffer.copy(newBuffer, 0, hasBytes - readBytes);
// 	data.copy(newBuffer, hasBytes - readBytes);
// 	buffer = newBuffer;
// 	hasBytes += data.length;
// 	if(hasBytes - readBytes > blockSize){
// 		if(!blockSize){
// 			blockSize = bz2.header(bitReader);
// 		}else{
// 			bz2.decompress(bitReader, blockSize)
// 		}
// 	}	
// })


var bit = 0, readBytes = 0, readOffset = 0;
var BITMASK = [0, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF ];
var bufferQueue = [];
var buffer = [];

function bitReader(n){
	var result = 0;
	while(n > 0){
		var left = 8 - bit;
		if(buffer.length == readBytes - readOffset){
			readOffset = readBytes;
			buffer = bufferQueue.shift();
		}
		
		var currentByte = buffer[readBytes - readOffset];
		if(n >= left){
			result <<= left;
			result |= (BITMASK[left] & currentByte);
			readBytes++;
			bit = 0;
			n -= left;
		}else{
			result <<= n;
			result |= ((currentByte & (BITMASK[n] << (8 - n - bit))) >> (8 - n - bit));
			bit += n;
			n = 0;
		}
	}
	return result;
}
var blockSize = 0;
function decompressBlock(){
	if(!blockSize){
		blockSize = bz2.header(bitReader);
		console.log("got header of", blockSize)
	}else{
		var chunk = bz2.decompress(bitReader, blockSize);
		if(chunk == -1){
			console.log('done')
		}else{
			console.log(chunk)
		}
	}
}

var hasBytes = 0;
reader.on('data', function (data) {
	bufferQueue.push(data);
	hasBytes += data.length;
	if(hasBytes - readBytes > (100000 * blockSize || 10)){
		console.log('decompressing with ', hasBytes)
		decompressBlock()
	}
})
reader.on('end', function (data) {
	decompressBlock()
})