import { Action } from './base';
import type { ActionCategory, ParameterName } from './types';

export class GetDataProtectionPolicy extends Action {
  readonly name = 'GetDataProtectionPolicy';
  readonly category: ActionCategory = 'read';
  readonly safe = true;
  readonly parameterName: ParameterName = 'ResourceArn';
}
