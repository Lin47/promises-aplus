const isFunction = obj => typeof obj === 'function'
const isObject = obj => !!(obj && typeof obj === 'object')
const isThenable = obj => (isFunction(obj) || isObject(obj)) && 'then' in obj
const isPromise = promise => promise instanceof Promise

const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

function Promise(f) {
  this.state = PENDING
  this.result = null
  this.callbacks = []

  const onFulfilled = value => transition(this, FULFILLED, value)
  const onRejected = reason => transition(this, REJECTED, reason)

  let ignore = false

  const resolve = value => {
    if (ignore) {
      return
    }
    ignore = true
    resolvePromise(this, value, onFulfilled, onRejected)
  }

  const reject = reason => {
    if (ignore) {
      return
    }
    ignore = true
    onRejected(reason)
  }

  try {
    f(resolve, reject)
  } catch (error) {
    reject(error)
  }
}

Promise.prototype.then = function (onFulfilled, onRejected) {
  return new Promise((resolve, reject) => {
    const callback = { onFulfilled, onRejected, resolve, reject }

    if (this.state === PENDING) {
      this.callbacks.push(callback)
    } else {
      setTimeout(() => handleCallback(callback, this.state, this.result), 0)
    }
  })
}

const handleCallback = (callback, state, result) => {
  const { onFulfilled, onRejected, resolve, reject } = callback
  try {
    if (state === FULFILLED) {
      isFunction(onFulfilled) ? resolve(onFulfilled(result)) : resolve(result)
    } else if (state === REJECTED) {
      isFunction(onRejected) ? resolve(onRejected(result)) : reject(result)
    }
  } catch (error) {
    reject(error)
  }
}

const handleCallbacks = (callbacks, state, result) => {
  while (callbacks.length) {
    handleCallback(callbacks.shift(), state, result)
  }
}

const transition = (promise, state, result) => {
  if (promise.state !== PENDING) {
    return
  }
  promise.state = state
  promise.result = result
  setTimeout(() => handleCallbacks(promise.callbacks, state, result), 0)
}

const resolvePromise = (promise, result, resolve, reject) => {
  if (result === promise) {
    const reason = new TypeError('Can not fulfill promise with itself')
    return reject(reason)
  }

  if (isPromise(result)) {
    return result.then(resolve, reject)
  }

  if (isThenable(result)) {
    try {
      const then = result.then
      if (isFunction(then)) {
        return new Promise(then.bind(result)).then(resolve, reject)
      }
    } catch (error) {
      reject(error)
    }
  }

  resolve(result)
}

Promise.deferred = () => {
  const dfd = {}
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve
    dfd.reject = reject
  })
  return dfd
}

Promise.resolve = result => {
  if (result instanceof Promise) {
    return result
  }
  return new Promise((resolve) => resolve(result))
}

Promise.reject = reason => {
  return new Promise((resolve, reject) => {
    reject(reason)
  })
}

Promise.all = promiseList => {
  const resPromise = new Promise((resolve, reject) => {
    let count = 0
    const result = []
    const length = promiseList.length

    if (length === 0) {
      return resolve(result)
    }

    promiseList.forEach((promise, index) => {
      Promise.resolve(promise).then(value => {
        count++
        result[index] = value
        if (count === length) {
          resolve(result)
        }
      }, reason => reject(reason))
    })
  })

  return resPromise
}

Promise.race = promiseList => {
  const resPromise = new Promise((resolve, reject) => {
    const length = promiseList.length

    if (length === 0) {
      return resolve(result)
    } else {
      promiseList.forEach(promise => {
        Promise.resolve(promise).then(value => resolve(value), reason => reject(reason))
      })
    }
  })

  return resPromise
}

Promise.prototype.catch = function (onRejected) {
  this.then(null, onRejected)
}

Promise.prototype.finally = function (fn) {
  return this.then(value => Promise.resolve(fn()).then(() => value),
    reason => Promise.resolve(fn()).then(() => {
      throw reason
    }))
}

Promise.allSettled = promiseList => {
  return new Promise(resolve => {
    let count = 0
    const result = []
    const length = promiseList.length

    if (length === 0) {
      return resolve(result)
    } else {
      promiseList.forEach((promise, index) => {
        Promise.resolve(promise).then(value => {
          count++
          result[index] = {
            value,
            status: 'fulfilled',
          }
          if (count === length) {
            return resolve(result)
          }
        }, reason => {
          count++
          result[index] = {
            reason,
            status: 'rejected',
          }
          if (count === length) {
            return resolve(result)
          }
        })
      })
    }
  })
}

module.exports = Promise
