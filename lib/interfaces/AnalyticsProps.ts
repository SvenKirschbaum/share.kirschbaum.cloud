import { Table } from 'aws-cdk-lib/aws-dynamodb';

export interface AnalyticsProps {
    table: Table
}
