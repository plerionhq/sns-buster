import { SNS_API_VERSION } from '../utils/constants';
import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class PublishBatch extends Action {
  readonly name = 'PublishBatch';
  readonly category: ActionCategory = 'write';
  readonly safe = true;
  readonly parameterName: ParameterName = 'TopicArn';

  override buildParams(topicArn: string): Record<string, string> {
    return {
      Action: this.name,
      TopicArn: topicArn,
      'PublishBatchRequestEntries.member.1.Id': 'msg1',
      'PublishBatchRequestEntries.member.1.Message': 'sns-buster batch test message',
      Version: SNS_API_VERSION,
    };
  }
}
