import * as CloudFormation from '@aws-cdk/core'
import * as IAM from '@aws-cdk/aws-iam'
import * as Iot from '@aws-cdk/aws-iot'
import * as S3 from '@aws-cdk/aws-s3'
import { ThingGroup } from './ThingGroup'
import { ThingGroupLambda } from './ThingGroupLambda'

export class FirmwareCI extends CloudFormation.Resource {
	public readonly thingGroupName
	public readonly bucket
	public readonly userAccessKey
	public constructor(
		parent: CloudFormation.Stack,
		id: string,
		{ thingGroupLambda }: { thingGroupLambda: ThingGroupLambda },
	) {
		super(parent, id)

		this.bucket = new S3.Bucket(this, 'bucket', {
			publicReadAccess: true,
			removalPolicy: CloudFormation.RemovalPolicy.DESTROY,
		})

		const iotThingPolicy = new Iot.CfnPolicy(this, 'thingPolicy', {
			policyDocument: {
				Version: '2012-10-17',
				Statement: [
					{
						Effect: 'Allow',
						Action: ['iot:Connect'],
						Resource: ['arn:aws:iot:*:*:client/${iot:ClientId}'],
						Condition: {
							Bool: {
								'iot:Connection.Thing.IsAttached': [true],
							},
						},
					},
					{
						Effect: 'Allow',
						Action: ['iot:Receive'],
						Resource: ['*'],
					},
					{
						Effect: 'Allow',
						Action: ['iot:Subscribe'],
						Resource: [
							'arn:aws:iot:*:*:topicfilter/$aws/things/${iot:ClientId}/*',
						],
					},
					{
						Effect: 'Allow',
						Action: ['iot:Publish'],
						Resource: ['arn:aws:iot:*:*:topic/$aws/things/${iot:ClientId}/*'],
					},
				],
			},
		})

		this.thingGroupName = `${parent.stackName}-ci`
		new ThingGroup(this, 'ThingGroup', {
			name: this.thingGroupName,
			description: 'Group for Firmware CI',
			PolicyName: iotThingPolicy.ref,
			thingGroupLambda: thingGroupLambda.function,
		})

		const ciUser = new IAM.User(this, 'ciUser')

		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'iot:createThing',
					'iot:deleteThing',
					'iot:AddThingToThingGroup',
					'iot:RemoveThingFromThingGroup',
					'iot:AttachThingPrincipal',
					'iot:DetachThingPrincipal',
					'iot:CreateJob',
					'iot:DescribeJobExecution',
				],
				resources: [
					`arn:aws:iot:${parent.region}:${parent.account}:thing/firmware-ci-*`,
				],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'iot:CreateKeysAndCertificate',
					'iot:DeleteCertificate',
					'iot:UpdateCertificate',
					'iot:AttachThingPrincipal',
					'iot:DetachThingPrincipal',
					'iot:describeThing',
				],
				resources: [`*`],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: ['iot:AddThingToThingGroup', 'iot:RemoveThingFromThingGroup'],
				resources: [
					`arn:aws:iot:${parent.region}:${parent.account}:thinggroup/${this.thingGroupName}`,
				],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				actions: [
					'iot:CreateJob',
					'iot:CancelJob',
					'iot:DeleteJob',
					'iot:DescribeJob',
					'iot:DescribeJobExecution',
					'iot:GetJobDocument',
				],
				resources: [`arn:aws:iot:${parent.region}:${parent.account}:job/*`],
			}),
		)
		ciUser.addToPolicy(
			new IAM.PolicyStatement({
				resources: [`${this.bucket.bucketArn}/*`],
				actions: ['s3:PutObject', 's3:DeleteObject'],
			}),
		)

		this.userAccessKey = new IAM.CfnAccessKey(this, 'userAccessKey', {
			userName: ciUser.userName,
			status: 'Active',
		})
	}
}
