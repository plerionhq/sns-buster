import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class ListSubscriptionsByTopic extends Action {
  readonly name = 'ListSubscriptionsByTopic';
  readonly category: ActionCategory = 'read';
  readonly safe = true;
  readonly parameterName: ParameterName = 'TopicArn';
}
