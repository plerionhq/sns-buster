import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class ListTagsForResource extends Action {
  readonly name = 'ListTagsForResource';
  readonly category: ActionCategory = 'read';
  readonly safe = true;
  readonly parameterName: ParameterName = 'ResourceArn';
}
