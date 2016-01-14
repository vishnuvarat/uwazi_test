require('babel-core/register')(); //babel polyfill ES6
var Jasmine = require('jasmine');
var jasmine = new Jasmine();
var reporters = require('jasmine-reporters');

var db_config = require('./app/api/config/database.js');
db_config.db_url = db_config.development;

jasmine.loadConfig({
    spec_dir: 'app/',
    spec_files: [
        'api/**/*[sS]pec.js',
        'shared/**/*[sS]pec.js'
    ]
});

jasmine.addReporter(new reporters.TerminalReporter({
  verbosity: 2,
  color: true,
  showStack: true
}));

jasmine.execute();
