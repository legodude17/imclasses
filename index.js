const immutable = require('immutable');

function makeIniter(init) {
  if (Array.isArray(init)) {
    return function make(args) {
      const obj = {};
      args.forEach((v, i) => { obj[init[i]] = v; });
      return obj;
    };
  } else if (typeof init === 'function') {
    return function make(args, obj) {
      return init(obj, ...args);
    };
  } else if (typeof init === 'object') {
    const wrap = obj => {
      const initTo = {};
      Object.keys(obj).map(i => [i, init[i]]).forEach(([i, v]) => {
        if (typeof v === 'function') {
          initTo[i] = v;
        } else if (Array.isArray(v) && v.every(v => typeof v === 'string')) {
          initTo[i] = (...args) => {
            const obj = {};
            args.forEach((val, i) => { obj[v[i]] = val; });
          };
        } else if (typeof v === 'object') {
          initTo[i] = wrap(v);
        } else {
          initTo[i] = () => v;
        }
      });
      return initTo;
    };
    const initTo = wrap(init);
    return function make(args) {
      if (typeof args[0] !== 'object') {
        throw new Error('TODO');
      }
      const o = args[0];
      const go = (o, initTo) => {
        const final = {};
        Object.keys(o).map(i => [i, o[i]]).forEach(([i, v]) => {
          if (typeof v === 'object') {
            final[i] = go(v, initTo[i]);
          } else {
            final[i] = initTo && initTo[i] ? initTo[i](v) : v;
          }
        });
        return final;
      };
      return Object.assign({}, go(o, initTo));
    };
  }
  throw new Error('TODO');
}

function wrapClass(clas) {
  return new Proxy(clas, {
    get(o, key) {
      if (key === Symbol.iterator) return o._state.entries();
      if (key === 'get') return o._state.get;
      if (!key.startsWith('_') && Object.prototype.hasOwnProperty.call(o, key)) return o[key];
      return immutable.fromJS(o._state.get(key));
    },
    hasOwnProperty(o, key) {
      return o._state.has(key);
    },
    set() {
      throw new Error('Cannot set value on immutable class!');
    },
    ownKeys(o) {
      return [...o._state.keys()];
    }
  });
}

function wrapMut(mut) {
  return new Proxy(mut, {
    set(o, key, value) {
      return o.set(key, value);
    },
    get(o, key) {
      return o.get(key);
    },
    ownKeys(o) {
      return [...o.keys()];
    }
  });
}

function wrapMethod(func, that) {
  return function method(...args) {
    const tht = that._state;
    const wrap = that._wrap;
    let res;
    const newtht = tht.withMutations(obj => { res = func(wrapMut(obj), ...args); });
    if (res != null) return res;
    const newObj = {};
    wrap(newObj);
    newObj._state = newtht;
    newObj._wrap = wrap;
    return wrapClass(newObj);
  };
}


module.exports = function create(init, cls) {
  const initer = makeIniter(init);
  return function make(...args) {
    const clas = {};
    const wrap = clas => Object.keys(cls).forEach(i => Object.defineProperty(clas, i, {
      value: wrapMethod(cls[i], clas),
      enumerable: false,
      writable: false
    }));
    wrap(clas);
    clas._state = immutable.fromJS(initer(args));
    clas._wrap = wrap;
    return wrapClass(clas);
  };
};
