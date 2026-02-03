import { SNS_API_VERSION } from '../utils/constants';
import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class SetTopicAttributes extends Action {
  readonly name = 'SetTopicAttributes';
  readonly category: ActionCategory = 'write';
  readonly safe = false;
  readonly parameterName: ParameterName = 'TopicArn';

  override buildParams(topicArn: string): Record<string, string> {
    return {
      Action: this.name,
      TopicArn: topicArn,
      // SignatureVersion=1 is the default, so usually a no-op
      AttributeName: 'SignatureVersion',
      AttributeValue: '1',
      Version: SNS_API_VERSION,
    };
  }
}
