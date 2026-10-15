const fs = require('fs');
const path = require('path');
const Mocha = require('mocha');

exports.run = () => new Promise((resolve, reject) => {
  const mocha = new Mocha({ ui: 'bdd', timeout: 60000, color: true });
  fs.readdirSync(__dirname)
    .filter(file => file.endsWith('.host_test.js'))
    .forEach(file => mocha.addFile(path.join(__dirname, file)));
  mocha.run(failures => (failures ? reject(new Error(`${failures} tests failed`)) : resolve()));
});
