import { CloudFormation } from 'aws-sdk'
import {
	CONTINUOUS_DEPLOYMENT_STACK_NAME,
	CORE_STACK_NAME,
} from '../../cdk/stacks/stackName'
import { region } from '../../cdk/regions'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { StackOutputs } from '../../cdk/stacks/ContinuousDeployment'

/**
 * Returns the active pipelines of the CD stack
 */
export const listPipelines = async (): Promise<string[]> => {
	const cf = new CloudFormation({ region })
	const config = await stackOutput(cf)<StackOutputs>(
		CONTINUOUS_DEPLOYMENT_STACK_NAME,
	)

	const pipelines = [`${CORE_STACK_NAME}-continuous-deployment`]
	if (config.deviceUICD === 'enabled')
		pipelines.push(`${CORE_STACK_NAME}-continuous-deployment-deviceUICD`)
	if (config.webAppCD === 'enabled')
		pipelines.push(`${CORE_STACK_NAME}-continuous-deployment-webAppCD`)
	return pipelines
}
