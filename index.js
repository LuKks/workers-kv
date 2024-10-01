const fetch = require('like-fetch')

const API_URL = 'https://api.cloudflare.com/client/v4'

module.exports = class KV {
  constructor (accountId, token, namespaceId) {
    this.accountId = accountId
    this.token = token
    this.namespaceId = namespaceId || null

    this.namespace = new Namespace(this)
    this.metadata = new Metadata(this)
  }

  from (namespaceId) {
    return new KV(this.accountId, this.token, namespaceId)
  }

  async put (key, value, opts = {}) {
    const out = await this.api('/' + this.namespaceId + '/bulk', {
      method: 'PUT',
      body: [
        {
          key,
          value: JSON.stringify(value),
          metadata: opts.metadata,
          expiration: opts.expiration,
          expiration_ttl: opts.expiration_ttl,
          base64: opts.base64
        }
      ]
    })

    return out
  }

  async get (key) {
    try {
      const value = await this.api('/' + this.namespaceId + '/values/' + encodeURIComponent(key), {
        type: 'text'
      })

      return JSON.parse(value)
    } catch (err) {
      if (err.code === 'KEY_NOT_FOUND') {
        return null
      }

      throw err
    }
  }

  async del (key) {
    return this.api('/' + this.namespaceId + '/bulk/delete', {
      method: 'POST',
      body: [key]
    })
  }

  async list (opts = {}) {
    const query = encodeQueryString({
      cursor: opts.cursor,
      limit: opts.limit,
      prefix: opts.prefix
    })

    const out = await this.api('/' + this.namespaceId + '/keys' + (query ? ('?' + query) : ''), { raw: true })

    return {
      result: out.result,
      info: out.result_info
    }
  }

  async api (pathname, opts = {}) {
    const url = API_URL + '/accounts/' + this.accountId + '/storage/kv/namespaces'

    const response = await fetch(url + pathname, {
      method: opts.method || 'GET',
      headers: {
        authorization: 'Bearer ' + this.token,
        'content-type': 'application/json'
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    })

    if (opts.type === 'text' && response.status === 200) {
      return await response.text()
    }

    const out = await response.json()

    if (!out.success) {
      const err = out.errors?.length ? out.errors[0] : null

      if (err) {
        if (err.code === 10009) throw KVError.KEY_NOT_FOUND(err.message)
        if (err.code === 10013) throw KVError.NAMESPACE_NOT_FOUND(err.message)
        if (err.code === 10014) throw KVError.NAMESPACE_ALREADY_EXISTS(err.message)

        throw new Error(err.code + ': ' + err.message)
      }

      throw new Error('Unknown response: ' + JSON.stringify(out))
    }

    if (opts.raw) {
      return out
    }

    return out.result
  }
}

class Namespace {
  constructor (kv) {
    this.kv = kv
  }

  async create (title) {
    return this.kv.api('', {
      method: 'POST',
      body: { title }
    })
  }

  async get (namespaceId) {
    return this.kv.api('/' + namespaceId)
  }

  async remove (namespaceId) {
    return this.kv.api('/' + namespaceId, {
      method: 'DELETE'
    })
  }

  async list (opts = {}) {
    const query = encodeQueryString({
      direction: opts.direction,
      order: opts.order,
      page: opts.page,
      per_page: opts.perPage
    })

    const out = await this.kv.api(query ? ('?' + query) : '', { raw: true })

    return {
      result: out.result,
      info: out.result_info,
      next: out.result_info.total_pages > out.result_info.page ? out.result_info.page + 1 : 0
    }
  }
}

class Metadata {
  constructor (kv) {
    this.kv = kv
  }

  async get (key) {
    try {
      return await this.kv.api('/' + this.kv.namespaceId + '/metadata/' + encodeURIComponent(key))
    } catch (err) {
      if (err.code === 'KEY_NOT_FOUND') {
        return null
      }

      throw err
    }
  }
}

class KVError extends Error {
  constructor (msg, code) {
    super(code + ': ' + msg)

    this.code = code
  }

  get name () {
    return 'KVError'
  }

  static NAMESPACE_ALREADY_EXISTS (msg) {
    return new KVError(msg, 'NAMESPACE_ALREADY_EXISTS')
  }

  static NAMESPACE_NOT_FOUND (msg) {
    return new KVError(msg, 'NAMESPACE_NOT_FOUND')
  }

  static KEY_NOT_FOUND (msg) {
    return new KVError(msg, 'KEY_NOT_FOUND')
  }
}

function encodeQueryString (obj) {
  return Object.keys(obj).map(onmap).filter(v => v).join('&')

  function onmap (key) {
    const value = obj[key]

    if (value === undefined || value === null) {
      return null
    }

    return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key])
  }
}
