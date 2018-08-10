const clas = require('.');
const assert = require('assert');

const Number = clas(['value'], {
  add(that, v) {
    that.value += v;
  },
  sub(that, v) {
    that.value -= v;
  }
});

const num = Number(1);
assert.equal(num.value + 1, num.add(1).value);
assert.equal(num.value, 1);
