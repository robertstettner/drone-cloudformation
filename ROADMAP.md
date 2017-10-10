# Road map

* Add tags as a parameter for create, and createOrUpdate modes. 
This will allow AWS CloudFormation to propagates these tags to the 
resources created in the stack.

* Allow for `stackname` parameter to be read from a text file with .txt 
extension. This is to programmatically use this plugin with a build 
environment step before a deployment step.

* Expose `capabilities` parameter for create, and createOrUpdate modes to 
specify `CAPABILITY_IAM` and or `CAPABILITY_NAMED_IAM`.

* Expose `timeout` parameter for create, and createOrUpdate modes.

* Compatibility with AWS access key and AWS secret key as secrets for 
Drone 0.8+. This has caveats, whereby batch processes using the access 
and secret keys will be disregarded.