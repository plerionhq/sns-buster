import { SNS_API_VERSION } from '../utils/constants';
import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class UntagResource extends Action {
  readonly name = 'UntagResource';
  readonly category: ActionCategory = 'write';
  readonly safe = true;
  readonly parameterName: ParameterName = 'ResourceArn';

  override buildParams(topicArn: string): Record<string, string> {
    return {
      Action: this.name,
      ResourceArn: topicArn,
      'TagKeys.member.1': 'sns-buster-test',
      Version: SNS_API_VERSION,
    };
  }
}
