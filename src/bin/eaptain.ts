import * as yargs from 'yargs'

import {Eaptain} from '../index'

yargs.command('start', 'start the server', (yargs) => {
    return yargs.option('p', {
        alias: 'port',
        describe: 'Redis端口',
        default: 6379,
        type: 'number'
    }).option('h', {
        alias: 'host',
        describe: 'Redis主机',
        default: 'localhost',
        type: 'string'
    }).option('a', {
        alias: 'auth',
        describe: 'Redis授权',
        default: '',
        type: 'string'
    }).option('d', {
        alias: 'db',
        describe: 'Redis数据库',
        default: '0',
        type: 'string'
    })
}, (argv) => {
    const eaptain = new Eaptain({host: argv.host, port: argv.port, auth_pass: argv.auth, db: argv.db})
    eaptain.start();
}).help().argv;