'use strict';

const hl = require('highland');
const should = require('should');
const sinon = require('sinon');
require('should-sinon');
const sandbox = sinon.sandbox.create();
const clock = sandbox.useFakeTimers();

const rewire = require('rewire');

const plugin = rewire('../plugin');

describe('Unit tests: Drone CloudFormation', () => {
    afterEach(() => {
        sandbox.reset();
    });
    describe('resolveAbsolutePath()', () => {
        const resolveAbsolutePath = plugin.__get__('resolveAbsolutePath');
        it('should return absolute path', () => {
            const processMock = {
                cwd: sandbox.stub().returns('/my')
            };
            const revert = plugin.__set__('process', processMock);
            resolveAbsolutePath('path/to/template.yml').should.equal('/my/path/to/template.yml');
            processMock.cwd.should.be.calledOnce();
            revert();
        });
    });
    describe('convertConfig()', () => {
        const convertConfig = plugin.__get__('convertConfig');
        it('should return a convert config', () => {
            convertConfig({
                mode: 'createOrUpdate',
                stackname: 'myStack',
                template: 'templates/app.yml'
            }).should.eql({
                PLUGIN_MODE: 'createOrUpdate',
                PLUGIN_STACKNAME: 'myStack',
                PLUGIN_TEMPLATE: 'templates/app.yml'
            });
        });
    });
    describe('checkIfBatch()', () => {
        const checkIfBatch = plugin.__get__('checkIfBatch');
        let revert, convertConfigStub;

        beforeEach(() => {
            convertConfigStub = sandbox.stub().returns(999);
            revert = plugin.__set__('convertConfig', convertConfigStub);
        });

        afterEach(() => {
            revert();
        });

        it('should throw error when passing in invalid batch parameter', () => {
            return checkIfBatch({
                PLUGIN_BATCH: [1,2,3]
            }).collect().stopOnError(err => {
                err.should.be.an.Error();
                err.message.should.equal('cannot parse batch configurations');
                convertConfigStub.should.have.callCount(0);
            }).tap(() => {
                throw new Error('does not throw error');
            });
        });
        it('should return highland stream mapped over convertConfig when using batch configurations', () => {
            return checkIfBatch({
                PLUGIN_BATCH: '[1,2,3,4]'
            }).collect().tap(res => {
                res.should.be.an.Array();
                res.should.be.lengthOf(4);
                res.should.eql([999,999,999,999]);
                convertConfigStub.should.have.callCount(4);
            });
        });
        it('should return highland stream when not using batch configurations', () => {
            return checkIfBatch({
                PLUGIN_MODE: 'createOrUpdate',
                PLUGIN_STACKNAME: 'myStack',
                PLUGIN_TEMPLATE: 'templates/app.yml'
            }).collect().tap(res => {
                res.should.be.an.Array();
                res.should.be.lengthOf(1);
                res[0].should.be.an.Object();
                res[0].should.eql({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'myStack',
                    PLUGIN_TEMPLATE: 'templates/app.yml'
                });
                convertConfigStub.should.not.be.called();
            });
        });
    });
    describe('resolveParams()', () => {
        const resolveParams = plugin.__get__('resolveParams');
        let readFileStub, statStub, revert;

        beforeEach(() => {
            readFileStub = sinon.stub();
            statStub = sinon.stub();
            readFileStub.withArgs('./path/to/my/file.json', 'utf8').returns(hl.of('{"baz":"qux"}'));
            readFileStub.withArgs('./file/is/broken.json', 'utf8').returns(hl.fromError(new Error('error')));
            readFileStub.withArgs('./path/is/invalid.json', 'utf8').returns(hl.of('{baz:"qux"}'));
            statStub.returns(hl.of('exists'));
            statStub.withArgs('./file/does/not/exist.json').returns(hl.fromError(new Error('error')));
            revert = plugin.__set__('fs', {readFileStream: readFileStub, statStream: statStub});
        });

        afterEach(() => {
            revert();
        });

        it('should ignore params if they are undefined', () =>
            resolveParams({}).tap(res => {
                should.not.exist(res.PLUGIN_PARAMS);
            })
        );

        it('should return a stringified JSON object when params are supplied as an object', () =>
            resolveParams({PLUGIN_PARAMS: '{"foo":"bar"}'}).tap(res => {
                res.PLUGIN_PARAMS.should.deepEqual('{"foo":"bar"}');
            })
        );

        it('should return a stringified JSON object when params are supplied as a JSON file', () =>
            resolveParams({PLUGIN_PARAMS: './path/to/my/file.json'}).tap(res => {
                res.PLUGIN_PARAMS.should.equal('{"baz":"qux"}');
            })
        );

        it('should push an error if file cannot be found', () =>
            resolveParams({PLUGIN_PARAMS: './file/does/not/exist.json'}).errors((err, push) => {
                push(null, err);
            }).tap(err => err.message.should.equal('params file could not be resolved'))
        );

        it('should push an error if file cannot be read', () =>
            resolveParams({PLUGIN_PARAMS: './file/is/broken.json'}).errors((err, push) => {
                push(null, err);
            }).tap(err => err.message.should.equal('params file could not be resolved'))
        );

        it('should push an error if file cannot be read', () =>
            resolveParams({PLUGIN_PARAMS: './file/is/broken.json'}).errors((err, push) => {
                push(null, err);
            }).tap(err => err.message.should.equal('params file could not be resolved'))
        );

        it('should push an error if file has invalid json', () =>
            resolveParams({PLUGIN_PARAMS: './path/is/invalid.json'}).errors((err, push) => {
                push(null, err);
            }).tap(err => err.message.should.equal('cannot parse params data'))
        );

        it('should push an error if params is not correct JSON', () =>
            resolveParams({PLUGIN_PARAMS: '{not correct'}).errors((err, push) => {
                push(null, err);
            }).tap(err => err.message.should.equal('cannot parse params data'))
        );

    });
    describe('resolveSecretParams()', () => {
        const resolveSecretParams = plugin.__get__('resolveSecretParams');

        it('should return an empty object if secret params are undefined', () =>
            resolveSecretParams({}).PLUGIN_SECRET_PARAMS.should.deepEqual({})
        );

        it('should return an object when secrets are supplied', () =>
            resolveSecretParams({
                FOO: 'envvar',
                PLUGIN_SECRET_PARAMS: '[{"source": "FOO", "target": "bar"}]'
            }).PLUGIN_SECRET_PARAMS.should.deepEqual({bar: 'envvar'})
        );

        it('should throw an exception if not passed an array', () =>
            resolveSecretParams.bind(null, {
                PLUGIN_SECRET_PARAMS: '{"source": "FOO", "target": "bar"}'
            }).should.throw('secret_params must be an array')
        );

        it('should throw an exception if environment variables are missing', () =>
            resolveSecretParams.bind(null, {
                PLUGIN_SECRET_PARAMS: '[{"source": "FOO", "target": "bar"}, {"source": "BAZ", "target": "baz"}]'
            }).should.throw(`The following secrets are missing: FOO, BAZ. Ensure you have included the secrets key in this build step.`)
        );


    });
    describe('convertSecretParams', () => {
        const convertSecretParams = plugin.__get__('convertSecretParams');
        it('should convert list of source/target pairs to an object', () => {
            const env = {DB_PASSWORD: 'password', DB_USER: 'user'};
            convertSecretParams(env, [{source: 'DB_PASSWORD', target: 'DbPassword'}]).should.deepEqual({DbPassword: 'password'});
            convertSecretParams(env, [{source: 'DB_USER', target: 'DbUser'}, {source: 'DB_PASSWORD', target: 'DbPassword'}]).should.deepEqual({DbUser: 'user', DbPassword: 'password'});
        });
    });
    describe('validateConfig()', () => {
        const validateConfig = plugin.__get__('validateConfig');
        it('should throw error when missing AWS secret key', () => {
            validateConfig.bind(null, {
                PLUGIN_ACCESS_KEY: '123'
            }).should.throw('missing AWS secret key');
        });
        it('should throw error when missing AWS access key', () => {
            validateConfig.bind(null, {
                PLUGIN_SECRET_KEY: '123'
            }).should.throw('missing AWS access key');
        });
        it('should throw error when drone YAML is unverified and not using AWS IAM role', () => {
            validateConfig.bind(null, {
                DRONE_YAML_VERIFIED: false
            }).should.throw('drone YAML is unverified when not using AWS IAM role');
        });
        it('should throw error when mode is invalid', () => {
            validateConfig.bind(null, {
                PLUGIN_MODE: 'update'
            }).should.throw('mode is invalid');
        });
        it('should throw error when stackname is not specified', () => {
            validateConfig.bind(null, {}).should.throw('stackname not specified');
        });
        it('should throw error when template is not specified', () => {
            validateConfig.bind(null, {
                PLUGIN_STACKNAME: 'myStack'
            }).should.throw('template not specified');
        });

        it('should return env object with default params when all is valid', () => {
            validateConfig({
                PLUGIN_STACKNAME: 'myStack',
                PLUGIN_TEMPLATE: 'path/to/template.yml',
                PLUGIN_PARAMS: '{}'
            }).should.eql({
                PLUGIN_MODE: 'createOrUpdate',
                PLUGIN_STACKNAME: 'myStack',
                PLUGIN_TEMPLATE: 'path/to/template.yml',
                PLUGIN_PARAMS: '{}'
            });
        });

        it('should return env object with custom object params when all is valid', () => {
            validateConfig({
                PLUGIN_STACKNAME: 'myStack',
                PLUGIN_TEMPLATE: 'path/to/template.yml',
                PLUGIN_PARAMS: {"foo":"bar"}
            }).should.eql({
                PLUGIN_MODE: 'createOrUpdate',
                PLUGIN_STACKNAME: 'myStack',
                PLUGIN_TEMPLATE: 'path/to/template.yml',
                PLUGIN_PARAMS: {"foo":"bar"}
            });
        });
        it('should return env object with custom params when all is valid', () => {
            validateConfig({
                PLUGIN_STACKNAME: 'myStack',
                PLUGIN_TEMPLATE: 'path/to/template.yml',
                PLUGIN_PARAMS: '{"foo":"bar"}'
            }).should.eql({
                PLUGIN_MODE: 'createOrUpdate',
                PLUGIN_STACKNAME: 'myStack',
                PLUGIN_TEMPLATE: 'path/to/template.yml',
                PLUGIN_PARAMS: '{"foo":"bar"}'
            });
        });
    });
    describe('execute()', () => {
        let resolveAbsolutePathStub, cfnStub;
        const revert = [];
        const execute = plugin.__get__('execute');
        beforeEach(() => {
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.resolve(654));
            cfnStub.prototype.create = sandbox.stub().returns(Promise.resolve(456));
            cfnStub.prototype.validate = sandbox.stub().returns(Promise.resolve(789));
            cfnStub.prototype.delete = sandbox.stub().returns(Promise.resolve(321));
            resolveAbsolutePathStub = sandbox.stub().returns('/new-template.yml');
            revert.push(plugin.__set__('cfn', cfnStub));
            revert.push(plugin.__set__('resolveAbsolutePath', resolveAbsolutePathStub));
        });
        afterEach(() => {
            revert.forEach(func => func());
        });
        describe('for createOrUpdate mode', () => {
            it('should return a promise returning function', () => {
                execute({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'myStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.be.calledOnce();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {},
                    awsConfig: {
                        region: 'eu-west-1'
                    }
                });
            });
            it('should return promise returning function with custom params', () => {
                execute({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'myStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.be.calledOnce();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {
                        foo: 'bar'
                    },
                    awsConfig: {
                        region: 'eu-west-1'
                    }
                });
            });
            it('should return promise returning function with secret params', () => {
                execute({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'myStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_SECRET_PARAMS: {bar: 'envvar'}
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.be.calledOnce();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {
                        bar: 'envvar'
                    },
                    awsConfig: {
                        region: 'eu-west-1'
                    }
                });
            });
            it('should return promise returning function with secret params and regular params', () => {
                execute({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'myStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_SECRET_PARAMS: {bar: 'envvar'}
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.be.calledOnce();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {
                        foo: 'bar',
                        bar: 'envvar'
                    },
                    awsConfig: {
                        region: 'eu-west-1'
                    }
                });
            });
            it('should return promise returning function with custom params and stackname', () => {
                execute({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.be.calledOnce();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myCoolStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {
                        foo: 'bar'
                    },
                    awsConfig: {
                        region: 'eu-west-1'
                    }
                });
            });
            it('should return promise returning function with custom params, stackname and AWS credentials', () => {
                execute({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.be.calledOnce();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myCoolStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {
                        foo: 'bar'
                    },
                    awsConfig: {
                        region: 'eu-west-1',
                        accessKeyId: '1234',
                        secretAccessKey: 'abcd'
                    }
                });
            });
            it('should return promise returning function with custom object params, stackname and AWS credentials', () => {
                execute({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: {"foo":"bar"},
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.be.calledOnce();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myCoolStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {
                        foo: 'bar'
                    },
                    awsConfig: {
                        region: 'eu-west-1',
                        accessKeyId: '1234',
                        secretAccessKey: 'abcd'
                    }
                });
            });
        });
        describe('for create mode', () => {
            it('should return promise returning function', () => {
                execute({
                    PLUGIN_MODE: 'create',
                    PLUGIN_STACKNAME: 'myStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{}'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.not.be.called();
                cfnStub.prototype.create.should.be.calledOnce();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {},
                    awsConfig: {
                        region: 'eu-west-1'
                    }
                });
            });
            it('should return promise returning function with custom params', () => {
                execute({
                    PLUGIN_MODE: 'create',
                    PLUGIN_STACKNAME: 'myStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.not.be.called();
                cfnStub.prototype.create.should.be.calledOnce();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {
                        foo: 'bar'
                    },
                    awsConfig: {
                        region: 'eu-west-1'
                    }
                });
            });
            it('should return promise returning function with custom params and stackname', () => {
                execute({
                    PLUGIN_MODE: 'create',
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.not.be.called();
                cfnStub.prototype.create.should.be.calledOnce();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myCoolStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {
                        foo: 'bar'
                    },
                    awsConfig: {
                        region: 'eu-west-1'
                    }
                });
            });
            it('should return promise returning function with custom params, stackname and AWS credentials', () => {
                execute({
                    PLUGIN_MODE: 'create',
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.not.be.called();
                cfnStub.prototype.create.should.be.calledOnce();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myCoolStack',
                    template: '/new-template.yml',
                    capabilities: [
                        "CAPABILITY_NAMED_IAM",
                        "CAPABILITY_IAM"
                    ],
                    cfParams: {
                        foo: 'bar'
                    },
                    awsConfig: {
                        region: 'eu-west-1',
                        accessKeyId: '1234',
                        secretAccessKey: 'abcd'
                    }
                });
            });
        });
        describe('for delete mode', () => {
            it('should return promise returning function', () => {
                execute({
                    PLUGIN_MODE: 'delete',
                    PLUGIN_STACKNAME: 'myStack'
                })();
                resolveAbsolutePathStub.should.not.be.called();
                cfnStub.prototype.createOrUpdate.should.not.be.called();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.be.calledOnce();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myStack',
                    awsConfig: {
                        region: 'eu-west-1'
                    }
                });
            });

            it('should return promise returning function with AWS credentials', () => {
                execute({
                    PLUGIN_MODE: 'delete',
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                })();
                resolveAbsolutePathStub.should.not.be.called();
                cfnStub.prototype.createOrUpdate.should.not.be.called();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.not.be.called();
                cfnStub.prototype.delete.should.be.calledOnce();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    name: 'myCoolStack',
                    awsConfig: {
                        region: 'eu-west-1',
                        accessKeyId: '1234',
                        secretAccessKey: 'abcd'
                    }
                });
            });
        });
        describe('for validate mode', () => {
            it('should return promise returning function', () => {
                execute({
                    PLUGIN_MODE: 'validate',
                    PLUGIN_TEMPLATE: 'path/to/template.yml'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.not.be.called();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.be.calledOnce();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    template: '/new-template.yml',
                    awsConfig: {
                        region: 'eu-west-1'
                    }
                });
            });
            it('should return promise returning function with AWS credentials', () => {
                execute({
                    PLUGIN_MODE: 'validate',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                })();
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                cfnStub.prototype.createOrUpdate.should.not.be.called();
                cfnStub.prototype.create.should.not.be.called();
                cfnStub.prototype.validate.should.be.calledOnce();
                cfnStub.prototype.delete.should.not.be.called();
                cfnStub.should.be.calledOnce();
                cfnStub.should.be.calledWith({
                    template: '/new-template.yml',
                    awsConfig: {
                        region: 'eu-west-1',
                        accessKeyId: '1234',
                        secretAccessKey: 'abcd'
                    }
                });
            });
        });


    });
    describe('resolveTemplate()', () => {
        let resolveAbsolutePathStub, fsMock;
        const revert = [];
        const resolveTemplate = plugin.__get__('resolveTemplate');
        beforeEach(() => {
            resolveAbsolutePathStub = sandbox.stub().returns('/new-template.yml');
            fsMock = {
                statStream: sandbox.stub().returns(hl.of(1))
            };
            revert.push(plugin.__set__('resolveAbsolutePath', resolveAbsolutePathStub));
            revert.push(plugin.__set__('fs', fsMock));
        });
        afterEach(() => {
            revert.forEach(func => func());
        });
        it('should return template for non-local template', () => {
            return resolveTemplate('https://s3.amazonaws.com/mybucket/template.yml').tap(data => {
                data.should.eql(1);
                resolveAbsolutePathStub.should.not.be.calledOnce();
                fsMock.statStream.should.not.be.called();
            });
        });

        it('should return template for local template', () => {
            return resolveTemplate('path/to/template.yml').tap(data => {
                data.should.eql(1);
                resolveAbsolutePathStub.should.be.calledOnce();
                resolveAbsolutePathStub.should.be.calledWith('path/to/template.yml');
                fsMock.statStream.should.be.called();
                fsMock.statStream.should.be.calledWith('/new-template.yml');
            });
        });
    });
    describe('validate()', () => {
        let validateConfigStub, resolveTemplateStub, resolveParamsStub;
        const revert = [];
        const validate = plugin.__get__('validate');
        beforeEach(() => {
            validateConfigStub = sandbox.stub().returns({
                PLUGIN_STACKNAME: 'NOTCool',
                PLUGIN_TEMPLATE: 'omg.yml',
                PLUGIN_PARAMS: '{"hoo":"haa"}',
                PLUGIN_ACCESS_KEY: '4321',
                PLUGIN_SECRET_KEY: 'dcba'
            });
            resolveParamsStub = sandbox.stub().returns(hl.of({
                PLUGIN_STACKNAME: 'NOTCool',
                PLUGIN_TEMPLATE: 'omg.yml',
                PLUGIN_PARAMS: '{"hoo":"haa"}',
                PLUGIN_ACCESS_KEY: '4321',
                PLUGIN_SECRET_KEY: 'dcba'
            }));
            resolveTemplateStub = sandbox.stub().returns(hl.of(1));
            revert.push(plugin.__set__('validateConfig', validateConfigStub));
            revert.push(plugin.__set__('resolveTemplate', resolveTemplateStub));
            revert.push(plugin.__set__('resolveParams', resolveParamsStub));
        });
        afterEach(() => {
            revert.forEach(func => func());
        });
        it('should return env object for non-delete modes', () => {
            return validate({
                PLUGIN_STACKNAME: 'myCoolStack',
                PLUGIN_TEMPLATE: 'path/to/template.yml',
                PLUGIN_PARAMS: '{"foo":"bar"}',
                PLUGIN_ACCESS_KEY: '1234',
                PLUGIN_SECRET_KEY: 'abcd'
            }).tap(data => {
                data.should.eql({
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                });
                validateConfigStub.should.be.calledOnce();
                validateConfigStub.should.be.calledWith({
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                });
                resolveTemplateStub.should.be.calledOnce();
                resolveTemplateStub.should.be.calledWith('omg.yml');
            });
        });
        it('should return env object for non-delete modes for non-local path', () => {

            return validate({
                PLUGIN_STACKNAME: 'myCoolStack',
                PLUGIN_TEMPLATE: 'https://s3.amazonaws.com/mybucket/template.yml',
                PLUGIN_PARAMS: '{"foo":"bar"}',
                PLUGIN_ACCESS_KEY: '1234',
                PLUGIN_SECRET_KEY: 'abcd'
            }).tap(data => {
                data.should.eql({
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'https://s3.amazonaws.com/mybucket/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                });
                validateConfigStub.should.be.calledOnce();
                validateConfigStub.should.be.calledWith({
                    PLUGIN_ACCESS_KEY: "1234",
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_SECRET_KEY: "abcd",
                    PLUGIN_STACKNAME: "myCoolStack",
                    PLUGIN_TEMPLATE: "https://s3.amazonaws.com/mybucket/template.yml"
                });
                resolveTemplateStub.should.be.called();
                resolveTemplateStub.should.be.calledWith('omg.yml');
            });
        });

        it('should return env object for delete mode', () => {
            validateConfigStub = sandbox.stub().returns({
                PLUGIN_MODE: 'delete',
                PLUGIN_STACKNAME: 'NOTCool',
                PLUGIN_ACCESS_KEY: '4321',
                PLUGIN_SECRET_KEY: 'dcba'
            });
            revert.push(plugin.__set__('validateConfig', validateConfigStub));

            return validate({
                PLUGIN_MODE: 'delete',
                PLUGIN_STACKNAME: 'myCoolStack',
                PLUGIN_ACCESS_KEY: '1234',
                PLUGIN_SECRET_KEY: 'abcd'
            }).tap(data => {
                data.should.eql({
                    PLUGIN_MODE: 'delete',
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                });
                validateConfigStub.should.be.calledOnce();
                validateConfigStub.should.be.calledWith({
                    PLUGIN_MODE: 'delete',
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                });
                resolveTemplateStub.should.not.be.called();
                resolveParamsStub.should.not.be.called();
            });
        });

        it('should return env object for createOrUpdate mode', () => {
            validateConfigStub = sandbox.stub().returns({
                PLUGIN_TEMPLATE: 'omg.yml',
                PLUGIN_MODE: 'createOrUpdate',
                PLUGIN_STACKNAME: 'NOTCool',
                PLUGIN_ACCESS_KEY: '4321',
                PLUGIN_SECRET_KEY: 'dcba'
            });
            revert.push(plugin.__set__('validateConfig', validateConfigStub));

            return validate({
                PLUGIN_MODE: 'createOrUpdate',
                PLUGIN_STACKNAME: 'myCoolStack',
                PLUGIN_ACCESS_KEY: '1234',
                PLUGIN_SECRET_KEY: 'abcd'
            }).tap(data => {
                data.should.eql({
                    PLUGIN_STACKNAME: 'NOTCool',
                    PLUGIN_TEMPLATE: 'omg.yml',
                    PLUGIN_PARAMS: '{"hoo":"haa"}',
                    PLUGIN_SECRET_PARAMS: {},
                    PLUGIN_ACCESS_KEY: '4321',
                    PLUGIN_SECRET_KEY: 'dcba'
                });
                validateConfigStub.should.be.calledOnce();
                validateConfigStub.should.be.calledWith({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                });
                resolveTemplateStub.should.be.calledOnce();
                resolveTemplateStub.should.be.calledWith('omg.yml');
                resolveParamsStub.should.be.calledOnce();
                resolveParamsStub.should.be.calledWith({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                });
            });
        });
    });
    describe('keepAliveOutput()', () => {
        const revert = [];
        const keepAliveOutput = plugin.__get__('keepAliveOutput');

        let logStub;
        beforeEach(() => {
            logStub = sandbox.stub();
            logStub.onCall(0).returns(0);
            logStub.onCall(1).returns(1);
            logStub.onCall(2).returns(2);
            revert.push(plugin.__set__('log', logStub));
        });
        afterEach(() => {
            revert.forEach(func => func());
        });
        it('should invoke log at every interval cycle', () => {
            const intervalId = keepAliveOutput(1000);

            clock.tick(1001);
            logStub.should.have.callCount(1);
            logStub.getCall(0).returnValue.should.equal(0);
            logStub.getCall(0).should.be.calledWith('[00:00:01] ...');

            clock.tick(1001);
            logStub.should.have.callCount(2);
            logStub.getCall(1).returnValue.should.equal(1);
            logStub.getCall(1).should.be.calledWith('[00:00:02] ...');

            clock.tick(1001);
            logStub.should.have.callCount(3);
            logStub.getCall(2).returnValue.should.equal(2);
            logStub.getCall(2).should.be.calledWith('[00:00:03] ...');

            clearInterval(intervalId);
            clock.tick(1001);
            logStub.should.have.callCount(3);
        });
    });
    describe('init()', () => {
        let processMock, validateStub, executeStub, checkIfBatchStub;
        const revert = [];
        beforeEach(() => {
            processMock = {
                env: {
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                },
                exit: sandbox.stub()
            };
            checkIfBatchStub = sandbox.stub().returns(hl.of(123));
            validateStub = sandbox.stub().returns(hl.of({
                PLUGIN_MODE: 'createOrUpdate',
                PLUGIN_STACKNAME: 'NOTCool',
                PLUGIN_TEMPLATE: 'omg.yml',
                PLUGIN_PARAMS: '{"hoo":"haa"}',
                PLUGIN_ACCESS_KEY: '4321',
                PLUGIN_SECRET_KEY: 'dcba'
            }));
            executeStub = sandbox.stub().returns(() => hl.of(123));
            revert.push(plugin.__set__('process', processMock));
            revert.push(plugin.__set__('validate', validateStub));
            revert.push(plugin.__set__('execute', executeStub));
            revert.push(plugin.__set__('checkIfBatch', checkIfBatchStub));
        });
        afterEach(() => {
            revert.forEach(func => func());
        });
        describe('sequentially', () => {
            it('should invoke process.exit with 0', () => {
                plugin.init();

                checkIfBatchStub.should.be.calledOnce();
                checkIfBatchStub.should.be.calledWith({
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                });
                validateStub.should.be.calledOnce();
                validateStub.should.be.calledWith(123);
                executeStub.should.be.calledOnce();
                executeStub.should.be.calledWith({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'NOTCool',
                    PLUGIN_TEMPLATE: 'omg.yml',
                    PLUGIN_PARAMS: '{"hoo":"haa"}',
                    PLUGIN_ACCESS_KEY: '4321',
                    PLUGIN_SECRET_KEY: 'dcba'
                });
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(0);
            });
            it('should invoke process.exit with 1', () => {
                validateStub = sandbox.stub().returns(hl.of(1).map(() => {
                    throw new Error('craps out');
                }));
                revert.push(plugin.__set__('validate', validateStub));

                plugin.init();

                checkIfBatchStub.should.be.calledOnce();
                checkIfBatchStub.should.be.calledWith({
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd'
                });
                validateStub.should.be.calledOnce();
                validateStub.should.be.calledWith(123);
                executeStub.should.have.callCount(0);
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(1);
            });
        });
        describe('in parallel', () => {
            beforeEach(() => {
                processMock.env.PLUGIN_PARALLEL = true;
                revert.push(plugin.__set__('process', processMock));
            });
            it('should invoke process.exit with 0', () => {
                plugin.init();

                checkIfBatchStub.should.be.calledOnce();
                checkIfBatchStub.should.be.calledWith({
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd',
                    PLUGIN_PARALLEL: true
                });
                validateStub.should.be.calledOnce();
                validateStub.should.be.calledWith(123);
                executeStub.should.be.calledOnce();
                executeStub.should.be.calledWith({
                    PLUGIN_MODE: 'createOrUpdate',
                    PLUGIN_STACKNAME: 'NOTCool',
                    PLUGIN_TEMPLATE: 'omg.yml',
                    PLUGIN_PARAMS: '{"hoo":"haa"}',
                    PLUGIN_ACCESS_KEY: '4321',
                    PLUGIN_SECRET_KEY: 'dcba'
                });
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(0);
            });
            it('should invoke process.exit with 1', () => {
                validateStub = sandbox.stub().returns(hl.of(1).map(() => {
                    throw new Error('craps out');
                }));
                revert.push(plugin.__set__('validate', validateStub));

                plugin.init();

                checkIfBatchStub.should.be.calledOnce();
                checkIfBatchStub.should.be.calledWith({
                    PLUGIN_STACKNAME: 'myCoolStack',
                    PLUGIN_TEMPLATE: 'path/to/template.yml',
                    PLUGIN_PARAMS: '{"foo":"bar"}',
                    PLUGIN_ACCESS_KEY: '1234',
                    PLUGIN_SECRET_KEY: 'abcd',
                    PLUGIN_PARALLEL: true
                });
                validateStub.should.be.calledOnce();
                validateStub.should.be.calledWith(123);
                executeStub.should.have.callCount(0);
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(1);
            });
        });
    });
});
