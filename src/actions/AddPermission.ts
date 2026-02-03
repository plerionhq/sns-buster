import { SNS_API_VERSION } from '../utils/constants';
import { parseArn } from '../utils/arn';
import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class AddPermission extends Action {
  readonly name = 'AddPermission';
  readonly category: ActionCategory = 'write';
  readonly safe = true;
  readonly parameterName: ParameterName = 'TopicArn';

  override buildParams(topicArn: string): Record<string, string> {
    const parsed = parseArn(topicArn);
    return {
      Action: this.name,
      TopicArn: topicArn,
      Label: 'sns-buster-test-noop',
      'AWSAccountId.member.1': parsed.accountId,
      'ActionName.member.1': 'GetTopicAttributes',
      Version: SNS_API_VERSION,
    };
  }
}
