import { SNS_API_VERSION } from '../utils/constants';
import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class Publish extends Action {
  readonly name = 'Publish';
  readonly category: ActionCategory = 'write';
  readonly safe = true;
  readonly parameterName: ParameterName = 'TopicArn';

  override buildParams(topicArn: string): Record<string, string> {
    return {
      Action: this.name,
      TopicArn: topicArn,
      Message: 'sns-buster test message',
      Version: SNS_API_VERSION,
    };
  }
}
