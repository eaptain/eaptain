import * as redis from 'redis'
import {EventEmitter} from 'events';
import * as debug from 'debug';

const info = debug('Eaptain [I]');
// const warn = debug('Eaptain [W]');
// const error = debug('Eaptain [E]');

export class Eaptain extends EventEmitter {

    private config: redis.ClientOpts;

    private center: redis.RedisClient;

    private consumer: redis.RedisClient;

    constructor(config: redis.ClientOpts = {}) {
        super();
        info(`config:${JSON.stringify(config)}`);
        this.config = config;
        this.on('set', (key) => {
            this.addService(key);
        });
        this.on('expired', (key) => {
            this.delService(key);
        });
    }

    async addService(key: string) {
        const service = this.checkKey(key);
        if (service) {
            info(`add service [${service.serviceName}] -> ${service.hostPort}`);
            return new Promise((resolve, reject) => {
                this.center.multi()
                    .sadd('SE.EAPTIAN', service.serviceName)
                    .sadd(`SE.EAPTIAN.${service.serviceName}`, service.hostPort)
                    .exec((err) => {
                        if (err) return reject(err);
                        return resolve();
                    })
            })
        }
        return Promise.resolve();
    }

    async delService(key: string) {
        const service = this.checkKey(key);
        if (service) {
            info(`del service [${service.serviceName}] -> ${service.hostPort}`);
            return new Promise((resolve, reject) => {
                this.center.multi()
                    .srem(`SE.EAPTIAN.${service.serviceName}`, service.hostPort)
                    .exec((err) => {
                        if (err) return reject(err);
                        return resolve();
                    })
            }).then(() => {
                return new Promise((resolve, rejcet) => {
                    this.center.scard(`SE.EAPTIAN.${service.serviceName}`, (err, count) => {
                        if (err) return rejcet(err);
                        return resolve(count);
                    });
                }).then((count) => {
                    if (!count) {
                        return new Promise((resolve, reject) => {
                            this.center.multi()
                                .srem(`SE.EAPTIAN`, service.serviceName)
                                .exec((err) => {
                                    if (err) return reject(err);
                                    return resolve(count);
                                });
                        })
                    }
                    return Promise.resolve(count);
                });
            })
        }
    }

    checkKey(key: string) {
        const keys = key.split('@');
        const service = keys[0],
            serviceName = keys[1],
            hostPort = keys[2];
        if ('service' === service) {
            return {
                serviceName,
                hostPort
            }
        }
        return null;
    }

    async connectCenter() {
        this.center = redis.createClient(this.config);
    }

    async initCenter() {
        return new Promise((resolve, reject) => {
            this.center.config('SET', 'notify-keyspace-events', 'E$x', (err) => {
                if (err) return reject(err);
                return resolve();
            })
        });
    }

    async connectConsumer() {
        this.consumer = redis.createClient(this.config);
        this.consumer.on('pmessage', (pattern: string, channel: string, message: string) => {
            const {cmd, message: msg} = this.command(pattern, channel, message);
            this.emit(cmd, msg);
        });
        this.consumer.psubscribe(`__keyevent@${(this.config.db || 0)}__:*`);
    }

    command(pattern: string, channel: string, message: string) {
        const cmd = channel.replace(new RegExp(pattern), '');
        info('command', cmd, message);
        return {
            cmd,
            message
        }
    }

    async start() {
        await this.connectCenter();
        await this.initCenter();
        await this.connectConsumer();
    }
}