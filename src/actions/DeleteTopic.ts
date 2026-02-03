import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class DeleteTopic extends Action {
  readonly name = 'DeleteTopic';
  readonly category: ActionCategory = 'write';
  readonly safe = false;
  readonly parameterName: ParameterName = 'TopicArn';
}
