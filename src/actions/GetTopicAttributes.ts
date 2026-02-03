import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class GetTopicAttributes extends Action {
  readonly name = 'GetTopicAttributes';
  readonly category: ActionCategory = 'read';
  readonly safe = true;
  readonly parameterName: ParameterName = 'TopicArn';
}
