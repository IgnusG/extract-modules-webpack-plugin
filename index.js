const Entrypoint = require('webpack/lib/Entrypoint');

var ExtractModulesPlugin = module.exports = function (buckets) {
  const genericError = 'Invalid use of ExtractModulesPlugin: ';
  try {
    this.buckets = buckets.map(function (bucket) {
      if (!bucket.name && !(bucket.name instanceof String))
        throw new Error('you need to provide a name for each bucket');

      if (!bucket.test)
        throw new Error('you need to provide a valid regular expression for each bucket');
      if (!(bucket.test instanceof RegExp))
        bucket.test = new RegExp(bucket.test);
      bucket.test = bucket.test.test.bind(bucket.test);

      if (bucket.only)
        if (!(bucket.only instanceof Array))
          bucket.only = [bucket.only];

      if (bucket.except) {
        if (!(bucket.except instanceof Array))
          bucket.except = [bucket.except];
      } else bucket.except = [];

      return bucket;
    });
  } catch (e) {
    throw new Error(genericError + 'use ExtractModulesPlugin([ name: "vendor", test: /node_modules/ ]) > ' + e.message)
  }
};

ExtractModulesPlugin.prototype.apply = function (compiler) {
  var buckets = this.buckets;

  function findMatchingBucket(chunk) {
    return buckets.find(function (bucket) {
      if (bucket.test(chunk.resource)) {
        return bucket;
      }
    });
  }

  /** @returns {boolean} whether chunk is on blacklist */
  function isChunkIgnored(chunk, bucket) {
    return bucket.except.indexOf(chunk.name) != -1;
  }

  /** @returns {boolean} whether chunk is not on whitelist */
  function isChunkExcluded(chunk, bucket) {
    return !!bucket.only && bucket.only.indexOf(chunk.name) == -1
  }

  compiler.plugin("compilation", function (compilation) {
    var extraChunks = {};

    // Find the chunk which was already created by this bucket.
    // This is also the grossest function name I've written today.
    function bucketToChunk(bucket) {
      return extraChunks[bucket.name];
    }

    compilation.plugin("optimize-chunks", function (chunks) {
      var addChunk = this.addChunk.bind(this);
      var chunksWithExtractedModules = {};

      chunks
        .filter(function (chunk) {
          return chunk.isInitial() && chunk.name;
        })
        .forEach(function (chunk) {
          var newChunk;

          chunk.modules.slice().forEach(function (mod) {
            var bucket = findMatchingBucket(mod);

            if (!bucket) return;
            if (isChunkIgnored(chunk, bucket)) return;
            if (isChunkExcluded(chunk, bucket)) return;

            if (!(newChunk = bucketToChunk(bucket))) {
              newChunk = extraChunks[bucket.name] = addChunk(bucket.name);
            }

            chunk.moveModule(mod, newChunk);
          });

          if (newChunk) {
            if (chunksWithExtractedModules[newChunk.name])
              chunksWithExtractedModules[newChunk.name].push(chunk);
            else
              chunksWithExtractedModules[newChunk.name] = [chunk];
          }
        });

      buckets.map(bucketToChunk).filter(Boolean).forEach(function (newChunk) {

        // All non-runtime chunks need an entrypoint pointing to themself
        // Without this the chunk's name will be incorrect
        newChunk.entrypoints.unshift(new Entrypoint(newChunk.name));
        newChunk.entrypoints[0].chunks.push(newChunk);

        // New chunks need to have an entrypoint connection to the runtime
        // Without this entries will not be correctly mapped between requires and new chunks
        var chunk = chunksWithExtractedModules[newChunk.name][0];
        var manifestEntrypoint = chunk.entrypoints[0];

        newChunk.entrypoints.unshift(manifestEntrypoint);
        manifestEntrypoint.chunks.push(newChunk);

        // Finding parents (10x better than Finding Dory)
        // Without this dependencies that were separated by other means but required by our new chunk would be duplicated
        var commonParents = [];
        chunksWithExtractedModules[newChunk.name].forEach(function (chunk) {
          commonParents = commonParents.filter(common => common != chunk);
          commonParents = commonParents.concat(
            chunk.parents.filter(parent => !commonParents.some(common => parent == common))
          );
        });
        newChunk.parents = commonParents;
      })
    });
  });
};
