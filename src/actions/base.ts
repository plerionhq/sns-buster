import { SNS_API_VERSION } from '../utils/constants';
import type { ActionCategory, ActionDefinition, ParameterName } from './types';

export abstract class Action implements ActionDefinition {
  abstract readonly name: string;
  abstract readonly category: ActionCategory;
  abstract readonly safe: boolean;
  abstract readonly parameterName: ParameterName;

  buildParams(topicArn: string): Record<string, string> {
    return {
      Action: this.name,
      [this.parameterName]: topicArn,
      Version: SNS_API_VERSION,
    };
  }

  getDefinition(): ActionDefinition {
    return {
      name: this.name,
      category: this.category,
      safe: this.safe,
      parameterName: this.parameterName,
    };
  }
}
