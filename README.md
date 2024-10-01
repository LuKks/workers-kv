# workers-kv

Cloudflare Workers KV for Node.js

```
npm i workers-kv
```

A global, low-latency, key-value data storage.

https://developers.cloudflare.com/kv/

## Usage

```js
const KV = require('workers-kv')

const kv = new KV('<account-id>', '<token>')

// Create a Namespace (can also get, list, and remove Namespaces)
const ns = await kv.namespace.create('accounts')

// Instantiate the Namespace to write/read key-value pairs
const db = kv.from(ns.id)

// Write an entry
await db.put('/users/123', { name: '' })

// Read an entry
const user = await db.get('/users/123')

// List key-value pairs (there is a prefix filter and cursor paging)
const list = await db.list()

// Delete a key-value pair
await db.del('/users/123')
```

## API (Namespaces)

#### `kv = new KV(accountId, token)`

Create a Workers KV Namespaces instance.

#### `ns = await kv.namespace.create(title)`

Create a Namespace.

Returns:

```js
{
  id: String,
  title: String,
  supports_url_encoding: Boolean
}
```

#### `ns = await kv.namespace.get(id)`

Get a Namespace.

Returns the same as the `create` method.

#### `await kv.namespace.remove(id)`

Remove a Namespace.

#### `ns = await kv.namespace.list([options])`

List Namespaces.

Returns:

```js
{
  result: Array, // [{ id, title, supports_url_encoding }, ...]
  info: Object, // { page, ... }
  next: Number // 0 or more (helper for paging)
}
```

Options:

```js
{
  direction: String, // 'asc' or 'desc'
  order: String, // 'id' or 'title'
  page: Number, // Default is 1
  perPage: Number // Default is 20 (>=5 and <=100)
}
```

## API (Key-Value pairs)

#### `db = kv.from(id)`

Returns a new `KV` instance, configured with the Namespace id.

#### `await db.put(key, value, [options])`

Write a key-value pair. Value will be stringified as JSON.

Options:

```js
{
  metadata: Object,
  expiration: Number,
  expiration_ttl: Number, // Minimum is 60 seconds
  base64: Boolean // Indicate if value is base64 (e.g. file that can't be JSON)
}
```

#### `value = await db.get(key)`

Read a key-value pair. Value will be parsed as JSON.

Returns `null` if not found.

#### `await db.del(key)`

Delete a key-value pair.

#### `list = await db.list([options])`

Lists the keys of the Namespace.

Returns:

```js
{
  result: Array, // [{ name, metadata, expiration }, ...]
  info: Object // { count, cursor }
}
```

Options:

```js
{
  cursor: String,
  limit: Number, // Default is 1000 (>= 10 and <= 1000)
  prefix: String
}
```

## API (Metadata)

#### `metadata = await db.metadata.get(key)`

Read the metadata associated with a key-value pair.

Returns `null` if not found or there is no metadata.

## License

MIT
