import { CommandDefinition } from './CommandDefinition'
import { stackOutput } from '@bifravst/cloudformation-helpers'
import { objectToEnv } from '@bifravst/object-to-env'
import { CloudFormation } from 'aws-sdk'
import {
	CORE_STACK_NAME,
	WEBAPP_STACK_NAME,
	DEVICEUI_STACK_NAME,
} from '../../cdk/stacks/stackName'
import { region } from '../../cdk/regions'

export const reactConfigCommand = (): CommandDefinition => ({
	command: 'react-config',
	action: async () => {
		const so = stackOutput(new CloudFormation({ region }))
		process.stdout.write(
			objectToEnv(
				{
					...(await so(CORE_STACK_NAME)),
					...(await so(WEBAPP_STACK_NAME)),
					...(await so(DEVICEUI_STACK_NAME)),
					region,
				},
				'REACT_APP_',
			),
		)
	},
	help: 'Prints the stack outputs as create-react-app environment variables.',
})
