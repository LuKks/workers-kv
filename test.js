const crypto = require('crypto')
const test = require('brittle')
const dotenv = require('dotenv')
const KV = require('./index.js')

dotenv.config()

test('create namespace', async function (t) {
  const kv = new KV(process.env.CF_ACCOUNT_ID, process.env.CF_TOKEN)

  const ns = await kv.namespace.create('test-' + Date.now())

  t.is(typeof ns.id, 'string')
  t.is(typeof ns.title, 'string')

  try {
    await kv.namespace.create(ns.title)
    t.fail()
  } catch (err) {
    t.is(err.code, 'NAMESPACE_ALREADY_EXISTS')
  }
})

test('get namespace', async function (t) {
  const kv = new KV(process.env.CF_ACCOUNT_ID, process.env.CF_TOKEN)
  const ns = await kv.namespace.create('test-' + Date.now())

  const ns2 = await kv.namespace.get(ns.id)

  t.is(typeof ns2.id, 'string')
  t.is(typeof ns2.title, 'string')

  try {
    await kv.namespace.get(crypto.randomBytes(16).toString('hex'))
    t.fail()
  } catch (err) {
    t.is(err.code, 'NAMESPACE_NOT_FOUND')
  }
})

test('list namespaces', async function (t) {
  const kv = new KV(process.env.CF_ACCOUNT_ID, process.env.CF_TOKEN)

  for (let i = 0; i < 3; i++) {
    await kv.namespace.create('test-' + Date.now())
  }

  const list = await kv.namespace.list()

  t.ok(list.result.length > 0)
  t.is(list.info.page, 1)
  t.is(typeof list.next, 'number')

  if (list.next) {
    const list2 = await kv.namespace.list({ page: list.next })

    t.ok(list2.result.length > 0)
    t.is(list2.info.page, list.next)
  } else {
    t.comment('No next list')
  }
})

test('remove namespace', async function (t) {
  const kv = new KV(process.env.CF_ACCOUNT_ID, process.env.CF_TOKEN)

  const ns = await kv.namespace.create('test-' + Date.now())

  await kv.namespace.remove(ns.id)

  try {
    await kv.namespace.remove(crypto.randomBytes(16).toString('hex'))
    t.fail()
  } catch (err) {
    t.is(err.code, 'NAMESPACE_NOT_FOUND')
  }
})

test('put, get, list, and delete (key-value pairs)', async function (t) {
  const kv = new KV(process.env.CF_ACCOUNT_ID, process.env.CF_TOKEN)
  const ns = await kv.namespace.create('test-' + Date.now())

  const db = kv.from(ns.id)

  await db.put('/users/1', 1337)

  t.is(await db.get('/users/1'), 1337)

  const list = await db.list()

  t.alike(list.result, [{ name: '/users/1' }])

  await db.del('/users/1')

  t.is(await db.get('/users/1'), null)

  await db.del('/users/does-not-exists')
})

test('metadata (key-value pairs)', async function (t) {
  const kv = new KV(process.env.CF_ACCOUNT_ID, process.env.CF_TOKEN)
  const ns = await kv.namespace.create('test-' + Date.now())

  const db = kv.from(ns.id)

  await db.put('/users/1', 1337, {
    metadata: {
      ip: '1.2.3.4'
    }
  })

  t.alike(await db.metadata.get('/users/1'), {
    ip: '1.2.3.4'
  })

  const list = await db.list()

  t.alike(list.result[0], {
    name: '/users/1',
    metadata: {
      ip: '1.2.3.4'
    }
  })
})

test('list (key-value pairs)', async function (t) {
  const kv = new KV(process.env.CF_ACCOUNT_ID, process.env.CF_TOKEN)
  const ns = await kv.namespace.create('test-' + Date.now())

  const db = kv.from(ns.id)

  const writes = []

  for (let i = 0; i < 15; i++) {
    writes.push(db.put('/texts/' + Date.now() + '-' + i, 'Hello World!'))
  }

  await Promise.all(writes)

  const out = await db.list({ limit: 10 })

  t.is(out.result.length, 10)
  t.is(out.info.count, 10)
  t.ok(out.info.cursor)

  const out2 = await db.list({ limit: 10, cursor: out.info.cursor })

  t.is(out2.result.length, 5)
  t.is(out2.info.count, 5)
  t.absent(out2.info.cursor)
})

test('list prefix (key-value pairs)', async function (t) {
  const kv = new KV(process.env.CF_ACCOUNT_ID, process.env.CF_TOKEN)
  const ns = await kv.namespace.create('test-' + Date.now())

  const db = kv.from(ns.id)

  await db.put('/users/1', { name: '' })
  await db.put('/users/2', { name: '' })
  await db.put('/texts/a', 'Hello World!')

  const out = await db.list({ prefix: '/users/' })

  t.is(out.result.length, 2)
  t.is(out.info.count, 2)
  t.absent(out.info.cursor)

  const out2 = await db.list({ prefix: '/texts/' })

  t.is(out2.result.length, 1)
  t.is(out2.info.count, 1)
  t.absent(out2.info.cursor)
})

test('cleanup', async function () {
  const kv = new KV(process.env.CF_ACCOUNT_ID, process.env.CF_TOKEN)

  for (let i = 0; i < 2; i++) {
    const reqs = []

    for (let j = 0; j < 30; j++) {
      reqs.push(kv.namespace.create('test-' + Date.now() + '-' + j))
    }

    await Promise.all(reqs)
  }

  let page = null

  while (true) {
    const list = await kv.namespace.list({ page })

    const filtered = list.result.filter(ns => ns.title.startsWith('test-'))

    await Promise.all(filtered.map(ns => kv.namespace.remove(ns.id)))

    if (!list.next) {
      break
    }

    if (filtered.length === 0) {
      page = list.next
    }
  }
})
