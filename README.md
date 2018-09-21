# drone-cloudformation
[![Build Status](https://travis-ci.org/robertstettner/drone-cloudformation.svg?branch=master)](https://travis-ci.org/robertstettner/drone-cloudformation)
[![Coverage Status](https://coveralls.io/repos/github/robertstettner/drone-cloudformation/badge.svg?branch=master)](https://coveralls.io/github/robertstettner/drone-cloudformation?branch=master)

Drone plugin for creating/updating or deleting AWS CloudFormation stacks
and validating AWS CloudFormation templates.

## Configuration

The following parameters are used to configure the plugin:

- `mode`: the mode to run the plugin. Defaults to `createOrUpdate`.
- `stackname`: the name of the CloudFormation stack. Required.
  Not needed for the `validate` mode.
- `template`: the path location of the template file or S3 url. Required.
  Not needed for the `delete` mode.
- `params`: object of parameters or path of JSON file of parameters to feed into the template. Optional.
  Not needed for `validate` and `delete` modes.
- `secret_params`: object of parameters stored as Drone secrets to feed
  into the template. Optional.
  Not needed for `validate` and `delete` modes.
- `region`: the AWS region to deploy to. Defaults to `eu-west-1`.
- `access_key`: the AWS access key. Optional.
- `secret_key`: the AWS secret key. Optional.
- `batch`: an array of configurations.
- `parallel`: a boolean denoting parallel execution of batch configs.
  Defaults to `false`.

### Modes

There are four modes that the Drone plugin can be run with:

- `createOrUpdate`: automatically determines whether to create or update a stack.
- `create`: creates a stack.
- `delete`: deletes a stack.
- `validate`: validates a template.

### Drone configuration example

Deployment example below:
```yaml
pipeline:
  ...
  deploy:
    image: robertstettner/drone-cloudformation
    pull: true
    stackname: my-awesome-stack-${DRONE_BRANCH}
    template: templates/stack.yml
    params:
      Version: ${DRONE_BUILD_NUMBER}
      Environment: ${DRONE_DEPLOY_TO}
    when:
      event: deployment
```

Deployment example with secrets:
```yaml
pipeline:
  ...
  deploy:
    image: robertstettner/drone-cloudformation
    pull: true
    stackname: my-awesome-stack-${DRONE_BRANCH}
    template: templates/stack.yml
    secret_params:
      - source: DB_PASSWORD
        target: DbPassword
    params:
      Version: ${DRONE_BUILD_NUMBER}
      Environment: ${DRONE_DEPLOY_TO}
    secrets: [DB_PASSWORD]
    when:
      event: deployment
```

Deployment example with template file in S3 below:
```yaml
pipeline:
  ...
  deploy:
    image: robertstettner/drone-cloudformation
    pull: true
    stackname: my-awesome-stack-${DRONE_BRANCH}
    template: s3://mybucket/template.yml
    params:
      Version: ${DRONE_BUILD_NUMBER}
      Environment: ${DRONE_DEPLOY_TO}
    when:
      event: deployment
```

Deployment of multiple stacks example below:
```yaml
pipeline:
  ...
  deploy:
    image: robertstettner/drone-cloudformation
    pull: true
    batch:
      - stackname: my-database-stack-${DRONE_BRANCH}
        template: templates/db.yml
        params:
          Environment: ${DRONE_DEPLOY_TO}
      - stackname: my-app-stack-${DRONE_BRANCH}
        template: templates/app.yml
        params:
          Version: ${DRONE_BUILD_NUMBER}
          Environment: ${DRONE_DEPLOY_TO}
    when:
      event: deployment
```

Template validation example below:
```yaml
pipeline:
  ...
  validate-template:
    image: robertstettner/drone-cloudformation
    pull: true
    mode: validate
    template: templates/stack.yml
```

Parallel template validation example below:
```yaml
pipeline:
  ...
  validate-template:
    image: robertstettner/drone-cloudformation
    pull: true
    parallel: true
    batch:
      - mode: validate
        template: templates/db.yml
      - mode: validate
        template: templates/app.yml
```

## Further reading

* [Contributing](CONTRIBUTING.md)
* [Change Log](CHANGELOG.md)
* [Road Map](ROADMAP.md)
* [License](LICENSE.txt)