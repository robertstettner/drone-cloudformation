'use strict';

require('should');
const sinon = require('sinon');
require('should-sinon');
const rewire = require('rewire');

const plugin = rewire('../plugin');

const sandbox = sinon.sandbox.create();

describe('Component tests: Drone CloudFormation', function () {
    this.timeout(10000);
    let processMock, cfnStub, createOrUpdateStub;
    const revert = [];
    describe('single config with no params passed in', () => {
        beforeEach(() => {
            processMock = {
                cwd: process.cwd,
                env: {
                    PLUGIN_STACKNAME: 'myStackname',
                    PLUGIN_TEMPLATE: './test/fixtures/template.yml'
                },
                exit: sandbox.stub()
            };
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.resolve(654));
            revert.push(plugin.__set__('process', processMock));
            revert.push(plugin.__set__('cfn', cfnStub));
        });
        afterEach(() => {
            revert.forEach(func => func());
            sandbox.reset();
        });
        it('should invoke process.exit with 0', done => {
            plugin.init();
            setTimeout(() => {
                cfnStub.should.be.calledOnce();
                // cfnStub.should.be.calledWith(123);
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(0);
                done();
            }, 100);
        });
        it('should invoke process.exit with 1', done => {
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.reject(new Error('craps out')));
            revert.push(plugin.__set__('cfn', cfnStub));

            plugin.init();
            setTimeout(() => {
                cfnStub.should.have.calledOnce();
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(1);
                done();
            }, 100);
        });
    });
    describe('single config with params passed directly', () => {
        beforeEach(() => {
            processMock = {
                cwd: process.cwd,
                env: {
                    PLUGIN_STACKNAME: 'myStackname',
                    PLUGIN_TEMPLATE: './test/fixtures/template.yml',
                    PLUGIN_PARAMS: '{"CodeVersion":"54"}'
                },
                exit: sandbox.stub()
            };
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.resolve(654));
            revert.push(plugin.__set__('process', processMock));
            revert.push(plugin.__set__('cfn', cfnStub));
        });
        afterEach(() => {
            revert.forEach(func => func());
            sandbox.reset();
        });
        it('should invoke process.exit with 0', done => {
            plugin.init();
            setTimeout(() => {
                cfnStub.should.be.calledOnce();
                // cfnStub.should.be.calledWith(123);
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(0);
                done();
            }, 100);
        });
        it('should invoke process.exit with 1', done => {
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.reject(new Error('craps out')));
            revert.push(plugin.__set__('cfn', cfnStub));

            plugin.init();
            setTimeout(() => {
                cfnStub.should.have.calledOnce();
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(1);
                done();
            }, 100);
        });
    });
    describe('single config with secret params passed directly', () => {
        beforeEach(() => {
            processMock = {
                cwd: process.cwd,
                env: {
                    FOO: 'envvar',
                    PLUGIN_STACKNAME: 'myStackname',
                    PLUGIN_TEMPLATE: './test/fixtures/template.yml',
                    PLUGIN_SECRET_PARAMS: '[{"source": "FOO", "target": "bar"}]'
                },
                exit: sandbox.stub()
            };
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.resolve(654));
            revert.push(plugin.__set__('process', processMock));
            revert.push(plugin.__set__('cfn', cfnStub));
        });
        afterEach(() => {
            revert.forEach(func => func());
            sandbox.reset();
        });
        it('should invoke process.exit with 0', done => {
            plugin.init();
            setTimeout(() => {
                cfnStub.should.be.calledOnce();
                cfnStub.getCall(0).should.be.calledWith({
                    awsConfig: {region: "eu-west-1"},
                    capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                    cfParams: {bar: "envvar"},
                    name: "myStackname",
                    template: `${__dirname}/fixtures/template.yml`
                });
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(0);
                done();
            }, 100);
        });
        it('should invoke process.exit with 1', done => {
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.reject(new Error('craps out')));
            revert.push(plugin.__set__('cfn', cfnStub));

            plugin.init();
            setTimeout(() => {
                cfnStub.should.have.calledOnce();
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(1);
                done();
            }, 100);
        });
    });
    describe('single config with params passed in JSON file', () => {
        beforeEach(() => {
            processMock = {
                cwd: process.cwd,
                env: {
                    PLUGIN_STACKNAME: 'myStackname',
                    PLUGIN_TEMPLATE: './test/fixtures/template.yml',
                    PLUGIN_PARAMS: './test/fixtures/params.json'
                },
                exit: sandbox.stub()
            };
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.resolve(654));
            revert.push(plugin.__set__('process', processMock));
            revert.push(plugin.__set__('cfn', cfnStub));
        });
        afterEach(() => {
            revert.forEach(func => func());
            sandbox.reset();
        });
        it('should invoke process.exit with 0', done => {
            plugin.init();
            setTimeout(() => {
                cfnStub.should.be.calledOnce();
                // cfnStub.should.be.calledWith(123);
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(0);
                done();
            }, 100);
        });
        it('should invoke process.exit with 1', done => {
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.reject(new Error('craps out')));
            revert.push(plugin.__set__('cfn', cfnStub));

            plugin.init();
            setTimeout(() => {
                cfnStub.should.have.calledOnce();
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(1);
                done();
            }, 100);
        });
    });
    describe('single config with params passed in JSON file with secrets', () => {
        beforeEach(() => {
            processMock = {
                cwd: process.cwd,
                env: {
                    FOO: 'envvar',
                    PLUGIN_STACKNAME: 'myStackname',
                    PLUGIN_TEMPLATE: './test/fixtures/template.yml',
                    PLUGIN_PARAMS: './test/fixtures/params.json',
                    PLUGIN_SECRET_PARAMS: '[{"source": "FOO", "target": "bar"}]'
                },
                exit: sandbox.stub()
            };
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.resolve(654));
            revert.push(plugin.__set__('process', processMock));
            revert.push(plugin.__set__('cfn', cfnStub));
        });
        afterEach(() => {
            revert.forEach(func => func());
            sandbox.reset();
        });
        it('should invoke process.exit with 0', done => {
            plugin.init();
            setTimeout(() => {
                cfnStub.should.be.calledOnce();
                cfnStub.getCall(0).should.be.calledWith({
                    awsConfig: {region: "eu-west-1"},
                    capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                    cfParams: {bar: "envvar", AppVersion: 4},
                    name: "myStackname",
                    template: `${__dirname}/fixtures/template.yml`
                });
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(0);
                done();
            }, 100);
        });
        it('should invoke process.exit with 1', done => {
            cfnStub = sandbox.stub();
            cfnStub.prototype.createOrUpdate = sandbox.stub().returns(Promise.reject(new Error('craps out')));
            revert.push(plugin.__set__('cfn', cfnStub));

            plugin.init();
            setTimeout(() => {
                cfnStub.should.have.calledOnce();
                processMock.exit.should.be.calledOnce();
                processMock.exit.should.be.calledWith(1);
                done();
            }, 100);
        });
    });
    describe('batch configs', () => {
        beforeEach(() => {
            processMock = {
                cwd: process.cwd,
                env: {
                    PLUGIN_BATCH: '[{"stackname": "lambda1","template": "./test/fixtures/template.yml","params": {"CodeVersion":"54"}},{"stackname": "lambda2","template": "./test/fixtures/template.yml","params": {"CodeVersion":"12"}},{"stackname": "lambda3","template": "./test/fixtures/template.yml","params": {"CodeVersion":"14"}}]'
                },
                exit: sandbox.stub()
            };
            revert.push(plugin.__set__('process', processMock));
        });
        afterEach(() => {
            revert.forEach(func => func());
            sandbox.reset();
        });
        describe('sequentially', () => {
            beforeEach(() => {
                cfnStub = sandbox.stub();
                createOrUpdateStub = sandbox.stub();
                createOrUpdateStub.onCall(0).returns({then: x => setTimeout(() => x(0), 100)});
                createOrUpdateStub.onCall(1).returns({then: x => setTimeout(() => x(1), 100)});
                createOrUpdateStub.onCall(2).returns({then: x => setTimeout(() => x(2), 100)});
                cfnStub.prototype.createOrUpdate = createOrUpdateStub;
                revert.push(plugin.__set__('cfn', cfnStub));
            });

            it('should invoke process.exit with 0', done => {
                plugin.init();
                setTimeout(() => {
                    cfnStub.should.have.callCount(3);
                    cfnStub.getCall(0).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "54"},
                        name: "lambda1",
                        template: `${__dirname}/fixtures/template.yml`
                    });

                    cfnStub.getCall(1).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "12"},
                        name: "lambda2",
                        template: `${__dirname}/fixtures/template.yml`
                    });

                    cfnStub.getCall(2).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "14"},
                        name: "lambda3",
                        template: `${__dirname}/fixtures/template.yml`
                    });
                    processMock.exit.should.be.calledOnce();
                    processMock.exit.should.be.calledWith(0);
                    done();
                }, 400);
            });
            it('should invoke process.exit with 1', done => {
                cfnStub = sandbox.stub();
                createOrUpdateStub = sandbox.stub();
                createOrUpdateStub.onCall(0).returns({
                    then: x => setTimeout(() => x(0), 100)
                });
                createOrUpdateStub.onCall(1).rejects(new Error('craps out'));
                createOrUpdateStub.onCall(2).returns({
                    then: x => setTimeout(() => x(2), 100)
                });
                cfnStub.prototype.createOrUpdate = createOrUpdateStub;
                revert.push(plugin.__set__('cfn', cfnStub));

                plugin.init();
                setTimeout(() => {
                    cfnStub.should.have.callCount(2);
                    cfnStub.getCall(0).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "54"},
                        name: "lambda1",
                        template: `${__dirname}/fixtures/template.yml`
                    });
                    cfnStub.getCall(1).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "12"},
                        name: "lambda2",
                        template: `${__dirname}/fixtures/template.yml`
                    });
                    createOrUpdateStub.should.have.callCount(2);
                    processMock.exit.should.be.calledOnce();
                    processMock.exit.should.be.calledWith(1);
                    done();
                }, 300);
            });
        });
        describe('in parallel', () => {
            beforeEach(() => {
                processMock.env.PLUGIN_PARALLEL = true;
                cfnStub = sandbox.stub();
                createOrUpdateStub = sandbox.stub();
                createOrUpdateStub.onCall(0).returns({then: x => setTimeout(() => x(0), 100)});
                createOrUpdateStub.onCall(1).returns({then: x => setTimeout(() => x(1), 100)});
                createOrUpdateStub.onCall(2).returns({then: x => setTimeout(() => x(2), 100)});
                cfnStub.prototype.createOrUpdate = createOrUpdateStub;
                revert.push(plugin.__set__('cfn', cfnStub));
                revert.push(plugin.__set__('process', processMock));
            });

            it('should invoke process.exit with 0', done => {
                plugin.init();
                setTimeout(() => {
                    cfnStub.should.have.callCount(3);
                    cfnStub.getCall(0).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "54"},
                        name: "lambda1",
                        template: `${__dirname}/fixtures/template.yml`
                    });
                    cfnStub.getCall(1).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "12"},
                        name: "lambda2",
                        template: `${__dirname}/fixtures/template.yml`
                    });
                    cfnStub.getCall(2).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "14"},
                        name: "lambda3",
                        template: `${__dirname}/fixtures/template.yml`
                    });
                    processMock.exit.should.be.calledOnce();
                    processMock.exit.should.be.calledWith(0);
                    done();
                }, 200);
            });
            it('should invoke process.exit with 1', done => {
                cfnStub = sandbox.stub();
                createOrUpdateStub = sandbox.stub();
                createOrUpdateStub.onCall(0).returns({
                    then: x => setTimeout(() => x(0), 100)
                });
                createOrUpdateStub.onCall(1).rejects(new Error('craps out'));
                createOrUpdateStub.onCall(2).returns({
                    then: x => setTimeout(() => x(2), 100)
                });
                cfnStub.prototype.createOrUpdate = createOrUpdateStub;
                revert.push(plugin.__set__('cfn', cfnStub));

                plugin.init();
                setTimeout(() => {
                    cfnStub.should.have.callCount(3);
                    cfnStub.getCall(0).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "54"},
                        name: "lambda1",
                        template: `${__dirname}/fixtures/template.yml`
                    });
                    cfnStub.getCall(1).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "12"},
                        name: "lambda2",
                        template: `${__dirname}/fixtures/template.yml`
                    });
                    cfnStub.getCall(2).should.be.calledWith({
                        awsConfig: {region: "eu-west-1"},
                        capabilities: ["CAPABILITY_NAMED_IAM", "CAPABILITY_IAM"],
                        cfParams: {CodeVersion: "14"},
                        name: "lambda3",
                        template: `${__dirname}/fixtures/template.yml`
                    });
                    createOrUpdateStub.should.have.callCount(3);
                    processMock.exit.should.be.calledOnce();
                    processMock.exit.should.be.calledWith(1);
                    done();
                }, 200);
            });
        });
    });
});