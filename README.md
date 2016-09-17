## Extract Modules Webpack Plugin

This plugin will extract modules from any entry bundle into any number of arbitrarily defined smaller bundles

### Why?

- Browsers will open [between 6 and 10][browserscope] parallel connections to a single host. By splitting up one large
file (your main bundle) into a number of smaller ones, you can leverage these connections to download the files
[faster][stevesouders].
- It's likely that you will have some third party scripts which you change infrequently. By putting these into their own
bundle, then if they haven't changed between builds, your users may still be able to use the cached version from before.

### How?

Configuration of the plugin is simple. You instantiate the plugin with a single array of objects (lets call them buckets) with the keys `name` and `test`. Any modules which are in your entry chunk which match the
bucket's regular expression inside test (first matching bucket is used), are then moved to a new chunk with the given name.

Further limiting can be achieved using the options `only` (whitelist) and `except` (blacklist). They both accept either a single or an array of entry bundle names.

Creating a 'catch-all' bucket is not necessary: anything which doesn't match one of the defined buckets will be left in
the original chunk.

### Example

```js
var ExtractModulesPlugin = require('extract-modules-webpack-plugin');
module.exports = {
  entry: {
    app: 'app.js',
    frameworks: 'frameworks.js'
  },
  output: {
    path: __dirname + '/public',
    filename: "[name]-[chunkhash].js",
    chunkFilename: "[name]-[chunkhash].js"
  },
  plugins: [
    new ExtractModulesPlugin([{
        name: 'vendor',
        test: /vendor\//,
        except: 'frameworks'
      }, {
        name: 'views',
        test: /views\//,
        only: 'app'
    }])
  ]
};
```

An an example structure of modules included in the entry chunk:

```
/lib
    /views
        /list.js
        /grid.js
    /url.js
/vendor
    /jquery.js
    /backbone.js
/views
    /home.js
    /banner.js
/app.js
/frameworks.js (requires vendor/backbone.js)
```

The output would be three files:

- `app-[hash].js`, containing:
    - `app.js`
    - `lib/url.js`
- `vendor-[hash].js`, containing:
    - `vendor/jquery.js`
- `frameworks-[hash].js`, containing:
    - `vendor/backbone.js`
- `views-[hash].js`, containing:
    - `lib/views/list.js`
    - `lib/views/grid.js`
    - `views/home.js`
    - `views/banner.js`

[browserscope]: http://www.browserscope.org/?category=network&v=1
[stevesouders]: http://www.stevesouders.com/blog/2013/09/05/domain-sharding-revisited/
