export type ActionCategory = 'read' | 'write';

export type ParameterName = 'TopicArn' | 'ResourceArn' | 'SubscriptionArn';

export interface ActionDefinition {
  name: string;
  category: ActionCategory;
  safe: boolean;
  parameterName: ParameterName;
}

export interface ActionResult {
  action: string;
  signed: boolean;
  status: number;
  success: boolean;
  error?: string;
  requestId?: string;
}
