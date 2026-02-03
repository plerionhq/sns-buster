import { SNS_API_VERSION } from '../utils/constants';
import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class Subscribe extends Action {
  readonly name = 'Subscribe';
  readonly category: ActionCategory = 'write';
  readonly safe = true;
  readonly parameterName: ParameterName = 'TopicArn';

  override buildParams(topicArn: string): Record<string, string> {
    return {
      Action: this.name,
      TopicArn: topicArn,
      Protocol: 'https',
      Endpoint: 'https://example.com/sns-buster-test',
      Version: SNS_API_VERSION,
    };
  }
}
