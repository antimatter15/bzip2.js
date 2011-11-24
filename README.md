So, I guess this would be the readme file for my bzip2 implementation.

It's actually pretty simple to use, you can pass your `Uint8Array` to the `bzip2.array` method to get a bit reader function. This bit reader function is what all the other methods, `header`, `decompress`, and `simple` use. 

`header(bitstream)` quite obviously reads in the bzip2 file header. It returns a single number between 1 and 9 describing the block size, which is one of the arguments of `decompress`

`decompress(bitstream, size[, len])` does the main decompression of a single block. It'll return -1 if it detects that it's the final block, otherwise it returns a string with the decompressed data. If you want to cap the output to a certain number of bytes, set the `len` argument.

`simple(bitstream)` is what you probably want to use, because it combines `header` and loops over `decompress` so that the entire file is decompressed and returned as a string.

`array(typed_array)` is the function that generates that mythical bitstream function from a standard `Uint8Array` which you can make from an array buffer with `new Uint8Array(arraybuffer)`.
