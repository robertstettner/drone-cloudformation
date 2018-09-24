'use strict';
const R = require('ramda');
const hl = require('highland');
const path = require('path');
let cfn = require('cfn').class;
let fs = hl.streamifyAll(require('fs'));

let log = console.log; // eslint-disable-line no-console

let resolveAbsolutePath = p => path.resolve(process.cwd(), p);

let resolveTemplate = template => {
    if (!/https:\/\//.test(template)) {
        return hl.of(template)
            .map(resolveAbsolutePath)
            .flatMap(fs.statStream);
    } else {
        return hl.of(1);
    }
};

let convertConfig = config => R.pipe(
    R.keys,
    R.reduce((acc, val) => {
        acc[`PLUGIN_${R.toUpper(val)}`] = config[val];
        return acc;
    }, {})
)(config);

let checkIfBatch = function (env) {
    if (env.PLUGIN_BATCH) {
        return hl.of(env.PLUGIN_BATCH)
            .map(JSON.parse)
            .errors((err, push) => push(new Error('cannot parse batch configurations')))
            .sequence()
            .map(convertConfig);
    }
    return hl.of(env);
};

let resolveParams = function (env) {
    return hl.of(env.PLUGIN_PARAMS)
        .flatMap(params => {
            if (R.test(/\.json$/, params)) {
                return hl.of(params)
                    .map(resolveAbsolutePath)
                    .flatMap(fs.statStream)
                    .flatMap(() => fs.readFileStream(params, 'utf8'))
                    .errors((err, push) => push(new Error('params file could not be resolved')));
            }
            return hl.of(params);
        })
        .tap(params => {
            if (!R.isNil(params) && typeof params !== 'object' && params.constructor !== Object) {
                try {
                    JSON.parse(params);
                } catch (ignore) {
                    throw new Error('cannot parse params data');
                }
            }
        })
        .map(R.assoc('PLUGIN_PARAMS', R.__, env));
};

let convertSecretParams = function (env, secrets) {
    return R.reduce((acc, val) => {
        acc[val.target] = env[val.source];
        return acc;
    }, {}, secrets);
};

let resolveSecretParams = function (env) {
    const json = R.defaultTo('[]', env.PLUGIN_SECRET_PARAMS);
    // no need use try/catch as badly formed yaml gets rejected by Drone
    const secrets = JSON.parse(json);
    if(!Array.isArray(secrets)) {
        throw new Error('secret_params must be an array');
    }

    const missingEnvVars = R.reject(R.has(R.__, env), secrets.map(R.prop('source')));
    if(!R.isEmpty(missingEnvVars)) {
        throw new Error(`The following secrets are missing: ${missingEnvVars.join(', ')}. Ensure you have included the secrets key in this build step.`);
    }

    return R.assoc('PLUGIN_SECRET_PARAMS', convertSecretParams(env, secrets), env);
};

let validateConfig = function (env) {
    env.PLUGIN_MODE = env.PLUGIN_MODE || 'createOrUpdate';
    const aws_access_key = env.PLUGIN_ACCESS_KEY;
    const aws_secret_key = env.PLUGIN_SECRET_KEY;
    const yml_verified = R.has('DRONE_YAML_VERIFIED', env) ? env.DRONE_YAML_VERIFIED : true;

    if (R.isNil(aws_access_key) && !R.isNil(aws_secret_key)) {
        throw new Error('missing AWS access key');
    }

    if (!R.isNil(aws_access_key) && R.isNil(aws_secret_key)) {
        throw new Error('missing AWS secret key');
    }

    if (!yml_verified && (R.isNil(aws_access_key) && R.isNil(aws_secret_key))) {
        throw new Error('drone YAML is unverified when not using AWS IAM role');
    }

    if (!R.contains(env.PLUGIN_MODE, ['createOrUpdate','create','delete','validate'])) {
        throw new Error('mode is invalid');
    }

    if (!env.PLUGIN_STACKNAME && env.PLUGIN_MODE !== 'validate') {
        throw new Error('stackname not specified');
    }

    if (!env.PLUGIN_TEMPLATE && env.PLUGIN_MODE !== 'delete') {
        throw new Error('template not specified');
    }

    return env;
};

let validate = function (envs) {
    return hl.of(envs)
        .flatMap(envs => {
            return hl.of(validateConfig(envs))
                .flatMap(env =>{
                    if (env.PLUGIN_MODE !== 'delete') {
                        return hl.of(env.PLUGIN_TEMPLATE)
                            .flatMap(resolveTemplate)
                            .flatMap(() => hl.of(envs));
                    }
                    return hl.of(envs);
                })
                .flatMap(env => {
                    if (R.contains(env.PLUGIN_MODE, ['createOrUpdate','create'])) {

                        return resolveParams(env)
                            .map(resolveSecretParams);
                    }
                    return hl.of(envs);
                });
        });
};

let execute = function (env) {
    const config = {
        awsConfig: {
            region: env.PLUGIN_REGION || 'eu-west-1'
        }
    };

    if (env.PLUGIN_MODE !== 'validate') {
        config.name = env.PLUGIN_STACKNAME;
    }
    if (env.PLUGIN_MODE !== 'delete' && !/https:\/\//.test(env.PLUGIN_TEMPLATE)) {
        config.template = resolveAbsolutePath(env.PLUGIN_TEMPLATE);
    }
    if (R.contains(env.PLUGIN_MODE, ['createOrUpdate','create'])) {
        config.capabilities = ['CAPABILITY_NAMED_IAM', 'CAPABILITY_IAM'];
        const rawParams = R.defaultTo({}, env.PLUGIN_PARAMS);
        const params = typeof rawParams === 'object' && rawParams.constructor === Object ? rawParams : JSON.parse(rawParams);
        config.cfParams =  R.merge(params, env.PLUGIN_SECRET_PARAMS);
    }
    if (env.PLUGIN_ACCESS_KEY && env.PLUGIN_SECRET_KEY) {
        config.awsConfig.accessKeyId = env.PLUGIN_ACCESS_KEY;
        config.awsConfig.secretAccessKey = env.PLUGIN_SECRET_KEY;
    }
    return () => (new cfn(config))[env.PLUGIN_MODE]();
};

let keepAliveOutput = ms => setInterval(() => log(`[${new Date().toISOString().replace(/.*T(\d{2}:\d{2}:\d{2})\..*/, '$1')}] ...`), ms);

module.exports = {
    init: function () {
        let intervalId;
        return checkIfBatch(process.env)
            .flatMap(validate)
            .map(execute)
            .collect()
            .tap(() => intervalId = keepAliveOutput(1000 * 60))
            .flatMap(xss => process.env.PLUGIN_PARALLEL ? hl(xss).map(func => hl(func())).merge() : hl(xss).map(func => hl(func())).sequence())
            .collect()
            .toCallback(err => {
                clearInterval(intervalId);
                if (err) {
                    console.error(err); // eslint-disable-line no-console
                    return process.exit(1);
                }
                process.exit(0);
            });
    }
};
