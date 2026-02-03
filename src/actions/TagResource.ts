import { SNS_API_VERSION } from '../utils/constants';
import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class TagResource extends Action {
  readonly name = 'TagResource';
  readonly category: ActionCategory = 'write';
  readonly safe = true;
  readonly parameterName: ParameterName = 'ResourceArn';

  override buildParams(topicArn: string): Record<string, string> {
    return {
      Action: this.name,
      ResourceArn: topicArn,
      'Tags.member.1.Key': 'sns-buster-test',
      'Tags.member.1.Value': 'true',
      Version: SNS_API_VERSION,
    };
  }
}
