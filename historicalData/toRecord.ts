import { toTimestreamType } from './toTimestreamType'
import { TimestreamWrite } from 'aws-sdk'

export const toRecord = (Dimensions: TimestreamWrite.Dimensions) => ({
	name,
	ts,
	v,
	measureGroup,
}: {
	name: string
	ts: number
	v?: any
	measureGroup: string
}): TimestreamWrite.Record | undefined => {
	if (v === undefined) return
	return {
		Dimensions: [
			...Dimensions,
			{
				Name: 'measureGroup',
				Value: measureGroup,
			},
		],
		MeasureName: name,
		MeasureValue: v.toString(),
		MeasureValueType: toTimestreamType(v),
		Time: ts.toString(),
	}
}
