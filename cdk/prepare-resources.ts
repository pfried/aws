import { Iot } from 'aws-sdk'
import * as path from 'path'
import { promises as fs } from 'fs'
import { getLambdaSourceCodeBucketName } from './helper/getLambdaSourceCodeBucketName'
import {
	LayeredLambdas,
	packBaseLayer,
	packLayeredLambdas,
	WebpackMode,
} from '@bifravst/package-layered-lambdas'
import { supportedRegions } from './regions'
import * as chalk from 'chalk'
import { getIotEndpoint } from './helper/getIotEndpoint'
import { spawn } from 'child_process'
import { ConsoleProgressReporter } from '@bifravst/package-layered-lambdas/dist/src/reporter'

export type CDKLambdas = {
	createThingGroup: string
	httpApiHealth: string
}

export type BifravstLambdas = {
	storeMessagesInTimestream: string
	geolocateCellHttpApi: string
	invokeStepFunctionFromSQS: string
	geolocateCellFromCacheStepFunction: string
	geolocateCellFromDeviceLocationsStepFunction: string
	geolocateCellFromUnwiredLabsStepFunction: string
	cacheCellGeolocationStepFunction: string
	addCellGeolocationHttpApi: string
}

export const prepareResources = async ({
	region,
	rootDir,
}: {
	region: string
	rootDir: string
}): Promise<{
	mqttEndpoint: string
	outDir: string
	sourceCodeBucketName: string
}> => {
	// Detect the AWS IoT endpoint
	const endpointAddress = await getIotEndpoint(
		new Iot({
			region,
		}),
	)

	if (!supportedRegions.includes(region)) {
		console.log(
			chalk.yellow.inverse.bold(' WARNING '),
			chalk.yellow(
				`Your region ${region} is not in the list of supported regions!`,
			),
		)
		console.log(
			chalk.yellow.inverse.bold(' WARNING '),
			chalk.yellow(`CDK might not be able to successfully deploy.`),
		)
	}

	// Storeage for packed lambdas
	const outDir = path.resolve(rootDir, 'dist', 'lambdas')
	try {
		await fs.stat(outDir)
	} catch (_) {
		await fs.mkdir(outDir)
	}

	return {
		mqttEndpoint: endpointAddress,
		sourceCodeBucketName: await getLambdaSourceCodeBucketName(),
		outDir,
	}
}

export type PackedLambdas<
	A extends {
		[key: string]: string
	}
> = {
	lambdas: LayeredLambdas<A>
	layerZipFileName: string
}

export const prepareCDKLambdas = async ({
	rootDir,
	outDir,
	sourceCodeBucketName,
}: {
	rootDir: string
	outDir: string
	sourceCodeBucketName: string
}): Promise<PackedLambdas<CDKLambdas>> => {
	const reporter = ConsoleProgressReporter('CDK Lambdas')
	return {
		layerZipFileName: await (async () => {
			reporter.progress('base-layer')('Writing package.json')
			const cloudFormationLayerDir = path.resolve(
				rootDir,
				'dist',
				'lambdas',
				'cloudFormationLayer',
			)
			try {
				await fs.stat(cloudFormationLayerDir)
			} catch (_) {
				await fs.mkdir(cloudFormationLayerDir)
			}
			const devDeps = JSON.parse(
				await fs.readFile(path.resolve(rootDir, 'package.json'), 'utf-8'),
			).devDependencies
			await fs.writeFile(
				path.join(cloudFormationLayerDir, 'package.json'),
				JSON.stringify({
					dependencies: {
						'aws-sdk': devDeps['aws-sdk'],
						'@bifravst/cloudformation-helpers':
							devDeps['@bifravst/cloudformation-helpers'],
					},
				}),
				'utf-8',
			)
			reporter.progress('base-layer')('Installing dependencies')
			await new Promise<void>((resolve, reject) => {
				const p = spawn('npm', ['i', '--ignore-scripts', '--only=prod'], {
					cwd: cloudFormationLayerDir,
				})
				p.on('close', (code) => {
					if (code !== 0) {
						const msg = `[CloudFormation Layer] npm i in ${cloudFormationLayerDir} exited with code ${code}.`
						return reject(new Error(msg))
					}
					return resolve()
				})
			})
			return await packBaseLayer({
				reporter,
				srcDir: cloudFormationLayerDir,
				outDir,
				Bucket: sourceCodeBucketName,
			})
		})(),
		lambdas: await packLayeredLambdas<CDKLambdas>({
			reporter,
			id: 'CDK',
			mode: WebpackMode.production,
			srcDir: rootDir,
			outDir,
			Bucket: sourceCodeBucketName,
			lambdas: {
				createThingGroup: path.resolve(rootDir, 'cdk', 'createThingGroup.ts'),
				httpApiHealth: path.resolve(rootDir, 'cdk', 'httpApiHealth.ts'),
			},
			tsConfig: path.resolve(rootDir, 'tsconfig.json'),
		}),
	}
}

export const prepareBifravstLambdas = async ({
	rootDir,
	outDir,
	sourceCodeBucketName,
}: {
	rootDir: string
	outDir: string
	sourceCodeBucketName: string
}): Promise<PackedLambdas<BifravstLambdas>> => {
	const reporter = ConsoleProgressReporter('Bifravst Lambdas')
	return {
		layerZipFileName: await packBaseLayer({
			reporter,
			srcDir: rootDir,
			outDir,
			Bucket: sourceCodeBucketName,
		}),
		lambdas: await packLayeredLambdas<BifravstLambdas>({
			reporter,
			id: 'bifravst',
			mode: WebpackMode.production,
			srcDir: rootDir,
			outDir,
			Bucket: sourceCodeBucketName,
			lambdas: {
				storeMessagesInTimestream: path.resolve(
					rootDir,
					'historicalData',
					'storeMessagesInTimestream.ts',
				),
				invokeStepFunctionFromSQS: path.resolve(
					rootDir,
					'cellGeolocation',
					'lambda',
					'invokeStepFunctionFromSQS.ts',
				),
				geolocateCellFromCacheStepFunction: path.resolve(
					rootDir,
					'cellGeolocation',
					'stepFunction',
					'fromCache.ts',
				),
				geolocateCellFromDeviceLocationsStepFunction: path.resolve(
					rootDir,
					'cellGeolocation',
					'stepFunction',
					'fromDeviceLocations.ts',
				),
				geolocateCellFromUnwiredLabsStepFunction: path.resolve(
					rootDir,
					'cellGeolocation',
					'stepFunction',
					'unwiredlabs.ts',
				),
				cacheCellGeolocationStepFunction: path.resolve(
					rootDir,
					'cellGeolocation',
					'stepFunction',
					'updateCache.ts',
				),
				geolocateCellHttpApi: path.resolve(
					rootDir,
					'cellGeolocation',
					'httpApi',
					'cell.ts',
				),
				addCellGeolocationHttpApi: path.resolve(
					rootDir,
					'cellGeolocation',
					'httpApi',
					'addCellGeolocation.ts',
				),
			},
			tsConfig: path.resolve(rootDir, 'tsconfig.json'),
		}),
	}
}
