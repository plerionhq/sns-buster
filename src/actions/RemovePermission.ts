import { SNS_API_VERSION } from '../utils/constants';
import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class RemovePermission extends Action {
  readonly name = 'RemovePermission';
  readonly category: ActionCategory = 'write';
  readonly safe = false;
  readonly parameterName: ParameterName = 'TopicArn';

  override buildParams(topicArn: string): Record<string, string> {
    return {
      Action: this.name,
      TopicArn: topicArn,
      Label: 'sns-buster-test-noop',
      Version: SNS_API_VERSION,
    };
  }
}
