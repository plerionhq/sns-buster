import { SNS_API_VERSION } from '../utils/constants';
import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class PutDataProtectionPolicy extends Action {
  readonly name = 'PutDataProtectionPolicy';
  readonly category: ActionCategory = 'write';
  readonly safe = false;
  readonly parameterName: ParameterName = 'ResourceArn';

  override buildParams(topicArn: string): Record<string, string> {
    const policy = JSON.stringify({
      Name: 'sns-buster-test-policy',
      Description: 'Test policy from sns-buster',
      Version: '2021-06-01',
      Statement: [
        {
          Sid: 'sns-buster-audit',
          DataDirection: 'Inbound',
          Principal: ['*'],
          DataIdentifier: ['arn:aws:dataprotection::aws:data-identifier/CreditCardNumber'],
          Operation: {
            Audit: {
              SampleRate: '99',
              FindingsDestination: {},
            },
          },
        },
      ],
    });

    return {
      Action: this.name,
      ResourceArn: topicArn,
      DataProtectionPolicy: policy,
      Version: SNS_API_VERSION,
    };
  }
}
